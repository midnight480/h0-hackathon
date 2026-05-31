# Amazon Translate ナレッジまとめ (H0 ハッカソン向け)

> ソース:
> - https://docs.aws.amazon.com/translate/latest/dg/what-is.html
> - https://docs.aws.amazon.com/translate/latest/dg/sync-api.html
> - https://docs.aws.amazon.com/translate/latest/dg/what-is-languages.html
> - https://docs.aws.amazon.com/translate/latest/dg/what-is-limits.html
> - https://docs.aws.amazon.com/translate/latest/dg/examples-python.html
> - https://docs.aws.amazon.com/translate/latest/APIReference/API_TranslateText.html

---

## Amazon Translate とは

機械学習ベースのテキスト翻訳サービス。75言語対応、リアルタイム翻訳、低コスト。

### Hiravi での利用方針
- Lambda 内で PDF テキストを多言語翻訳
- ソース言語は自動検出 (`auto`) または著者指定
- 翻訳結果は Aurora DSQL にキャッシュ (再翻訳不要)
- スライド画像は一切改変しない (翻訳テキストは別レイヤー表示)

---

## API: TranslateText

### リクエストパラメータ

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| Text | string | ✅ | 翻訳対象テキスト (最大 10,000 バイト) |
| SourceLanguageCode | string | ✅ | ソース言語コード (`auto` で自動検出) |
| TargetLanguageCode | string | ✅ | ターゲット言語コード |
| TerminologyNames | string[] | ❌ | カスタム用語集 |
| Settings | object | ❌ | 敬語設定、不適切表現マスク等 |

### レスポンス

```json
{
  "TranslatedText": "翻訳されたテキスト",
  "SourceLanguageCode": "ja",
  "TargetLanguageCode": "en",
  "AppliedTerminologies": [],
  "AppliedSettings": {}
}
```

---

## Python (boto3) での使用

### 基本的な翻訳

```python
import boto3

translate = boto3.client(
    service_name='translate',
    region_name='ap-northeast-1',
    use_ssl=True
)

response = translate.translate_text(
    Text='こんにちは、世界',
    SourceLanguageCode='ja',
    TargetLanguageCode='en'
)

print(response['TranslatedText'])  # "Hello, world"
```

### 自動言語検出

```python
response = translate.translate_text(
    Text='Bonjour le monde',
    SourceLanguageCode='auto',  # 自動検出
    TargetLanguageCode='en'
)

print(response['SourceLanguageCode'])  # "fr" (検出された言語)
print(response['TranslatedText'])      # "Hello world"
```

### バッチ翻訳 (Hiravi Lambda 用)

```python
def translate_slide_texts(
    texts: list[str],
    source_lang: str,
    target_languages: list[str]
) -> dict[str, list[str]]:
    """
    スライドテキストを複数言語に翻訳
    
    Args:
        texts: ページごとのテキストリスト
        source_lang: ソース言語コード (例: 'ja')
        target_languages: ターゲット言語コードリスト (例: ['en', 'zh'])
    
    Returns:
        { 'en': ['page1 translation', ...], 'zh': ['page1 translation', ...] }
    """
    translate = boto3.client('translate', region_name='ap-northeast-1')
    results: dict[str, list[str]] = {}

    for lang in target_languages:
        results[lang] = []
        for text in texts:
            if not text or not text.strip():
                results[lang].append('')
                continue

            # 10,000 バイト制限に対応
            truncated = text[:10000]

            try:
                response = translate.translate_text(
                    Text=truncated,
                    SourceLanguageCode=source_lang,  # 'auto' も可
                    TargetLanguageCode=lang
                )
                results[lang].append(response['TranslatedText'])
            except translate.exceptions.UnsupportedLanguagePairException:
                # 未対応言語ペアの場合はスキップ
                results[lang].append(f'[Translation not available for {lang}]')
            except Exception as e:
                results[lang].append(f'[Translation error: {str(e)}]')

    return results
```

### エラーハンドリング

```python
from botocore.exceptions import ClientError

try:
    response = translate.translate_text(
        Text=text,
        SourceLanguageCode='auto',
        TargetLanguageCode='en'
    )
except ClientError as e:
    error_code = e.response['Error']['Code']
    if error_code == 'TextSizeLimitExceededException':
        # テキストが 10,000 バイトを超えた
        pass
    elif error_code == 'UnsupportedLanguagePairException':
        # 未対応の言語ペア
        pass
    elif error_code == 'TooManyRequestsException':
        # レート制限超過 → リトライ
        pass
    elif error_code == 'InternalServerException':
        # AWS 内部エラー → リトライ
        pass
    raise
```

---

## TypeScript (AWS SDK v3) での使用

Vercel Server Actions から直接翻訳する場合 (追加翻訳リクエスト等):

```typescript
// lib/translate.ts
import {
  TranslateClient,
  TranslateTextCommand,
} from '@aws-sdk/client-translate'

const translateClient = new TranslateClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const command = new TranslateTextCommand({
    Text: text.slice(0, 10000), // 10,000 バイト制限
    SourceLanguageCode: sourceLang,
    TargetLanguageCode: targetLang,
  })

  const response = await translateClient.send(command)
  return response.TranslatedText ?? ''
}
```

---

## 対応言語コード (Hiravi で使用するもの)

| 言語 | コード | Hiravi での位置づけ |
|------|--------|-------------------|
| 日本語 | `ja` | デフォルトソース言語 |
| 英語 | `en` | 必須ターゲット (ソースが英語の場合は日本語が必須) |
| 中国語 (簡体字) | `zh` | 任意ターゲット |
| 中国語 (繁体字) | `zh-TW` | 任意ターゲット |
| スペイン語 | `es` | 任意ターゲット |
| フランス語 | `fr` | 任意ターゲット |
| ポルトガル語 | `pt` | 任意ターゲット |
| 韓国語 | `ko` | 任意ターゲット |
| アラビア語 | `ar` | 任意ターゲット |
| ロシア語 | `ru` | 任意ターゲット |
| イタリア語 | `it` | 任意ターゲット |
| ドイツ語 | `de` | 任意ターゲット |

### 自動検出 (`auto`)
- ソース言語に `auto` を指定すると Amazon Comprehend で言語検出
- 追加料金が発生する場合あり
- レスポンスの `SourceLanguageCode` に検出結果が返る

---

## クォータ・制限

| 項目 | 制限値 |
|------|--------|
| TranslateText テキストサイズ | 最大 10,000 バイト (UTF-8) |
| TranslateDocument ドキュメントサイズ | 最大 100,000 バイト |
| TranslateDocument 文字数 | 最大 100,000 文字 |
| リアルタイム翻訳 TPS | デフォルト: リージョンにより異なる (通常 20 TPS) |
| バッチ翻訳ジョブ同時実行 | 10 |
| 文字エンコーディング | UTF-8 |

### TPS 制限への対応 (Lambda 内)

```python
import time
from botocore.config import Config

# リトライ設定
config = Config(
    retries={
        'max_attempts': 3,
        'mode': 'adaptive'  # 適応型リトライ (バックオフ自動調整)
    }
)

translate = boto3.client('translate', config=config)
```

---

## コスト

| 項目 | 料金 |
|------|------|
| 翻訳文字数 | $15.00 / 100万文字 |
| 自動言語検出 | 追加料金なし (Translate 経由の場合) |
| 無料枠 (最初の12ヶ月) | 200万文字/月 |

### Hiravi のコスト試算
- 300 デッキ/月 × 20 ページ × 200 文字 × 2 言語 = 2,400,000 文字/月
- 月額: 約 $36 (無料枠超過後)
- AWS クレジット $100 で約 2.5 ヶ月分

---

## 設定オプション

### 敬語 (Formality)

```python
response = translate.translate_text(
    Text='Hello, how are you?',
    SourceLanguageCode='en',
    TargetLanguageCode='ja',
    Settings={
        'Formality': 'FORMAL'  # 'FORMAL' or 'INFORMAL'
    }
)
```

対応言語: de, en, es, fr, hi, it, ja, ko, nl, pt-BR, zh

### 不適切表現マスク

```python
response = translate.translate_text(
    Text='...',
    SourceLanguageCode='en',
    TargetLanguageCode='ja',
    Settings={
        'Profanity': 'MASK'  # 不適切表現を ??? でマスク
    }
)
```

### Do-Not-Translate タグ

```python
# <span translate="no">...</span> で囲んだ部分は翻訳されない
text = 'Welcome to <span translate="no">Hiravi</span> platform'
response = translate.translate_text(
    Text=text,
    SourceLanguageCode='en',
    TargetLanguageCode='ja'
)
# → "Hiravi プラットフォームへようこそ" (Hiravi はそのまま)
```

---

## Lambda ハンドラーでの統合パターン

```python
# lambda/processing/translator.py
import boto3
import logging
from botocore.config import Config

logger = logging.getLogger()

config = Config(
    retries={'max_attempts': 3, 'mode': 'adaptive'}
)
translate_client = boto3.client('translate', config=config)


def translate_pages(
    pages: list[dict],
    source_lang: str,
    target_languages: list[str],
    deck_id: str
) -> dict[str, list[str]]:
    """
    全ページのテキストを指定言語に翻訳
    
    Args:
        pages: [{'page_number': 1, 'text': '...'}, ...]
        source_lang: 'ja' | 'en' | 'auto'
        target_languages: ['en', 'zh', 'es']
        deck_id: ログ用
    
    Returns:
        {'en': ['page1', 'page2', ...], 'zh': [...]}
    """
    translations = {}

    for lang in target_languages:
        # ソース言語と同じ場合はスキップ
        if lang == source_lang:
            continue

        translations[lang] = []
        for page in pages:
            text = page.get('text', '').strip()
            if not text:
                translations[lang].append('')
                continue

            try:
                response = translate_client.translate_text(
                    Text=text[:10000],
                    SourceLanguageCode=source_lang,
                    TargetLanguageCode=lang,
                    Settings={'Formality': 'FORMAL'}
                )
                translations[lang].append(response['TranslatedText'])
            except Exception as e:
                logger.warning(
                    f"Translation failed: deck={deck_id}, "
                    f"page={page['page_number']}, lang={lang}: {e}"
                )
                translations[lang].append('')

    return translations
```

---

## 参考ドキュメントリンク

| トピック | URL |
|----------|-----|
| Amazon Translate 概要 | https://docs.aws.amazon.com/translate/latest/dg/what-is.html |
| リアルタイム翻訳 API | https://docs.aws.amazon.com/translate/latest/dg/sync-api.html |
| TranslateText API リファレンス | https://docs.aws.amazon.com/translate/latest/APIReference/API_TranslateText.html |
| 対応言語一覧 | https://docs.aws.amazon.com/translate/latest/dg/what-is-languages.html |
| クォータ・制限 | https://docs.aws.amazon.com/translate/latest/dg/what-is-limits.html |
| Python (boto3) サンプル | https://docs.aws.amazon.com/translate/latest/dg/examples-python.html |
| カスタム用語集 | https://docs.aws.amazon.com/translate/latest/dg/using-ct.html |
| バッチ翻訳 | https://docs.aws.amazon.com/translate/latest/dg/async.html |
