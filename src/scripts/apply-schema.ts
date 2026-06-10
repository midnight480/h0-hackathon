import { DsqlSigner } from "@aws-sdk/dsql-signer";
import { Client } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

const ENDPOINT = process.env.DSQL_ENDPOINT ?? "5bt2y2lorvjy4vp4sgcvhrg3ra.dsql.us-east-1.on.aws";
const REGION = process.env.AWS_REGION ?? "us-east-1";

async function main() {
  const signer = new DsqlSigner({ hostname: ENDPOINT, region: REGION });
  const token = await signer.getDbConnectAdminAuthToken();

  const client = new Client({
    host: ENDPOINT,
    database: "postgres",
    user: "admin",
    password: token,
    port: 5432,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("DSQL に接続しました");

  const raw = readFileSync(join(__dirname, "../schema/schema.sql"), "utf-8");
  // コメント行を除去してからセミコロンで分割
  const stripped = raw
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    console.log(`実行中: ${stmt.slice(0, 60)}...`);
    await client.query(stmt);
  }
  console.log("スキーマを適用しました");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
