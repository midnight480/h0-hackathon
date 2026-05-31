"""
Hiravi Slide Processor Lambda

SQS からメッセージを受信し、以下の処理を実行:
1. S3 から PDF をダウンロード
2. PDF → 画像変換 (Ghostscript / pdf2image)
3. PDF テキストレイヤーからテキスト抽出
4. Amazon Translate で多言語翻訳
5. 結果を S3 + Aurora DSQL に保存
6. Vercel revalidateTag を Webhook で呼び出し
"""

import json
import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

SLIDE_BUCKET_NAME = os.environ.get("SLIDE_BUCKET_NAME", "")
DSQL_ENDPOINT = os.environ.get("DSQL_ENDPOINT", "")
DSQL_REGION = os.environ.get("DSQL_REGION", "ap-northeast-1")
VERCEL_REVALIDATE_URL = os.environ.get("VERCEL_REVALIDATE_URL", "")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def main(event, context):
    """SQS イベントハンドラー"""
    for record in event.get("Records", []):
        body = json.loads(record["body"])
        deck_id = body.get("deck_id")
        file_key = body.get("file_key")
        target_languages = body.get("target_languages", ["en"])

        logger.info(f"Processing deck_id={deck_id}, file_key={file_key}")

        try:
            # 1. S3 から PDF ダウンロード
            pdf_path = download_pdf(file_key)

            # 2. PDF → 画像変換
            image_keys = convert_pdf_to_images(pdf_path, deck_id)

            # 3. テキスト抽出
            texts = extract_text_from_pdf(pdf_path)

            # 4. 翻訳
            translations = translate_texts(texts, target_languages)

            # 5. DB 更新 (processing_status = 'ready')
            update_deck_status(deck_id, "ready", image_keys, texts, translations)

            # 6. Vercel キャッシュ無効化
            revalidate_vercel_cache(deck_id)

            logger.info(f"Successfully processed deck_id={deck_id}")

        except Exception as e:
            logger.error(f"Failed to process deck_id={deck_id}: {e}")
            # processing_status = 'failed' に更新
            try:
                update_deck_status(deck_id, "failed")
            except Exception:
                pass
            raise  # SQS リトライのために例外を再送出

    return {"statusCode": 200}


def download_pdf(file_key: str) -> str:
    """S3 から PDF をダウンロード"""
    import boto3

    s3 = boto3.client("s3")
    local_path = f"/tmp/{os.path.basename(file_key)}"
    s3.download_file(SLIDE_BUCKET_NAME, file_key, local_path)
    return local_path


def convert_pdf_to_images(pdf_path: str, deck_id: str) -> list[str]:
    """PDF を画像に変換して S3 にアップロード"""
    import boto3
    from pdf2image import convert_from_path

    s3 = boto3.client("s3")
    images = convert_from_path(pdf_path, dpi=200, fmt="webp")
    image_keys = []

    for i, image in enumerate(images, start=1):
        image_path = f"/tmp/page-{i}.webp"
        image.save(image_path, "WEBP", quality=85)

        # 公開デッキ用パス (OGP 対応)
        s3_key = f"slides/public/{deck_id}/v1/page-{i}.webp"
        s3.upload_file(
            image_path,
            SLIDE_BUCKET_NAME,
            s3_key,
            ExtraArgs={"ContentType": "image/webp"},
        )
        image_keys.append(s3_key)
        os.remove(image_path)

    return image_keys


def extract_text_from_pdf(pdf_path: str) -> list[str]:
    """PDF テキストレイヤーからテキスト抽出"""
    import fitz  # PyMuPDF

    doc = fitz.open(pdf_path)
    texts = []
    for page in doc:
        text = page.get_text().strip()
        texts.append(text)
    doc.close()
    return texts


def translate_texts(
    texts: list[str], target_languages: list[str]
) -> dict[str, list[str]]:
    """Amazon Translate でテキスト翻訳"""
    import boto3

    translate = boto3.client("translate")
    translations: dict[str, list[str]] = {}

    for lang in target_languages:
        translations[lang] = []
        for text in texts:
            if not text:
                translations[lang].append("")
                continue
            response = translate.translate_text(
                Text=text[:10000],  # Translate API の文字数制限
                SourceLanguageCode="auto",
                TargetLanguageCode=lang,
            )
            translations[lang].append(response["TranslatedText"])

    return translations


def update_deck_status(
    deck_id: str,
    status: str,
    image_keys: list[str] | None = None,
    texts: list[str] | None = None,
    translations: dict[str, list[str]] | None = None,
):
    """Aurora DSQL のデッキステータスを更新"""
    # TODO: Aurora DSQL 接続実装
    # DsqlSigner でトークン取得 → psycopg2 で接続
    logger.info(f"Updating deck {deck_id} status to {status}")
    pass


def revalidate_vercel_cache(deck_id: str):
    """Vercel の revalidateTag を Webhook で呼び出し"""
    import urllib.request

    if not VERCEL_REVALIDATE_URL or not WEBHOOK_SECRET:
        logger.warning("Vercel revalidation not configured, skipping")
        return

    data = json.dumps({"deck_id": deck_id}).encode("utf-8")
    req = urllib.request.Request(
        VERCEL_REVALIDATE_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Secret": WEBHOOK_SECRET,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(f"Revalidation response: {resp.status}")
    except Exception as e:
        logger.warning(f"Revalidation failed (non-critical): {e}")
