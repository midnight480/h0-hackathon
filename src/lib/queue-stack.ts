import * as cdk from "aws-cdk-lib";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export class HiraviQueueStack extends cdk.Stack {
  public readonly processingQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // デッドレターキュー: 3回失敗したメッセージの退避先
    this.deadLetterQueue = new sqs.Queue(this, "HiraviProcessingDLQ", {
      queueName: "hiravi-processing-dlq",
      retentionPeriod: cdk.Duration.days(14),
      // DLQ のメッセージは手動確認用に長めに保持
    });

    // メイン処理キュー: PDF → 画像変換 → テキスト抽出 → 翻訳
    this.processingQueue = new sqs.Queue(this, "HiraviProcessingQueue", {
      queueName: "hiravi-processing-queue",
      // Lambda の最大実行時間 (15分) + バッファ
      visibilityTimeout: cdk.Duration.minutes(16),
      // メッセージ保持期間
      retentionPeriod: cdk.Duration.days(4),
      // デッドレターキュー設定: 3回リトライ後に DLQ へ
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, "ProcessingQueueUrl", {
      value: this.processingQueue.queueUrl,
      description: "SQS queue URL for slide processing jobs",
    });

    new cdk.CfnOutput(this, "ProcessingQueueArn", {
      value: this.processingQueue.queueArn,
    });

    new cdk.CfnOutput(this, "DeadLetterQueueUrl", {
      value: this.deadLetterQueue.queueUrl,
      description: "DLQ for failed processing jobs",
    });
  }
}
