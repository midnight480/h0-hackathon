import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Client } from 'pg'

const ENDPOINT = process.env.DSQL_ENDPOINT!
const REGION = process.env.AWS_REGION ?? 'us-east-1'

export async function getDbClient(): Promise<Client> {
  const signer = new DsqlSigner({ hostname: ENDPOINT, region: REGION })
  const token = await signer.getDbConnectAdminAuthToken()

  const client = new Client({
    host: ENDPOINT,
    database: 'postgres',
    user: 'admin',
    password: token,
    port: 5432,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  return client
}

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = await getDbClient()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}
