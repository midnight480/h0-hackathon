import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Client } from 'pg'

// 既存デッキの `decks.username` を、所有者 user_id から Clerk Backend API で解決して一括設定する。
// - 対象: username が未設定（NULL）かつ未削除のデッキ。
// - distinct user_id ごとに 1 回だけ Clerk を呼び、その username で当該ユーザーの全デッキを更新する。
// - 冪等: 既設定（username IS NOT NULL）はスキップ。username 解決不可（未設定/取得失敗）もスキップ。
// - username は保存・検索の正規化方針（小文字化）に合わせて lowercase で格納する。
//
// 必要な環境変数:
//   DSQL_ENDPOINT     … Aurora DSQL のエンドポイント
//   AWS_REGION        … リージョン（既定 us-east-1）
//   CLERK_SECRET_KEY  … Clerk Backend API シークレットキー
//   CLERK_API_URL     … Clerk API ベースURL（既定 https://api.clerk.com）
//
// 実行（DB接続・Clerk呼び出し）は人間側で行う想定: `cd src && pnpm db:backfill-username`

const HOSTNAME = process.env.DSQL_ENDPOINT ?? ''
const REGION = process.env.AWS_REGION ?? 'us-east-1'
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? ''
const CLERK_API_URL = process.env.CLERK_API_URL ?? 'https://api.clerk.com'

// 保存・検索で統一する username の正規化（前後空白除去＋小文字化）。
function normalizeUsername(input: string): string {
  return input.trim().toLowerCase()
}

// Clerk Backend API（REST）から user_id の username を取得する。未設定/取得失敗は null。
async function fetchClerkUsername(userId: string): Promise<string | null> {
  const res = await fetch(`${CLERK_API_URL}/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  })
  if (!res.ok) {
    console.warn(`  Clerk 取得失敗 (${res.status}): ${userId}`)
    return null
  }
  const data = (await res.json()) as { username?: string | null }
  return data.username ? normalizeUsername(data.username) : null
}

async function main() {
  if (!HOSTNAME) {
    console.error('環境変数 DSQL_ENDPOINT が設定されていません。')
    process.exit(1)
  }
  if (!CLERK_SECRET_KEY) {
    console.error('環境変数 CLERK_SECRET_KEY が設定されていません。')
    process.exit(1)
  }

  const signer = new DsqlSigner({ hostname: HOSTNAME, region: REGION })
  const token = await signer.getDbConnectAdminAuthToken()

  const client = new Client({
    host: HOSTNAME,
    port: 5432,
    database: 'postgres',
    user: 'admin',
    password: token,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('Aurora DSQL に接続しました')

  // username 列をべき等に用意
  await client.query(`ALTER TABLE decks ADD COLUMN IF NOT EXISTS username TEXT`)

  // username 未設定のデッキを持つ distinct user_id を抽出（削除済みは対象外）
  const { rows } = await client.query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM decks WHERE username IS NULL AND deleted_at IS NULL`,
  )
  console.log(`バックフィル対象ユーザー: ${rows.length} 名`)

  let updatedUsers = 0
  let updatedDecks = 0
  let skipped = 0

  for (const { user_id } of rows) {
    const username = await fetchClerkUsername(user_id)
    if (!username) {
      // username 解決不可 → スキップ（フォールバックで user_id を URL に使う）
      skipped++
      console.log(`  スキップ（username 未解決）: ${user_id}`)
      continue
    }
    // 冪等: まだ未設定（NULL）の行のみ更新する
    const res = await client.query(
      `UPDATE decks SET username = $1, updated_at = NOW()
       WHERE user_id = $2 AND username IS NULL AND deleted_at IS NULL`,
      [username, user_id],
    )
    updatedUsers++
    updatedDecks += res.rowCount ?? 0
    console.log(`  設定: ${user_id} -> ${username}（${res.rowCount ?? 0} 件）`)
  }

  console.log(
    `完了: ${updatedUsers} 名 / ${updatedDecks} 件更新 / スキップ ${skipped} 名`,
  )
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
