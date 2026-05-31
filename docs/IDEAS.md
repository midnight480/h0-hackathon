# アイデアメモ

## 採用: アイデア4 — スライド共有 + 英訳プラットフォーム

→ PROMPT.md で詳細化

---

## 保留アイデア

### アイデア1: 佐賀バスナビ刷新
- 既存: https://saga-bus.midnight480.com/
- 佐賀県内バスの Opendata を取り込み、リアルタイム位置表示 + ナビゲーション
- DB: Aurora PostgreSQL (PostGIS で地理空間クエリ)
- Track: B2C or Open Innovation
- 課題: 地域限定で Impact が弱い

### アイデア2: Backlog CI/CD ツール
- Backlog Git の Webhook 受信 → DynamoDB でマルチテナント管理
- キーごとにデプロイ先管理、AWS CodePipeline で Build/Deploy
- 自アカウントに構築するテンプレート提供
- DB: DynamoDB
- Track: B2B
- 課題: デモ映えしにくい、CI/CD は競合多い

### アイデア3: キーワード → スライド自動生成
- Genspark / Manus のように、キーワード入力 → スライド生成 → 共有
- DB: Aurora DSQL or DynamoDB
- Track: B2C or Open Innovation
- 課題: AI 生成系は競合多い、DB 活用の説明が薄くなりがち
