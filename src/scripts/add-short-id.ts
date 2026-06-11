import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Client } from 'pg'

const HOSTNAME = process.env.DSQL_ENDPOINT ?? ''
const REGION = process.env.AWS_REGION ?? 'us-east-1'

function generateShortId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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
  console.log('Connected to Aurora DSQL')

  // カラム追加
  await client.query(
    `ALTER TABLE decks ADD COLUMN IF NOT EXISTS short_id VARCHAR(8)`
  )
  console.log('Added short_id column')

  // 既存レコードに short_id を付与（未設定のもの）
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM decks WHERE short_id IS NULL`
  )
  console.log(`Backfilling ${rows.length} rows...`)

  for (const row of rows) {
    let id = generateShortId()
    // 衝突回避（簡易）
    const { rows: existing } = await client.query(
      `SELECT id FROM decks WHERE short_id = $1`, [id]
    )
    while (existing.length > 0) {
      id = generateShortId()
    }
    await client.query(`UPDATE decks SET short_id = $1 WHERE id = $2`, [id, row.id])
  }

  console.log('Backfill complete')
  await client.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
