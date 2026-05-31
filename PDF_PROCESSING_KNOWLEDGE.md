# PDF 処理 (PyMuPDF + pdf2image) ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://pymupdf.readthedocs.io/en/latest/the-basics.html
> - https://pymupdf.readthedocs.io/en/latest/recipes-text.html
> - https://pdf2image.readthedocs.io/en/latest/
> - https://github.com/Belval/pdf2image

---

## 概要

Lambda 内で PDF を処理する2つのライブラリ:
- **PyMuPDF (fitz)**: テキスト抽出 (高速、テキストレイヤー対応)
- **pdf2image**: PDF → 画像変換 (Ghostscript/Poppler 依存)

### Hiravi での処理パイプライン

```
S3 (PDF) → Lambda → 1. pdf2image で画像変換
                   → 2. PyMuPDF でテキスト抽出
                   → 3. Amazon Translate で翻訳
                   → 4. 結果を S3 + Aurora DSQL に保存
```

---

## PyMuPDF (fitz) — テキスト抽出

### インストール

```bash
pip install PyMuPDF
```

### 基本的なテキスト抽出

```python
import pymupdf  # PyMuPDF のインポート名

def extract_text_from_pdf(pdf_path: str) -> list[str]:
    """
    PDF の各ページからテキストを抽出
    
    Returns:
        ページごとのテキストリスト
    """
    doc = pymupdf.open(pdf_path)
    texts = []
    
    for page in doc:
        text = page.get_text()  # UTF-8 テキスト
        texts.append(text.strip())
    
    doc.close()
    return texts
```

### テキスト抽出オプション

```python
# プレーンテキスト (デフォルト)
text = page.get_text("text")

# ブロック単位 (位置情報付き)
blocks = page.get_text("blocks")
# [(x0, y0, x1, y1, "text", block_no, block_type), ...]

# 辞書形式 (詳細な構造情報)
data = page.get_text("dict")
# {"blocks": [{"type": 0, "bbox": [...], "lines": [...]}]}

# HTML 形式
html = page.get_text("html")

# Markdown 形式
md = page.get_text("markdown")
```

### テキストレイヤーの有無を判定

```python
def has_text_layer(pdf_path: str) -> bool:
    """PDF にテキストレイヤーがあるか判定"""
    doc = pymupdf.open(pdf_path)
    
    for page in doc:
        text = page.get_text().strip()
        if text:
            doc.close()
            return True
    
    doc.close()
    return False
```

### OCR フォールバック (テキストレイヤーなしの場合)

```python
def extract_text_with_ocr_fallback(pdf_path: str) -> list[str]:
    """
    テキストレイヤーからテキスト抽出。
    テキストがない場合は OCR にフォールバック。
    """
    doc = pymupdf.open(pdf_path)
    texts = []
    
    for page in doc:
        text = page.get_text().strip()
        
        if not text:
            # テキストレイヤーなし → OCR 実行
            # Tesseract が必要 (Lambda レイヤーで提供)
            tp = page.get_textpage_ocr()
            text = page.get_text(textpage=tp).strip()
        
        texts.append(text)
    
    doc.close()
    return texts
```

### ページ数の取得

```python
doc = pymupdf.open(pdf_path)
page_count = len(doc)  # or doc.page_count
doc.close()
```

### メタデータの取得

```python
doc = pymupdf.open(pdf_path)
metadata = doc.metadata
# {
#   'format': 'PDF 1.7',
#   'title': 'My Presentation',
#   'author': 'John Doe',
#   'subject': '',
#   'keywords': '',
#   'creator': 'Microsoft PowerPoint',
#   'producer': 'macOS Version 14.0',
#   'creationDate': "D:20240101120000+09'00'",
#   'modDate': "D:20240101120000+09'00'",
# }
doc.close()
```

---

## pdf2image — PDF → 画像変換

### インストール

```bash
pip install pdf2image
```

### 依存: Ghostscript または Poppler

Lambda では Ghostscript をレイヤーとして提供:
```
layers/ghostscript/
└── bin/
    └── gs  # Ghostscript バイナリ
```

### 基本的な変換

```python
from pdf2image import convert_from_path

def convert_pdf_to_images(
    pdf_path: str,
    output_dir: str = '/tmp',
    dpi: int = 200,
    fmt: str = 'webp'
) -> list[str]:
    """
    PDF の各ページを画像に変換
    
    Args:
        pdf_path: PDF ファイルパス
        output_dir: 出力ディレクトリ
        dpi: 解像度 (200 で十分な品質)
        fmt: 出力形式 ('webp', 'png', 'jpeg')
    
    Returns:
        生成された画像ファイルパスのリスト
    """
    images = convert_from_path(
        pdf_path,
        dpi=dpi,
        fmt=fmt,
        output_folder=output_dir,
        # Ghostscript のパス (Lambda レイヤー)
        # poppler_path='/opt/bin',  # Poppler を使う場合
    )
    
    image_paths = []
    for i, image in enumerate(images, start=1):
        image_path = f"{output_dir}/page-{i}.{fmt}"
        
        if fmt == 'webp':
            image.save(image_path, 'WEBP', quality=85)
        elif fmt == 'png':
            image.save(image_path, 'PNG')
        else:
            image.save(image_path, 'JPEG', quality=90)
        
        image_paths.append(image_path)
    
    return image_paths
```

### メモリ効率の良い変換 (大きな PDF 用)

```python
from pdf2image import convert_from_path

def convert_pdf_to_images_chunked(
    pdf_path: str,
    output_dir: str = '/tmp',
    dpi: int = 200,
    chunk_size: int = 5
) -> list[str]:
    """
    大きな PDF をチャンク単位で変換 (メモリ節約)
    Lambda のメモリ制限 (2048MB) を考慮
    """
    from pdf2image.pdf2image import pdfinfo_from_path
    
    info = pdfinfo_from_path(pdf_path)
    total_pages = info['Pages']
    
    image_paths = []
    
    for start_page in range(1, total_pages + 1, chunk_size):
        end_page = min(start_page + chunk_size - 1, total_pages)
        
        images = convert_from_path(
            pdf_path,
            dpi=dpi,
            first_page=start_page,
            last_page=end_page,
            fmt='webp',
        )
        
        for i, image in enumerate(images, start=start_page):
            image_path = f"{output_dir}/page-{i}.webp"
            image.save(image_path, 'WEBP', quality=85)
            image_paths.append(image_path)
            
        # メモリ解放
        del images
    
    return image_paths
```

---

## Lambda ハンドラー統合

```python
# lambda/processing/handler.py
import os
import json
import logging
import boto3
import pymupdf
from pdf2image import convert_from_path

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
BUCKET = os.environ['SLIDE_BUCKET_NAME']


def main(event, context):
    """SQS トリガーの Lambda ハンドラー"""
    for record in event.get('Records', []):
        body = json.loads(record['body'])
        process_deck(body)
    
    return {'statusCode': 200}


def process_deck(message: dict):
    deck_id = message['deck_id']
    file_key = message['file_key']
    target_languages = message['target_languages']
    original_language = message['original_language']
    version = message.get('version', 1)
    
    # 1. S3 から PDF ダウンロード
    pdf_path = f'/tmp/{deck_id}.pdf'
    s3.download_file(BUCKET, file_key, pdf_path)
    logger.info(f"Downloaded PDF: {file_key}")
    
    # 2. PDF → 画像変換
    image_keys = convert_and_upload(pdf_path, deck_id, version)
    logger.info(f"Generated {len(image_keys)} slide images")
    
    # 3. テキスト抽出
    texts = extract_texts(pdf_path)
    logger.info(f"Extracted text from {len(texts)} pages")
    
    # 4. 翻訳 (別モジュール)
    from translator import translate_pages
    pages = [{'page_number': i+1, 'text': t} for i, t in enumerate(texts)]
    translations = translate_pages(pages, original_language, target_languages, deck_id)
    
    # 5. DB 更新 + Vercel キャッシュ無効化
    update_database(deck_id, image_keys, texts, translations, version)
    
    # 6. クリーンアップ
    os.remove(pdf_path)
    for f in os.listdir('/tmp'):
        if f.startswith('page-'):
            os.remove(f'/tmp/{f}')


def convert_and_upload(pdf_path: str, deck_id: str, version: int) -> list[str]:
    """PDF → WebP 変換 → S3 アップロード"""
    images = convert_from_path(pdf_path, dpi=200, fmt='webp')
    image_keys = []
    
    for i, image in enumerate(images, start=1):
        local_path = f'/tmp/page-{i}.webp'
        image.save(local_path, 'WEBP', quality=85)
        
        s3_key = f'slides/public/{deck_id}/v{version}/page-{i}.webp'
        s3.upload_file(
            local_path, BUCKET, s3_key,
            ExtraArgs={'ContentType': 'image/webp'}
        )
        image_keys.append(s3_key)
        os.remove(local_path)
    
    return image_keys


def extract_texts(pdf_path: str) -> list[str]:
    """PDF テキストレイヤーからテキスト抽出"""
    doc = pymupdf.open(pdf_path)
    texts = []
    
    for page in doc:
        text = page.get_text().strip()
        # テキストレイヤーなしの場合は空文字
        # (OCR は将来版で対応)
        texts.append(text)
    
    doc.close()
    return texts


def update_database(deck_id, image_keys, texts, translations, version):
    """Aurora DSQL を更新"""
    # TODO: DsqlSigner でトークン取得 → psycopg2 で接続
    # slides テーブルに INSERT
    # translation_events テーブルに INSERT
    # decks.processing_status = 'ready' に UPDATE
    pass
```

---

## Lambda レイヤー構成

### requirements.txt

```
PyMuPDF==1.24.10
pdf2image==1.17.0
boto3==1.35.0
psycopg2-binary==2.9.9
```

### Ghostscript レイヤー

Lambda で pdf2image を使うには Ghostscript が必要。以下の方法で用意:

1. **公開レイヤーを使用** (推奨):
   ```
   arn:aws:lambda:ap-northeast-1:764866452798:layer:ghostscript:15
   ```

2. **自前ビルド** (Docker):
   ```dockerfile
   FROM amazonlinux:2023
   RUN yum install -y ghostscript
   RUN mkdir -p /opt/bin && cp /usr/bin/gs /opt/bin/
   ```

### Lambda 設定

| 設定 | 値 | 理由 |
|------|-----|------|
| Runtime | Python 3.12 | PyMuPDF 対応 |
| Architecture | x86_64 | Ghostscript バイナリ互換 |
| Memory | 2048 MB | PDF 画像変換は重い |
| Timeout | 15分 | 大きな PDF (100ページ超) 対応 |
| /tmp サイズ | 512 MB (デフォルト) | 画像一時保存用 |

---

## パフォーマンス目安

| PDF サイズ | ページ数 | 画像変換 | テキスト抽出 | 合計 |
|-----------|---------|---------|------------|------|
| 2 MB | 10 | ~5秒 | ~0.5秒 | ~6秒 |
| 5 MB | 20 | ~12秒 | ~1秒 | ~15秒 |
| 10 MB | 50 | ~30秒 | ~2秒 | ~35秒 |
| 20 MB | 100 | ~60秒 | ~4秒 | ~70秒 |

※ Lambda 2048MB メモリ、DPI=200、WebP 出力の場合

---

## エラーハンドリング

```python
import pymupdf
from pdf2image.exceptions import (
    PDFInfoNotInstalledError,
    PDFPageCountError,
    PDFSyntaxError,
)

def safe_process_pdf(pdf_path: str):
    """エラーハンドリング付き PDF 処理"""
    try:
        # テキスト抽出
        doc = pymupdf.open(pdf_path)
        if doc.is_encrypted:
            raise ValueError("Encrypted PDF is not supported")
        texts = [page.get_text().strip() for page in doc]
        doc.close()
        
    except pymupdf.FileDataError:
        raise ValueError("Invalid or corrupted PDF file")
    
    try:
        # 画像変換
        images = convert_from_path(pdf_path, dpi=200)
        
    except PDFInfoNotInstalledError:
        raise RuntimeError("Ghostscript/Poppler not installed")
    except PDFPageCountError:
        raise ValueError("Could not determine page count")
    except PDFSyntaxError:
        raise ValueError("PDF syntax error - file may be corrupted")
    
    return texts, images
```

---

## 参考ドキュメントリンク

| トピック | URL |
|----------|-----|
| PyMuPDF 基本 | https://pymupdf.readthedocs.io/en/latest/the-basics.html |
| PyMuPDF テキスト抽出 | https://pymupdf.readthedocs.io/en/latest/recipes-text.html |
| PyMuPDF OCR | https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html |
| pdf2image GitHub | https://github.com/Belval/pdf2image |
| pdf2image ドキュメント | https://pdf2image.readthedocs.io/en/latest/ |
| Lambda レイヤー (Ghostscript) | https://github.com/nicholasgasior/docker-lambda-ghostscript |
