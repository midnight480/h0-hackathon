# Hiravi CDK — AWS Infrastructure

Infrastructure as Code for the Hiravi platform using AWS CDK (TypeScript).

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
| `HiraviTranslateStack` | IAM Policies | Translate + Comprehend access |
| `HiraviVercelAccessStack` | IAM User + Access Key | Vercel Server Actions credentials |

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

```
SQS Message → Lambda Handler
  1. Download PDF from S3
  2. Convert pages to WebP (Ghostscript + pdf2image)
  3. Extract text (PyMuPDF text layer)
  4. Translate via Amazon Translate API
  5. Upload images to S3, INSERT events to DSQL
  6. Call Vercel revalidateTag webhook
```

## Outputs

After deployment, the following values are exported:

- `DsqlClusterEndpoint` — Aurora DSQL connection endpoint
- `SlideBucketName` — S3 bucket name
- `ProcessingQueueUrl` — SQS queue URL
- `ProcessingFunctionArn` — Lambda function ARN
- `VercelAwsAccessKeyId` — For Vercel environment variables
- `VercelAwsSecretAccessKey` — For Vercel environment variables
