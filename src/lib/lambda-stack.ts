import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as dsql from "aws-cdk-lib/aws-dsql";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";

export interface HiraviLambdaStackProps extends cdk.StackProps {
  slideBucket: s3.IBucket;
  processingQueue: sqs.IQueue;
  dsqlCluster: dsql.CfnCluster;
}

export class HiraviLambdaStack extends cdk.Stack {
  public readonly processingFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: HiraviLambdaStackProps) {
    super(scope, id, props);

    // Lambda レイヤー: Ghostscript + pdf2image 依存
    const ghostscriptLayer = new lambda.LayerVersion(
      this,
      "GhostscriptLayer",
      {
        layerVersionName: "hiravi-ghostscript",
        description: "Ghostscript binary for PDF to image conversion",
        code: lambda.Code.fromAsset("layers/ghostscript"),
        compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
        compatibleArchitectures: [lambda.Architecture.X86_64],
      }
    );

    // PDF 処理 Lambda
    this.processingFunction = new lambda.Function(
      this,
      "HiraviProcessingFunction",
      {
        functionName: "hiravi-slide-processor",
        description:
          "Processes uploaded PDFs: image generation, text extraction, translation",
        runtime: lambda.Runtime.PYTHON_3_12,
        architecture: lambda.Architecture.X86_64,
        handler: "handler.main",
        code: lambda.Code.fromAsset("lambda/processing"),
        layers: [ghostscriptLayer],
        // PDF 処理は重いのでメモリ・タイムアウトを大きめに
        memorySize: 2048,
        timeout: cdk.Duration.minutes(15),
        environment: {
          SLIDE_BUCKET_NAME: props.slideBucket.bucketName,
          PROCESSING_QUEUE_URL: props.processingQueue.queueUrl,
          // Aurora DSQL 接続情報
          DSQL_ENDPOINT: props.dsqlCluster.attrEndpoint,
          DSQL_REGION: cdk.Stack.of(this).region,
          // Vercel revalidation webhook
          VERCEL_REVALIDATE_URL: "",
          WEBHOOK_SECRET: "",
        },
        // X-Ray トレーシング
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // SQS → Lambda イベントソースマッピング
    this.processingFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(props.processingQueue, {
        batchSize: 1, // PDF 処理は1件ずつ
        maxConcurrency: 10, // 同時実行数を制限
      })
    );

    // S3 バケットへの読み書き権限
    props.slideBucket.grantReadWrite(this.processingFunction);

    // SQS キューからのメッセージ受信権限 (イベントソースで自動付与されるが明示)
    props.processingQueue.grantConsumeMessages(this.processingFunction);

    // Aurora DSQL 接続用 IAM ポリシー
    this.processingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "AuroraDSQLConnect",
        effect: iam.Effect.ALLOW,
        actions: ["dsql:DbConnectAdmin"],
        resources: [props.dsqlCluster.attrResourceArn],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, "ProcessingFunctionArn", {
      value: this.processingFunction.functionArn,
      description: "Lambda function for PDF processing",
    });

    new cdk.CfnOutput(this, "ProcessingFunctionName", {
      value: this.processingFunction.functionName,
    });
  }
}
