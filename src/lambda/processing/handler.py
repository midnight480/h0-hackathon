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
    """PDF を画像に変換して S3 にアップロード (PyMuPDF 使用)"""
    import boto3
    import fitz  # PyMuPDF

    s3 = boto3.client("s3")
    doc = fitz.open(pdf_path)
    image_keys = []

    for i, page in enumerate(doc, start=1):
        # 高解像度でレンダリング (2.0 = 144 DPI, 3.0 = 216 DPI)
        pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
        image_path = f"/tmp/page-{i}.webp"
        
        # WebP として保存
        import PIL.Image
        img = PIL.Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        img.save(image_path, "WEBP", quality=85)

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

    doc.close()
    return image_keys


def extract_text_from_pdf(pdf_path: str) -> list[str]:
    """PDF テキストレイヤーからテキスト抽出

    各ページを bbox 付きブロック (get_text("blocks")) として読み込み、
    ページ番号・running footer/header などのノイズを翻訳前に除外する。
    戻り値は従来どおり「スライドごとの連結テキスト (list[str])」。

    除外ルール（保守的に倒す = 本文を消すよりノイズが少し残る方を許容）:
      1. ページ番号: ブロック text が ^\\s*\\d+\\s*$ に一致 → 除外
      2. running footer/header: 正規化テキスト（空白・数字を除去）が同一かつ
         上端/下端ゾーンに出現するブロックが、総ページ数の50%以上に登場 → 除外
      3. 位置ゾーン補助: ゾーン（下端12% / 上端8%）は単独判定に使わず、
         必ずルール2と併用（本文を消さないため）
    """
    import fitz  # PyMuPDF
    import re

    PAGE_NUMBER_RE = re.compile(r"^\s*\d+\s*$")
    TOP_ZONE = 0.08      # 上端 8%
    BOTTOM_ZONE = 0.88   # 下端 12% (= y >= 0.88)

    def normalize(t: str) -> str:
        # 空白・数字を除去して比較（ページごとに変わる番号を吸収）
        return re.sub(r"[\s\d]+", "", t)

    doc = fitz.open(pdf_path)

    # 1) 全ページの blocks を収集。bbox はページ高/幅に対する割合に正規化
    pages_blocks: list[list[dict]] = []
    for page in doc:
        width = page.rect.width or 1.0
        height = page.rect.height or 1.0
        blocks: list[dict] = []
        for b in page.get_text("blocks"):
            # (x0, y0, x1, y1, text, block_no, block_type)
            x0, y0, x1, y1, text, _block_no, block_type = b
            if block_type != 0:  # テキストブロック (0) のみ対象
                continue
            text = text.strip()
            if not text:
                continue
            blocks.append({
                "x0": x0 / width,
                "y0": y0 / height,
                "x1": x1 / width,
                "y1": y1 / height,
                "text": text,
            })
        pages_blocks.append(blocks)

    total_pages = len(pages_blocks)

    # 2) 横断パスで「除外ブロック集合」を確定（running footer/header）
    #    正規化テキスト → 上端/下端ゾーンに出現したページ番号の集合
    zone_text_pages: dict[str, set[int]] = {}
    for page_idx, blocks in enumerate(pages_blocks):
        for blk in blocks:
            in_zone = blk["y0"] <= TOP_ZONE or blk["y1"] >= BOTTOM_ZONE
            if not in_zone:
                continue
            key = normalize(blk["text"])
            if not key:
                continue
            zone_text_pages.setdefault(key, set()).add(page_idx)

    # 総ページ数の50%以上。小規模デッキでの誤検出を避けるため最低2ページを要求
    threshold = max(2, (total_pages + 1) // 2)
    running_keys = {
        key for key, pages in zone_text_pages.items()
        if len(pages) >= threshold
    }

    # 3) 各ページ：除外対象でないブロックのみ読み順 (y0, x0) 昇順で連結
    texts: list[str] = []
    for blocks in pages_blocks:
        kept: list[dict] = []
        for blk in blocks:
            text = blk["text"]
            # ルール1: ページ番号
            if PAGE_NUMBER_RE.match(text):
                continue
            # ルール2+3: running footer/header（ゾーン内 AND 横断一致）
            in_zone = blk["y0"] <= TOP_ZONE or blk["y1"] >= BOTTOM_ZONE
            if in_zone and normalize(text) in running_keys:
                continue
            kept.append(blk)
        # blocks は読み順とは限らないため bbox (y0, x0) でソートしてから連結
        kept.sort(key=lambda b: (b["y0"], b["x0"]))
        texts.append("\n".join(b["text"] for b in kept).strip())

    doc.close()
    return texts


def translate_texts(
    texts: list[str], target_languages: list[str]
) -> dict[str, list[str]]:
    """Amazon Translate でテキスト翻訳（言語×スライドを並列実行）"""
    import boto3
    from concurrent.futures import ThreadPoolExecutor, as_completed

    # スレッドセーフのため言語ごとにクライアントを使い回さない
    def translate_one(lang: str, idx: int, text: str) -> tuple[str, int, str]:
        if not text:
            return lang, idx, ""
        client = boto3.client("translate")
        resp = client.translate_text(
            Text=text[:10000],
            SourceLanguageCode="auto",
            TargetLanguageCode=lang,
        )
        return lang, idx, resp["TranslatedText"]

    # (lang, slide_idx) のタスクリストを構築
    tasks = [
        (lang, idx, text)
        for lang in target_languages
        for idx, text in enumerate(texts)
    ]

    results: dict[str, list[str]] = {lang: [""] * len(texts) for lang in target_languages}

    # 最大50スレッドで並列実行（Translate API は 500 req/s 制限があるため制御）
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(translate_one, lang, idx, text): (lang, idx) for lang, idx, text in tasks}
        for future in as_completed(futures):
            lang, idx, translated = future.result()
            results[lang][idx] = translated

    return results


def update_deck_status(
    deck_id: str,
    status: str,
    image_keys: list[str] | None = None,
    texts: list[str] | None = None,
    translations: dict[str, list[str]] | None = None,
):
    """Aurora DSQL のデッキステータスと処理結果を更新"""
    from aurora_dsql_psycopg import connect
    import time
    import random

    logger.info(f"Updating deck {deck_id} status to {status}")

    max_retries = 5
    for attempt in range(max_retries):
        try:
            # 1. 接続
            conn = connect(
                host=DSQL_ENDPOINT,
                region=DSQL_REGION,
                user="admin"
            )
            cur = conn.cursor()

            # 2. デッキ基本情報の更新
            # image_keys[0] をカバー画像として使用
            cover_image_key = image_keys[0] if image_keys else None
            slide_count = len(image_keys) if image_keys else 0

            cur.execute(
                """
                UPDATE decks 
                SET status = %s, cover_image_key = %s, slide_count = %s, updated_at = NOW() 
                WHERE id = %s
                """,
                (status, cover_image_key, slide_count, deck_id)
            )

            # ステータスが 'ready' の場合のみ、スライドとテキストの情報を保存
            if status == "ready" and image_keys:
                # 既存のスライド情報を削除 (リトライ等での重複防止)
                cur.execute("DELETE FROM slide_texts WHERE slide_id IN (SELECT id FROM slides WHERE deck_id = %s)", (deck_id,))
                cur.execute("DELETE FROM slides WHERE deck_id = %s", (deck_id,))

                # 3. スライドとテキストの保存
                for i, image_key in enumerate(image_keys, start=1):
                    # スライド本体
                    cur.execute(
                        "INSERT INTO slides (deck_id, page_number, image_key) VALUES (%s, %s, %s) RETURNING id",
                        (deck_id, i, image_key)
                    )
                    slide_id = cur.fetchone()[0]

                    # 原文
                    original_text = texts[i-1] if texts and i-1 < len(texts) else ""
                    cur.execute(
                        "INSERT INTO slide_texts (slide_id, language_code, content) VALUES (%s, %s, %s)",
                        (slide_id, "original", original_text)
                    )

                    # 翻訳文
                    if translations:
                        for lang, lang_texts in translations.items():
                            trans_text = lang_texts[i-1] if i-1 < len(lang_texts) else ""
                            cur.execute(
                                "INSERT INTO slide_texts (slide_id, language_code, content) VALUES (%s, %s, %s)",
                                (slide_id, lang, trans_text)
                            )

            conn.commit()
            cur.close()
            conn.close()
            logger.info(f"Successfully updated DB for deck_id={deck_id}")
            break

        except Exception as e:
            # シリアライゼーションエラー (OCC 競合) の場合はリトライ
            if hasattr(e, 'pgcode') and e.pgcode == '40001':
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) + (random.random() * 0.1)
                    logger.warning(f"Serialization error (40001), retrying in {wait_time:.2f}s... (attempt {attempt+1})")
                    time.sleep(wait_time)
                    continue
            
            logger.error(f"Failed to update DB for deck_id={deck_id}: {e}")
            if 'conn' in locals() and conn:
                conn.rollback()
                conn.close()
            raise


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
