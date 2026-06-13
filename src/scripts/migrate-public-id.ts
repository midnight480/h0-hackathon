import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Client } from 'pg'
import { customAlphabet } from 'nanoid'

// 既存デッキの slug を Google Meet 形式の公開識別子（正規形・小文字英字10文字）へ移行する。
// - 対象: slug が `^[a-z]{10}$` を満たさない（=未移行）デッキ。
// - 各デッキ: legacy_slug に現 slug を退避し、slug を新IDへ更新する。
// - 冪等: 既に正規形のものはスキップ（再実行しても結果不変）。
// - UNIQUE/OCC 衝突時は新IDで再試行し、上限到達はスキップしてログ出力。
// - short_id は温存（変更しない）。

const HOSTNAME = process.env.DSQL_ENDPOINT ?? ''
const REGION = process.env.AWS_REGION ?? 'us-east-1'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'
const generatePublicId = customAlphabet(ALPHABET, 10)

const MAX_RETRIES = 5

// UNIQUE違反 / OCC コンフリクトを判定（pg は SQLSTATE を code に持つ）。
function isRetryable(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code
  if (!code) return false
  return code === '23505' || code === '40001' || code.startsWith('OC')
}

async function main() {
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

  // legacy_slug 列をべき等に用意
  await client.query(`ALTER TABLE decks ADD COLUMN IF NOT EXISTS legacy_slug TEXT`)

  // 未移行（正規形でない）デッキを抽出
  const { rows } = await client.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM decks WHERE slug !~ '^[a-z]{10}$'`,
  )
  console.log(`移行対象: ${rows.length} 件`)

  let migrated = 0
  let skipped = 0

  for (const row of rows) {
    let done = false
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const newId = generatePublicId()
      try {
        // 冪等性のため、まだ未移行（slug が現値のまま）の行のみ更新する。
        const res = await client.query(
          `UPDATE decks
             SET legacy_slug = $1, slug = $2, updated_at = NOW()
           WHERE id = $3 AND slug = $1`,
          [row.slug, newId, row.id],
        )
        if (res.rowCount === 0) {
          // 別プロセスが既に移行済み等。スキップ扱い。
          console.log(`  スキップ（既に更新済み）: ${row.id}`)
        } else {
          migrated++
          console.log(`  移行: ${row.id} ${row.slug} -> ${newId}`)
        }
        done = true
        break
      } catch (err) {
        if (!isRetryable(err)) throw err
        // UNIQUE/OCC 衝突 → 新IDで再試行
        console.log(`  衝突につき再試行 (${attempt + 1}/${MAX_RETRIES}): ${row.id}`)
      }
    }
    if (!done) {
      skipped++
      console.warn(`  上限到達のためスキップ: ${row.id}`)
    }
  }

  console.log(`完了: 移行 ${migrated} 件 / スキップ ${skipped} 件`)
  await client.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
