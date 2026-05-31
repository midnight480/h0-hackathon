import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class HiraviStorageStack extends cdk.Stack {
  public readonly slideBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // メインバケット: PDF 元ファイル + スライド画像
    this.slideBucket = new s3.Bucket(this, "HiraviSlideBucket", {
      bucketName: cdk.Fn.sub("hiravi-slides-${AWS::AccountId}"),
      // セキュリティ: パブリックアクセスをブロック (presigned URL で制御)
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // 暗号化: SSE-S3
      encryption: s3.BucketEncryption.S3_MANAGED,
      // バージョニング: スライド更新時のロールバック用
      versioned: true,
      // CORS: Vercel フロントエンドからの直接アップロード用
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
          ],
          allowedOrigins: ["http://localhost:3000", "https://*.vercel.app"],
          exposedHeaders: ["ETag"],
          maxAge: 3600,
        },
      ],
      // ライフサイクル: 不完全なマルチパートアップロードを7日後に削除
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      // 削除時の挙動 (開発用: スタック削除時にバケットも削除)
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 公開スライド画像用のバケットポリシー
    // slides/public/ プレフィックスのみ公開読み取り許可 (OGP 画像用)
    this.slideBucket.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        sid: "PublicReadForSlideImages",
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.AnyPrincipal()],
        actions: ["s3:GetObject"],
        resources: [this.slideBucket.arnForObjects("slides/public/*")],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, "SlideBucketName", {
      value: this.slideBucket.bucketName,
      description: "S3 bucket for PDF files and slide images",
    });

    new cdk.CfnOutput(this, "SlideBucketArn", {
      value: this.slideBucket.bucketArn,
    });
  }
}
