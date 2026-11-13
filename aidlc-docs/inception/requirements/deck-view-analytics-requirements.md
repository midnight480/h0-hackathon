# 要件定義: デッキ View 数とアクセス分析（deck-view-analytics）

## 1. 意図分析
- **依頼**: 各デッキのアクセス数をカウントして View 数を表示する。加えて、所有者がダッシュボードから自分のデッキを開いたときに、日別のアクセス推移と流入元（X / Facebook / ダイレクト など）を確認できるようにする。
- **Request Type**: Enhancement / **Scope**: frontend（Server Action・表示・分析ページ）＋ schema / **Complexity**: Moderate
- **深度**: Standard（設計判断は前回セッションで確定済み。audit.md 2026-10-05T05:00:00Z を参照）

## 2. 機能要件
| ID | 要件 |
|----|------|
| FR-1 | デッキ閲覧ページの表示時に View を計上する。閲覧者ごとに 1 回だけ数えるユニーク集計で、`decks.views` に反映する |
| FR-2 | 所有者自身の閲覧、Bot、非公開デッキ、削除済みデッキは計上しない |
| FR-3 | Bot はクライアント beacon（マウント後の Server Action 呼び出し。JS を実行しないクローラーは呼ばない）と User-Agent 判定で除外する |
| FR-4 | View 数（累計・ユニーク）をデッキカード、ビューアのサイドバー、ユーザープロフィール、ダッシュボードの各行に表示する。ダッシュボードには「総閲覧数」も出す |
| FR-5 | 閲覧のたびにイベント（閲覧者 ID・流入元・参照元ホスト・日時）を INSERT-only で記録する |
| FR-6 | 流入元を分類する: x / facebook / linkedin / hatena / slack / line / search / other / direct / internal。判定の優先順位はクライアント遷移 > `utm_source`（`ref`）> referrer > `fbclid` > ダイレクト |
| FR-7 | 所有者限定の分析ページ `/dashboard/decks/{deckId}?range=7\|30\|90` を設ける。内容は累計 View、期間内の閲覧回数、期間内の閲覧者数、日別推移（閲覧回数とユニーク閲覧者数、日本時間）、流入元の内訳、参照元サイトの上位 10 件 |
| FR-8 | ダッシュボードの各行（公開済みのデッキ）と、所有者が見ているビューアから分析ページへ移動できる |

## 3. 非機能要件
- **プライバシー**: 参照元はホスト名だけを保存し、フルURL（パス・クエリ）は保存しない。閲覧者 ID は既存のいいねと同じ体系（Clerk user_id または `anon:<uuid>` の Cookie）。
- **DSQL 制約**: 外部キーは使わない。ユニーク判定は複合主キーの一意制約違反（23505）で行う。イベント INSERT はユニーク判定とは別のトランザクションにして、ROLLBACK に巻き込まれないようにする。
- **可用性**: 計上が失敗しても（OCC 競合など）閲覧は妨げない（握りつぶして未計上にする）。
- **依存追加なし**: グラフは自前の markup で描く。

## 4. スキーマ変更
- `deck_views (deck_id, viewer_id, created_at, PK(deck_id, viewer_id))`: ユニーク判定用
- `deck_view_events (id, deck_id, viewer_id, source, referrer_host, viewed_at)` と `idx_deck_view_events_deck (deck_id, viewed_at)`: 分析用
- 反映手順: `cd src && pnpm db:schema`（冪等）

## 5. 既知の制約
- X・LINE などのアプリ内ブラウザや、referrer を送信しない環境からのアクセスは「ダイレクト」に分類される。共有リンクに `?utm_source=x` を付ければ確実に識別できる。
- 既存の `decks.views` は 0 から計上を始める（過去分は存在しない）。

## 6. 拡張ルール
- Security Baseline / PBT: opt-out（aidlc-state.md の Extension Configuration による）
