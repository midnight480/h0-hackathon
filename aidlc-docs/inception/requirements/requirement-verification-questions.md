# 要件分析質問票

ご依頼のプロジェクト説明文（英語）のドラフト作成と、今後の開発を進めるための確認事項です。

## Question 1: プロジェクト説明文（英語）の選択
ハッカソンの `PROMPT.md` に記載する説明文のドラフトです。最適なものを選んでいただくか、修正案を教えてください。

A) **Draft A (Direct)**: We are building Hiravi for Track 3, a global slide-sharing platform that instantly translates PDFs into 75+ languages using Amazon Translate. It leverages Aurora DSQL's multi-region active-active architecture to provide low-latency, globally consistent access for users worldwide.
B) **Draft B (Value-oriented)**: Hiravi addresses global knowledge barriers for Track 3 by transforming PDF slides into web-native, multi-language presentations without altering the original design. Powered by Aurora DSQL and AWS Lambda, it ensures seamless scalability and high availability for a million-scale global audience.
C) **Draft C (Short)**: For Track 3, we are developing Hiravi, a serverless platform that provides instant multi-language translation for uploaded slides. By utilizing Aurora DSQL, it offers a globally distributed, serializable database solution to support high-concurrency sharing and viewing across regions.
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2: セキュリティ拡張機能（Security Baseline）の適用
プロジェクトにセキュリティ拡張ルールの適用を強制しますか？

A) Yes — すべてのSECURITYルールをブロッキング制約として適用する（プロダクション品質のアプリケーションに推奨）
B) No — すべてのSECURITYルールをスキップする（PoC、プロトタイプ、実験的プロジェクトに適しています）
X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 3: プロパティベーステスト（PBT）拡張機能の適用
プロジェクトにプロパティベーステストのルールを適用しますか？

A) Yes — すべてのPBTルールをブロッキング制約として適用する（ビジネスロジック、データ変換、シリアライゼーション、またはステートフルなコンポーネントを持つプロジェクトに推奨）
B) Partial — 純粋関数とシリアライゼーションのラウンドトリップのみPBTルールを適用する（アルゴリズムの複雑さが限定的なプロジェクトに適しています）
C) No — すべてのPBTルールをスキップする（シンプルなCRUDアプリケーション、UIのみのプロジェクト、または重要なビジネスロジックのない薄い統合レイヤーに適しています）
X) Other (please describe after [Answer]: tag below)

[Answer]: 
