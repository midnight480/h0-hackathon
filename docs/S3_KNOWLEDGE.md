# S3 Presigned URL ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html
> - https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
> - https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/

---

## 概要

Presigned URL は、AWS 認証情報を持たないクライアント (ブラウザ) が S3 に直接アップロード/ダウンロードするための期限付き URL。

### Hiravi での利用方針
- **アップロード**: ブラウザから PDF を S3 に直接 PUT (Server Action で presigned URL 生成 → クライアントで fetch PUT)
- **非公開ファイル読み取り**: 元 PDF は presigned URL (15分) で保護
- **非公開デッキ画像**: presigned URL (1時間) で期限付きアクセス
- **公開デッキ画像**: `slides/public/*` プレフィックスは公開読み取り許可 (OGP 用、presigned URL 不要)

---

## セットアップ

### インストール

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### S3 クライアント初期化

```typescript
// lib/s3.ts
import { S3Client } from '@aws-sdk/client-s3'

export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export const BUCKET_NAME = process.env.S3_BUCKET_NAME!
```

---

## アップロード用 Presigned URL (PutObject)

### Server Action で URL 生成

```typescript
// app/actions/upload.ts
'use server'

import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client, BUCKET_NAME } from '@/lib/s3'
import { auth } from '@clerk/nextjs/server'
import { nanoid } from 'nanoid'

export async function getUploadUrl(fileName: string, contentType: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // ファイルキー生成 (ユニーク)
  const fileKey = `uploads/${userId}/${nanoid()}-${fileName}`

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    ContentType: contentType,
    // メタデータ (オプション)
    Metadata: {
      'uploaded-by': userId,
    },
  })

  // 15分間有効な presigned URL を生成
  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 900, // 15分 (秒)
  })

  return { url, fileKey }
}
```

### クライアントからアップロード

```typescript
// components/upload-form.tsx
'use client'

import { getUploadUrl } from '@/app/actions/upload'

async function handleUpload(file: File) {
  // 1. Server Action で presigned URL を取得
  const { url, fileKey } = await getUploadUrl(file.name, file.type)

  // 2. ブラウザから S3 に直接 PUT
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  })

  if (!response.ok) {
    throw new Error('Upload failed')
  }

  return fileKey // DB に保存するキー
}
```

---

## ダウンロード用 Presigned URL (GetObject)

### 非公開ファイルへのアクセス

```typescript
// lib/s3.ts
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * 元 PDF ファイルの presigned URL (15分)
 */
export async function getPdfDownloadUrl(fileKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
  })

  return getSignedUrl(s3Client, command, {
    expiresIn: 900, // 15分
  })
}

/**
 * 非公開デッキのスライド画像 presigned URL (1時間)
 */
export async function getPrivateSlideUrl(imageKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: imageKey,
  })

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1時間
  })
}

/**
 * 公開デッキのスライド画像 URL (presigned 不要)
 * slides/public/ プレフィックスはバケットポリシーで公開読み取り許可
 */
export function getPublicSlideUrl(imageKey: string): string {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${imageKey}`
}
```

---

## バリデーション (セキュリティ)

### アップロード前のファイル検証

```typescript
// lib/upload-validation.ts

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['application/pdf']
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46] // %PDF

export function validateUploadFile(file: File): { valid: boolean; error?: string } {
  // サイズチェック
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 20MB limit' }
  }

  // Content-Type チェック
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Only PDF files are allowed' }
  }

  // 拡張子チェック
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'File must have .pdf extension' }
  }

  return { valid: true }
}

/**
 * マジックバイト検証 (サーバーサイド)
 * PDF ファイルは先頭4バイトが %PDF
 */
export async function validatePdfMagicBytes(buffer: ArrayBuffer): Promise<boolean> {
  const bytes = new Uint8Array(buffer.slice(0, 4))
  return PDF_MAGIC_BYTES.every((b, i) => bytes[i] === b)
}
```

---

## S3 キー設計 (Hiravi)

```
hiravi-slides-{account_id}/
├── uploads/                    # 元 PDF (非公開、presigned URL で保護)
│   └── {user_id}/
│       └── {nanoid}-{filename}.pdf
├── slides/
│   ├── public/                 # 公開デッキのスライド画像 (バケットポリシーで公開)
│   │   └── {deck_id}/
│   │       └── v{version}/
│   │           ├── page-1.webp
│   │           ├── page-2.webp
│   │           └── ...
│   └── private/                # 非公開デッキのスライド画像 (presigned URL で保護)
│       └── {deck_id}/
│           └── v{version}/
│               ├── page-1.webp
│               └── ...
```

---

## OGP 画像の URL 設計

```typescript
/**
 * OGP 用画像 URL (期限なし、公開)
 * SNS クローラーが後からキャッシュするため presigned URL は使えない
 * バージョン番号を含めてキャッシュバスティング
 */
export function getOgImageUrl(deckId: string, version: number): string {
  const key = `slides/public/${deckId}/v${version}/page-1.webp`
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
}
```

---

## オブジェクト削除

```typescript
import { DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'

/**
 * 単一オブジェクト削除
 */
export async function deleteObject(key: string) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }))
}

/**
 * 複数オブジェクト一括削除 (デッキ削除時)
 */
export async function deleteObjects(keys: string[]) {
  await s3Client.send(new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: keys.map(Key => ({ Key })),
    },
  }))
}
```

---

## 環境変数

```env
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=hiravi-slides-123456789012
```

---

## 参考ドキュメントリンク

| トピック | URL |
|----------|-----|
| Presigned URL でアップロード | https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html |
| Presigned URL でダウンロード | https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html |
| @aws-sdk/s3-request-presigner | https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/ |
| S3 バケットポリシー | https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html |
