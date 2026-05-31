#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { HiraviStorageStack } from "../lib/storage-stack";
import { HiraviQueueStack } from "../lib/queue-stack";
import { HiraviDsqlStack } from "../lib/dsql-stack";
import { HiraviLambdaStack } from "../lib/lambda-stack";
import { HiraviTranslateStack } from "../lib/translate-stack";
import { HiraviVercelAccessStack } from "../lib/vercel-webhook-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "ap-northeast-1",
};

// Aurora DSQL クラスタ
const dsqlStack = new HiraviDsqlStack(app, "HiraviDsqlStack", { env });

// S3 バケット
const storageStack = new HiraviStorageStack(app, "HiraviStorageStack", { env });

// SQS キュー
const queueStack = new HiraviQueueStack(app, "HiraviQueueStack", { env });

// Lambda (PDF処理ワーカー)
const lambdaStack = new HiraviLambdaStack(app, "HiraviLambdaStack", {
  env,
  slideBucket: storageStack.slideBucket,
  processingQueue: queueStack.processingQueue,
  dsqlCluster: dsqlStack.cluster,
});

// Amazon Translate 用 IAM ポリシー (Lambda に付与済み)
new HiraviTranslateStack(app, "HiraviTranslateStack", {
  env,
  processingFunction: lambdaStack.processingFunction,
});

// Vercel (Next.js) から AWS リソースにアクセスするための IAM
new HiraviVercelAccessStack(app, "HiraviVercelAccessStack", {
  env,
  dsqlCluster: dsqlStack.cluster,
  slideBucketArn: storageStack.slideBucket.bucketArn,
  processingQueueArn: queueStack.processingQueue.queueArn,
});

app.synth();
