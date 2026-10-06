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
# OCR (Amazon Textract) フォールバック。テキストレイヤーを持たない画像のみ PDF 用。
OCR_ENABLED = os.environ.get("OCR_ENABLED", "true").lower() not in ("false", "0", "no")
# 暴走防止のため OCR を実行するページ数の上限
OCR_MAX_PAGES = int(os.environ.get("OCR_MAX_PAGES", "100"))


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

            # 3b. オーバーレイ表示（B案）用のブロック生成
            #     元画像の上に訳文を元の位置で重ねるためのレイアウト情報。
            layout = extract_overlay_blocks(pdf_path)

            # 3c. テキストレイヤーが空のページは Textract OCR にフォールバック
            texts, layout = apply_ocr_fallback(pdf_path, texts, layout)

            # 4. 翻訳
            translations = translate_texts(texts, target_languages)
            layout = translate_overlay_blocks(layout, target_languages)

            # 5. DB 更新 (processing_status = 'ready')
            update_deck_status(
                deck_id, "ready", image_keys, texts, translations, layout
            )

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


def _median(values: list[float]) -> float:
    """numpy に依存しない中央値（空リストは 0.0）"""
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    mid = n // 2
    if n % 2 == 1:
        return float(s[mid])
    return (s[mid - 1] + s[mid]) / 2.0


def _sample_bg_color(img, x0: int, y0: int, x1: int, y1: int) -> str:
    """ブロック領域の外周リング（枠）の中央値色を背景色として推定。

    テキスト本体の色を拾わないよう、領域内側ではなく外周バンドのみを参照する。
    img は PIL.Image (RGB)、座標はピクセル。戻り値は "#rrggbb"。
    """
    W, H = img.size
    x0 = max(0, min(W - 1, int(x0)))
    y0 = max(0, min(H - 1, int(y0)))
    x1 = max(x0 + 1, min(W, int(x1)))
    y1 = max(y0 + 1, min(H, int(y1)))

    crop = img.crop((x0, y0, x1, y1))
    cw, ch = crop.size
    px = crop.load()

    # 外周バンドの厚み（領域の 1/8、最低 1px）
    bx = max(1, cw // 8)
    by = max(1, ch // 8)
    # 大きい領域でも安価に収まるよう間引きしてサンプリング
    step_x = max(1, cw // 64)
    step_y = max(1, ch // 64)

    rs: list[int] = []
    gs: list[int] = []
    bs: list[int] = []
    for yy in range(0, ch, step_y):
        for xx in range(0, cw, step_x):
            on_border = xx < bx or xx >= cw - bx or yy < by or yy >= ch - by
            if not on_border:
                continue
            pixel = px[xx, yy]
            rs.append(pixel[0])
            gs.append(pixel[1])
            bs.append(pixel[2])

    if not rs:
        pixel = px[0, 0]
        return "#%02x%02x%02x" % (pixel[0], pixel[1], pixel[2])

    def med_int(v: list[int]) -> int:
        v.sort()
        return v[len(v) // 2]

    return "#%02x%02x%02x" % (med_int(rs), med_int(gs), med_int(bs))


def extract_overlay_blocks(pdf_path: str) -> list[list[dict]]:
    """オーバーレイ表示（B案）用のブロック配列を抽出（原文のみ・未翻訳）。

    get_text("dict") でブロック/行/span を取得し、ブロックごとに
      - bbox（ページ幅/高さに対する 0..1 正規化）
      - fs（block 内 span サイズの中央値をページ高で正規化）
      - bg（レンダリング画像から外周リング中央値で推定した背景色）
      - t.original（原文）
    を生成する。

    テキストパネル用 extract_text_from_pdf とは役割を分離し、ここでは
    ページ番号ブロックのみ除外する（フッター/ヘッダーは本来の位置に重ねれば
    混乱しないため含める）。

    戻り値: ページごとのブロック配列 list[list[dict]]
    """
    import fitz  # PyMuPDF
    import re
    import PIL.Image

    PAGE_NUMBER_RE = re.compile(r"^\s*\d+\s*$")

    doc = fitz.open(pdf_path)
    pages_blocks: list[list[dict]] = []

    # 背景色サンプリング用の解像度。色の代表値（中央値）推定が目的なので
    # 高解像度は不要。低倍率にして CPU/メモリ消費を抑える（WebP 生成側は別途 2.0x）。
    BG_SAMPLE_SCALE = 0.5

    for page in doc:
        width = page.rect.width or 1.0
        height = page.rect.height or 1.0

        # 背景色サンプリング用に低解像度で 1 度だけレンダリング（画像生成とは別途）
        pix = page.get_pixmap(matrix=fitz.Matrix(BG_SAMPLE_SCALE, BG_SAMPLE_SCALE))
        img = PIL.Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        scale_x = pix.width / width
        scale_y = pix.height / height

        blocks: list[dict] = []
        for b in page.get_text("dict").get("blocks", []):
            if b.get("type", 0) != 0:  # テキストブロックのみ
                continue

            sizes: list[float] = []
            line_texts: list[str] = []
            for line in b.get("lines", []):
                spans = line.get("spans", [])
                line_text = "".join(s.get("text", "") for s in spans)
                if line_text.strip():
                    line_texts.append(line_text)
                for s in spans:
                    if s.get("text", "").strip():
                        sizes.append(float(s.get("size", 0.0)))

            text = "\n".join(line_texts).strip()
            if not text:
                continue
            # ページ番号ブロックのみ除外
            if PAGE_NUMBER_RE.match(text):
                continue

            x0, y0, x1, y1 = b["bbox"]
            # フォント高さをページ高で正規化（取得不能時は控えめな既定値）
            fs = (_median(sizes) / height) if sizes else 0.03
            bg = _sample_bg_color(
                img, x0 * scale_x, y0 * scale_y, x1 * scale_x, y1 * scale_y
            )

            blocks.append({
                "x0": round(x0 / width, 5),
                "y0": round(y0 / height, 5),
                "x1": round(x1 / width, 5),
                "y1": round(y1 / height, 5),
                "fs": round(fs, 5),
                "bg": bg,
                "t": {"original": text},
            })

        pages_blocks.append(blocks)
        # ページ数が多くてもメモリが累積しないよう明示的に解放
        img.close()
        pix = None

    doc.close()
    return pages_blocks


def apply_ocr_fallback(
    pdf_path: str, texts: list[str], layout: list[list[dict]]
) -> tuple[list[str], list[list[dict]]]:
    """テキストレイヤーが空のページに対し Amazon Textract で OCR フォールバック。

    extract_text_from_pdf / extract_overlay_blocks のどちらでも内容が
    取れなかったページのみを対象とし、同期 DetectDocumentText をページ画像
    （PNG。Textract は WebP 非対応・同期 API は 5MB 上限）に対して実行する。
    LINE ブロックを既存オーバーレイスキーマ（x0..y1 正規化 bbox / fs / bg /
    t.original）にマップし、テキストパネル用には読み順で連結した文字列を返す。

    ページ単位の失敗は警告ログのみで空のまま継続し、デッキ全体は failed にしない。
    """
    import re

    import boto3
    import fitz  # PyMuPDF
    import PIL.Image

    if not OCR_ENABLED:
        return texts, layout

    n_pages = max(len(texts), len(layout))
    empty_indices = [
        i
        for i in range(n_pages)
        if not (texts[i] if i < len(texts) else "").strip()
        and not (layout[i] if i < len(layout) else [])
    ]
    if not empty_indices:
        return texts, layout

    if len(empty_indices) > OCR_MAX_PAGES:
        logger.warning(
            f"OCR requested for {len(empty_indices)} pages exceeds "
            f"OCR_MAX_PAGES={OCR_MAX_PAGES}; truncating"
        )
        empty_indices = empty_indices[:OCR_MAX_PAGES]

    logger.info(f"Running Textract OCR on {len(empty_indices)} page(s)")
    textract = boto3.client("textract")
    PAGE_NUMBER_RE = re.compile(r"^\s*\d+\s*$")

    # 戻り値の長さをページ数に揃える（呼び出し側の i-1 インデックス前提のため）
    while len(texts) < n_pages:
        texts.append("")
    while len(layout) < n_pages:
        layout.append([])

    doc = fitz.open(pdf_path)
    for i in empty_indices:
        try:
            page = doc[i]

            # Textract 同期 API の上限 5MB を下回るまでレンダリング倍率を下げる
            png_bytes = None
            pix = None
            for scale in (2.0, 1.5, 1.0, 0.5):
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale))
                png_bytes = pix.tobytes("png")
                if len(png_bytes) <= 5 * 1024 * 1024:
                    break
            if len(png_bytes) > 5 * 1024 * 1024:
                logger.warning(f"Page {i + 1}: rendered image exceeds 5MB, skipping OCR")
                continue

            resp = textract.detect_document_text(Document={"Bytes": png_bytes})
            lines = [
                b
                for b in resp.get("Blocks", [])
                if b.get("BlockType") == "LINE" and b.get("Text", "").strip()
            ]
            # 読み順（上→下、左→右）にソート
            lines.sort(
                key=lambda b: (
                    b["Geometry"]["BoundingBox"]["Top"],
                    b["Geometry"]["BoundingBox"]["Left"],
                )
            )

            img = PIL.Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

            blocks: list[dict] = []
            line_texts: list[str] = []
            for b in lines:
                text = b["Text"].strip()
                if PAGE_NUMBER_RE.match(text):
                    continue
                bb = b["Geometry"]["BoundingBox"]
                x0, y0 = bb["Left"], bb["Top"]
                x1, y1 = x0 + bb["Width"], y0 + bb["Height"]
                # BoundingBox はページに対する 0..1 正規化。bg サンプリング用に
                # レンダリング画像のピクセル座標へ変換する
                bg = _sample_bg_color(
                    img, x0 * pix.width, y0 * pix.height,
                    x1 * pix.width, y1 * pix.height,
                )
                blocks.append({
                    "x0": round(x0, 5),
                    "y0": round(y0, 5),
                    "x1": round(x1, 5),
                    "y1": round(y1, 5),
                    "fs": round(bb["Height"], 5),
                    "bg": bg,
                    "t": {"original": text},
                })
                line_texts.append(text)

            layout[i] = blocks
            texts[i] = "\n".join(line_texts).strip()
            img.close()
        except Exception as e:
            logger.warning(f"Textract OCR failed on page {i + 1}: {e}")

    doc.close()
    return texts, layout


def translate_overlay_blocks(
    pages_blocks: list[list[dict]], target_languages: list[str]
) -> list[list[dict]]:
    """オーバーレイ用ブロックを言語×ブロック単位で並列翻訳。

    既存 translate_texts と同じ ThreadPool(50) パターンを流用。原文は
    t.original に格納済み。空文字や数字・記号のみのブロックは翻訳をスキップし
    原文をそのまま採用する（API 呼び出しの無駄打ちと誤訳を防ぐ）。
    """
    import boto3
    import re
    from concurrent.futures import ThreadPoolExecutor, as_completed

    # 数字・記号・空白のみ（翻訳しても意味がない）
    NON_TRANSLATABLE_RE = re.compile(r"^[\d\W_]+$")

    tasks: list[tuple[int, int, str, str]] = []
    for p_idx, blocks in enumerate(pages_blocks):
        for b_idx, blk in enumerate(blocks):
            original = blk["t"].get("original", "")
            stripped = original.strip()
            for lang in target_languages:
                if not stripped or NON_TRANSLATABLE_RE.match(stripped):
                    blk["t"][lang] = original
                    continue
                tasks.append((p_idx, b_idx, lang, original))

    if not tasks:
        return pages_blocks

    def translate_one(
        p_idx: int, b_idx: int, lang: str, text: str
    ) -> tuple[int, int, str, str]:
        # 個別ブロックの翻訳失敗（レート制限・一時的なネットワークエラー等）が
        # スライド処理全体を failed にしないよう、例外時は原文をフォールバック。
        try:
            client = boto3.client("translate")
            resp = client.translate_text(
                Text=text[:10000],
                SourceLanguageCode="auto",
                TargetLanguageCode=lang,
            )
            return p_idx, b_idx, lang, resp["TranslatedText"]
        except Exception as e:
            logger.warning(
                f"Overlay block translation failed (lang={lang}): {e}; "
                "falling back to original text"
            )
            return p_idx, b_idx, lang, text

    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = [
            executor.submit(translate_one, p_idx, b_idx, lang, text)
            for (p_idx, b_idx, lang, text) in tasks
        ]
        for future in as_completed(futures):
            p_idx, b_idx, lang, translated = future.result()
            pages_blocks[p_idx][b_idx]["t"][lang] = translated

    return pages_blocks


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
    layout: list[list[dict]] | None = None,
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
                    # オーバーレイ用ブロック配列（該当ページ。無ければ空配列）
                    slide_layout = (
                        layout[i - 1] if layout and i - 1 < len(layout) else []
                    )
                    # スライド本体（layout は JSONB。text→jsonb の明示キャストで保存）
                    cur.execute(
                        "INSERT INTO slides (deck_id, page_number, image_key, layout) "
                        "VALUES (%s, %s, %s, %s::jsonb) RETURNING id",
                        (deck_id, i, image_key, json.dumps(slide_layout))
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
