# Hiravi CDK — AWS Infrastructure

Infrastructure as Code for the Hiravi platform using AWS CDK (TypeScript).

> Part of [Hiravi](../README.md). For the system overview and architecture diagram, see the [root README](../README.md).

## Architecture

6 modular stacks with explicit cross-stack dependencies:

```
HiraviDsqlStack ─────────────────────────────────────────┐
HiraviStorageStack ──────────────────────────────────┐    │
HiraviQueueStack ───────────────────────────────┐    │    │
                                                │    │    │
HiraviLambdaStack ←─── (bucket, queue, cluster) ┘────┘────┘
HiraviTranslateStack ←── (processingFunction)
HiraviVercelAccessStack ←── (cluster, bucketArn, queueArn)
```

## Stacks

| Stack | Resources | Purpose |
|---|---|---|
| `HiraviDsqlStack` | Aurora DSQL Cluster | Multi-region serverless PostgreSQL |
| `HiraviStorageStack` | S3 Bucket (versioned, encrypted) | PDF storage + slide images |
| `HiraviQueueStack` | SQS Queue + DLQ | Async processing pipeline |
| `HiraviLambdaStack` | Lambda + Ghostscript Layer | PDF→Image, text extraction |
| `HiraviTranslateStack` | IAM Policies | Amazon Translate access for the Lambda |
| `HiraviVercelAccessStack` | IAM User + Access Key + Secrets Manager secret | Vercel Server Actions credentials (key stored in Secrets Manager, not in outputs) |

> Stack class `HiraviVercelAccessStack` lives in `lib/vercel-webhook-stack.ts`.

## Prerequisites

- AWS CLI configured (`aws configure`)
- Node.js 18+
- AWS CDK CLI (`npm install -g aws-cdk`)

## Setup

```bash
cd src
npm install
npx cdk bootstrap  # First time only
npx cdk synth      # Generate CloudFormation templates
npx cdk deploy --all  # Deploy all stacks
```

## Security Notes

- S3: `BlockPublicAccess.BLOCK_ALL` with selective policy for `slides/public/*`
- Lambda: Least-privilege IAM (S3 read/write, SQS consume, DSQL connect, Translate)
- Vercel IAM User: Scoped to S3 put/get, SQS send, DSQL connect only
- All secrets via environment variables (never hardcoded)
- X-Ray tracing enabled on Lambda for observability

## Lambda Processing Pipeline

Entry point: `handler.main` (`lambda/processing/handler.py`), triggered by SQS (`batchSize=1`, `maxConcurrency=10`).

```
SQS Message → Lambda Handler
  1. Download PDF from S3
  2. Render pages to WebP (PyMuPDF / fitz; Ghostscript layer available)
  3. Extract text layer (PyMuPDF)
  4. Translate via Amazon Translate (parallel, up to 50 threads)
  5. Upload images to S3, UPDATE deck + INSERT slides/slide_texts in DSQL
  6. Call Vercel revalidate webhook
```

DSQL is optimistic-concurrency: `40001` serialization errors are retried with exponential backoff.

## Outputs

After deployment, the following values are exported:

- `DsqlClusterEndpoint` — Aurora DSQL connection endpoint
- `SlideBucketName` — S3 bucket name
- `ProcessingQueueUrl` — SQS queue URL
- `ProcessingFunctionArn` — Lambda function ARN
- `VercelAwsAccessKeyId` — Access key id for Vercel environment variables
- `VercelCredentialsSecretArn` — Secrets Manager ARN holding the secret access key

Retrieve the secret access key (never output in plaintext):

```bash
aws secretsmanager get-secret-value \
  --secret-id hiravi/vercel-aws-credentials \
  --query SecretString --output text
```
