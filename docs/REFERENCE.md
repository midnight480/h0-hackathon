# H0 Hackathon 参考情報まとめ

> ソース: https://h01.devpost.com/ / https://h01.devpost.com/rules

---

## 概要

| 項目 | 内容 |
|------|------|
| 名称 | H0: Hack the Zero Stack with Vercel v0 and AWS Databases |
| スポンサー | Amazon Web Services (AWS) |
| 管理 | Devpost, Inc. |
| 形式 | オンライン |
| 賞金総額 | $80,000 (現金) + $80,000 (AWS クレジット) |
| 参加者数 | 1,205人以上 (2026/5/30時点) |
| テーマ | Databases / Open Ended / Web |

---

## スケジュール

| フェーズ | 期間 |
|----------|------|
| 登録・提出期間 | 2026年5月27日 11:00 PT ～ 6月29日 17:00 PT |
| 審査期間 | 2026年6月30日 10:00 PT ～ 7月24日 17:00 PT |
| 結果発表 | 2026年7月31日頃 14:00 PT |
| **締切 (日本時間)** | **2026年6月30日 9:00 AM JST** |

---

## 技術スタック要件

### 必須
- **フロントエンド**: Vercel v0 で Next.js をスキャフォールド → Vercel にデプロイ
- **バックエンド/DB**: 以下の AWS Database のいずれか1つ以上を使用
  - Amazon Aurora PostgreSQL
  - Amazon Aurora DSQL
  - Amazon DynamoDB

### 開始手順
1. AWS アカウント作成 (https://aws.amazon.com/free/)
2. Vercel / v0 アカウント作成 (https://vercel.com/signup)
3. クレジット申請フォーム提出 → AWS $100 + v0 $30 のクレジット取得
4. AWS Database をプロビジョニング
5. v0 でビルド → デプロイ → 提出

---

## トラック (4つから1つ選択)

| Track | 内容 | 対象業界例 |
|-------|------|-----------|
| Track 1: Monetizable B2C App | 消費者向けアプリ | EC、旅行、小売、ホスピタリティ |
| Track 2: Monetizable B2B App | 企業向けアプリ | 金融、テクノロジー、ヘルスケア、保険、マーケティング |
| Track 3: Million-scale Global App | 100万ユーザー規模のアプリ | ゲーム、SNS、エンタメ |
| Track 4: Open Innovation | 自由テーマ | 何でもOK |

---

## 提出物 (Submission Requirements)

### 必須
1. **テキスト説明** - 使用した AWS Database の記載
2. **デモ動画** (3〜5分、YouTube推奨)
   - 解決する課題、対象ユーザー、課題を選んだ理由
   - 動作するアプリのフッテージ
   - 使用した AWS Database の説明
3. **Vercel プロジェクトリンク & Vercel Team ID**
4. **アーキテクチャ図** - アプリとバックエンドコンポーネントの接続を示す
5. **スクリーンショット** - v0/Vercel の Storage Configuration (AWS DB 使用の証明)

### オプション (ボーナスポイント: 最大 +0.6点)
- ブログ/ポッドキャスト/動画を公開 (builder.aws.com, LinkedIn, Medium, dev.to, YouTube 等)
- 1コンテンツにつき +0.2点 (最大3つ = +0.6)
- 「このハッカソンのために作成した」旨を明記
- ハッシュタグ: **#H0Hackathon**

---

## 審査基準 (均等配分)

| 基準 | 観点 |
|------|------|
| **Technical Implementation** | ソフトウェアクラフトマンシップ、DB統合の意図的な設計、アーキテクチャの質 |
| **Design** | UXの直感性、フロントエンドとバックエンドの一貫性、フルスタック思考 |
| **Impact & Real-world Applicability** | 実際の課題解決、スケーラブルなインフラの活用、出荷可能性 |
| **Originality** | コンセプトの創造性、スタックの可能性への洞察、実装の革新性 |

### 審査プロセス
- **Stage 1**: Pass/Fail - テーマ適合性と必須API/SDK使用の確認 (AI支援あり)
- **Stage 2**: 上記4基準で採点 (1〜5点) + ボーナス (最大0.6) → 最終スコア 1〜5.6

---

## 賞金構成

| 賞 | 現金 | AWS クレジット |
|----|------|---------------|
| 各トラック 1位 (×4) | $10,000 | $10,000 |
| 各トラック 2位 (×4) | $5,000 | $5,000 |
| 各トラック 3位 (×4) | $3,000 | $3,000 |
| Best Technical Implementation | $2,000 | $2,000 |
| Best Design | $2,000 | $2,000 |
| Most Impactful | $2,000 | $2,000 |
| Most Original | $2,000 | $2,000 |

※ 1プロジェクトにつき受賞は1つまで

---

## 参加資格

### OK
- 居住国で成人年齢以上の個人
- チーム (人数制限なし)
- 法人・組織

### NG (参加不可の国・地域)
アルゼンチン、イタリア、フィリピン、タイ、ベトナム、シリア、ブラジル、ケベック、ロシア、クリミア、キューバ、イラン、北朝鮮 等

→ **日本からの参加は可能**

---

## プロジェクト要件の注意点

- 新規作成 or 既存プロジェクトの場合は提出期間中に AWS DB + Vercel 統合を追加
- サードパーティ SDK/API の使用可 (ライセンス遵守)
- オープンソースの使用可 (ライセンス遵守 + 独自の機能追加が必要)
- テスト用アクセスを提供する必要あり (ログイン情報含む)
- 提出物は英語 (英語以外の場合は英訳を添付)
- 複数提出可 (ただし各提出は実質的に異なる必要あり)

---

## 審査員

| 名前 | 役職 |
|------|------|
| Joseph Idziorek | Director, Product Management, AWS Databases |
| Abhinav Anand | Technical Product Marketing, AWS |
| Karthik Vijayraghavan | Sr Manager, NoSQL Solutions Architects, AWS |
| Aditya Samant | Principal Database Specialist Solutions Architect, AWS Databases |

---

## PROMPT.md 作成に向けたメモ

### 勝つためのポイント (審査基準から逆算)
1. **DB設計を意図的に**: 単にDBを繋ぐだけでなく、データモデル・スキーマ・クエリ設計に明確な理由を持つ
2. **出荷可能なレベル**: デモではなく実際にプロダクションで使えるクオリティ
3. **フルスタック思考**: フロントとバックの一貫性、UXとデータ層の連携
4. **スケーラビリティ**: 特にTrack 3を選ぶ場合、アーキテクチャ図でスケール設計を示す
5. **ボーナスコンテンツ**: 3本公開で+0.6点は大きい (最終スコア5.6中)

### 技術選定の考慮事項
- v0 で Next.js をスキャフォールド → カスタマイズ
- Aurora PostgreSQL: リレーショナルデータに強い、SQL対応
- Aurora DSQL: 分散SQL、グローバルスケール向き (Track 3に最適)
- DynamoDB: NoSQL、高スループット、ゲーム/リアルタイム向き

### 締切までの残り時間
- 約31日 (2026/5/30時点)
- クレジット申請締切: 6月26日 12:00 PT (先着順)
