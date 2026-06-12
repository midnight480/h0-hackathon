import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Client } from 'pg'

const HOSTNAME = process.env.DSQL_ENDPOINT ?? ''
const REGION = process.env.AWS_REGION ?? 'us-east-1'

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

  await client.query(`
    CREATE TABLE IF NOT EXISTS deck_likes (
        deck_id    UUID        NOT NULL,
        liker_id   TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (deck_id, liker_id)
    )
  `)
  console.log('Created deck_likes table')

  await client.query(
    `CREATE INDEX ASYNC IF NOT EXISTS idx_deck_likes_deck_id ON deck_likes (deck_id)`,
  )
  console.log('Created idx_deck_likes_deck_id index')

  await client.end()
  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
