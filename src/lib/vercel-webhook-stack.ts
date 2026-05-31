import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dsql from "aws-cdk-lib/aws-dsql";
import { Construct } from "constructs";

/**
 * Vercel の Server Actions から AWS リソースにアクセスするための
 * IAM ユーザー + ポリシーを定義。
 *
 * Vercel 側の環境変数に AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY を設定して使用。
 */
export interface HiraviVercelAccessStackProps extends cdk.StackProps {
  dsqlCluster: dsql.CfnCluster;
  slideBucketArn: string;
  processingQueueArn: string;
}

export class HiraviVercelAccessStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: HiraviVercelAccessStackProps
  ) {
    super(scope, id, props);

    // Vercel (Next.js Server Actions) 用 IAM ユーザー
    const vercelUser = new iam.User(this, "HiraviVercelUser", {
      userName: "hiravi-vercel-app",
    });

    // S3: presigned URL 生成 + オブジェクト操作
    vercelUser.addToPolicy(
      new iam.PolicyStatement({
        sid: "S3PresignedUrlAccess",
        effect: iam.Effect.ALLOW,
        actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
        resources: [`${props.slideBucketArn}/*`],
      })
    );

    // SQS: 処理キューへのメッセージ送信
    vercelUser.addToPolicy(
      new iam.PolicyStatement({
        sid: "SQSSendMessage",
        effect: iam.Effect.ALLOW,
        actions: ["sqs:SendMessage"],
        resources: [props.processingQueueArn],
      })
    );

    // Aurora DSQL: DB 接続
    vercelUser.addToPolicy(
      new iam.PolicyStatement({
        sid: "DSQLConnect",
        effect: iam.Effect.ALLOW,
        actions: ["dsql:DbConnectAdmin"],
        resources: [props.dsqlCluster.attrResourceArn],
      })
    );

    // アクセスキー生成
    const accessKey = new iam.AccessKey(this, "HiraviVercelAccessKey", {
      user: vercelUser,
    });

    // Outputs (Vercel 環境変数に設定する値)
    new cdk.CfnOutput(this, "VercelAwsAccessKeyId", {
      value: accessKey.accessKeyId,
      description: "AWS Access Key ID for Vercel environment variables",
    });

    new cdk.CfnOutput(this, "VercelAwsSecretAccessKey", {
      value: accessKey.secretAccessKey.unsafeUnwrap(),
      description: "AWS Secret Access Key for Vercel environment variables",
    });
  }
}
