# Amazon SQS ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/classes/sendmessagecommand.html
> - https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html
> - https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_sqs_code_examples.html

---

## 概要

Amazon SQS はフルマネージドのメッセージキューサービス。プロデューサーとコンシューマーを疎結合にし、非同期処理パイプラインを構築する。

### Hiravi での利用方針
- **プロデューサー**: Vercel (Next.js Server Action) → PDF アップロード後にメッセージ送信
- **コンシューマー**: Lambda (SQS トリガー) → PDF 画像変換 + テキスト抽出 + 翻訳
- **DLQ**: 3回失敗したメッセージを退避 (手動確認用)
- **メリット**: Vercel のタイムアウト制約 (10秒/30秒) を回避、失敗時の自動リトライ

---

## セットアップ

### インストール

```bash
npm install @aws-sdk/client-sqs
```

### SQS クライアント初期化

```typescript
// lib/sqs.ts
import { SQSClient } from '@aws-sdk/client-sqs'

export const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export const PROCESSING_QUEUE_URL = process.env.SQS_PROCESSING_QUEUE_URL!
```

---

## メッセージ送信 (Vercel → SQS)

### Server Action からキューに投入

```typescript
// app/actions/process-deck.ts
'use server'

import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { sqsClient, PROCESSING_QUEUE_URL } from '@/lib/sqs'

interface ProcessingMessage {
  deck_id: string
  file_key: string
  original_language: string
  target_languages: string[]
  user_id: string
  version: number
}

/**
 * PDF 処理ジョブをキューに投入
 * Lambda が SQS トリガーで消費する
 */
export async function enqueueProcessingJob(message: ProcessingMessage) {
  const command = new SendMessageCommand({
    QueueUrl: PROCESSING_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    // メッセージ属性 (オプション、フィルタリング用)
    MessageAttributes: {
      'deck_id': {
        DataType: 'String',
        StringValue: message.deck_id,
      },
      'action': {
        DataType: 'String',
        StringValue: 'process_upload',
      },
    },
  })

  const response = await sqsClient.send(command)
  return response.MessageId
}
```

### アップロードフロー全体

```typescript
// app/actions/upload.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { getDb } from '@/lib/db'
import { decks, deckEvents } from '@/lib/schema'
import { withRetry } from '@/lib/retry'
import { enqueueProcessingJob } from './process-deck'

export async function submitDeck(formData: FormData) {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const db = await getDb()
  const title = formData.get('title') as string
  const slug = formData.get('slug') as string
  const fileKey = formData.get('fileKey') as string
  const originalLanguage = formData.get('originalLanguage') as string
  const targetLanguages = JSON.parse(formData.get('targetLanguages') as string)

  // 1. DB にデッキレコード作成 (processing_status = 'pending')
  const [deck] = await withRetry(() =>
    db.insert(decks).values({
      userId: user.id,
      slug,
      title,
      fileKey,
      originalLanguage,
      targetLanguages,
      processingStatus: 'pending',
    }).returning()
  )

  // 2. イベント記録
  await withRetry(() =>
    db.insert(deckEvents).values({
      deckId: deck.id,
      eventType: 'draft',
      version: 1,
      actorId: user.id,
    })
  )

  // 3. SQS にジョブ投入
  await enqueueProcessingJob({
    deck_id: deck.id,
    file_key: fileKey,
    original_language: originalLanguage,
    target_languages: targetLanguages,
    user_id: user.id,
    version: 1,
  })

  return deck
}
```

---

## 再試行 (失敗時のリキュー)

```typescript
// app/actions/retry-processing.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import { enqueueProcessingJob } from './process-deck'
import { getDb } from '@/lib/db'
import { decks } from '@/lib/schema'
import { eq } from 'drizzle-orm'

/**
 * 処理失敗したデッキを再キュー投入
 */
export async function retryProcessing(deckId: string) {
  const { userId: clerkId } = await auth()
  if (!clerkId) throw new Error('Unauthorized')

  const db = await getDb()
  const [deck] = await db.select().from(decks).where(eq(decks.id, deckId)).limit(1)

  if (!deck || deck.processingStatus !== 'failed') {
    throw new Error('Deck not found or not in failed state')
  }

  // ステータスを pending に戻す
  await db.update(decks)
    .set({ processingStatus: 'pending' })
    .where(eq(decks.id, deckId))

  // 再キュー
  await enqueueProcessingJob({
    deck_id: deck.id,
    file_key: deck.fileKey,
    original_language: deck.originalLanguage,
    target_languages: deck.targetLanguages,
    user_id: deck.userId,
    version: 1,
  })
}
```

---

## メッセージ受信 (Lambda 側 — Python)

```python
# lambda/processing/handler.py
import json
import logging

logger = logging.getLogger()

def main(event, context):
    """SQS イベントハンドラー"""
    for record in event.get('Records', []):
        body = json.loads(record['body'])

        deck_id = body['deck_id']
        file_key = body['file_key']
        target_languages = body['target_languages']
        original_language = body['original_language']

        logger.info(f"Processing: deck_id={deck_id}")

        # 処理実行...
        # 失敗時は例外を raise → SQS が自動リトライ (最大3回)
        # 3回失敗 → DLQ に移動
```

### SQS イベント構造 (Lambda に渡される)

```json
{
  "Records": [
    {
      "messageId": "059f36b4-87a3-44ab-83d2-661975830a7d",
      "receiptHandle": "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...",
      "body": "{\"deck_id\":\"abc-123\",\"file_key\":\"uploads/user1/file.pdf\",\"target_languages\":[\"en\",\"zh\"]}",
      "attributes": {
        "ApproximateReceiveCount": "1",
        "SentTimestamp": "1545082649636",
        "SenderId": "AIDAIENQZJOLO23YVJ4VO",
        "ApproximateFirstReceiveTimestamp": "1545082649636"
      },
      "messageAttributes": {
        "deck_id": {
          "stringValue": "abc-123",
          "dataType": "String"
        }
      },
      "md5OfBody": "e4e68fb7bd0e697a0ae8f1bb342846b3",
      "eventSource": "aws:sqs",
      "eventSourceARN": "arn:aws:sqs:ap-northeast-1:123456789012:hiravi-processing-queue",
      "awsRegion": "ap-northeast-1"
    }
  ]
}
```

---

## メッセージ設計 (Hiravi)

### 処理ジョブメッセージ

```typescript
interface ProcessingMessage {
  deck_id: string           // デッキ ID
  file_key: string          // S3 上の PDF キー
  original_language: string // ソース言語 ('ja', 'en', etc.)
  target_languages: string[] // ターゲット言語リスト
  user_id: string           // ユーザー ID (DB 更新時に使用)
  version: number           // スライドバージョン
}
```

### 遅延メッセージ (オプション)

```typescript
// 5分後に処理開始 (例: 大量アップロード時のスロットリング)
const command = new SendMessageCommand({
  QueueUrl: PROCESSING_QUEUE_URL,
  MessageBody: JSON.stringify(message),
  DelaySeconds: 300, // 0〜900秒 (最大15分)
})
```

---

## キュー設定 (CDK で定義済み)

| 設定 | 値 | 理由 |
|------|-----|------|
| VisibilityTimeout | 16分 | Lambda 最大実行時間 (15分) + バッファ |
| MessageRetentionPeriod | 4日 | デフォルト |
| MaxReceiveCount | 3 | 3回失敗で DLQ へ |
| DLQ RetentionPeriod | 14日 | 手動確認用に長めに保持 |

---

## 環境変数

```env
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
SQS_PROCESSING_QUEUE_URL=https://sqs.ap-northeast-1.amazonaws.com/123456789012/hiravi-processing-queue
```

---

## 参考ドキュメントリンク

| トピック | URL |
|----------|-----|
| SendMessageCommand | https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-sqs/classes/sendmessagecommand.html |
| SQS API: SendMessage | https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_SendMessage.html |
| SQS + Lambda トリガー | https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html |
| JavaScript SDK v3 SQS 例 | https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_sqs_code_examples.html |
