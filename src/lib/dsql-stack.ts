import * as cdk from "aws-cdk-lib";
import * as dsql from "aws-cdk-lib/aws-dsql";
import { Construct } from "constructs";

export class HiraviDsqlStack extends cdk.Stack {
  public readonly cluster: dsql.CfnCluster;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Aurora DSQL クラスタ (単一リージョン)
    this.cluster = new dsql.CfnCluster(this, "HiraviDsqlCluster", {
      deletionProtectionEnabled: false, // 開発中は削除保護オフ
      tags: [
        { key: "Project", value: "Hiravi" },
        { key: "Environment", value: "development" },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, "DsqlClusterEndpoint", {
      value: this.cluster.attrEndpoint,
      description: "Aurora DSQL cluster endpoint for DB connections",
    });

    new cdk.CfnOutput(this, "DsqlClusterArn", {
      value: this.cluster.attrResourceArn,
      description: "Aurora DSQL cluster ARN for IAM policies",
    });

    new cdk.CfnOutput(this, "DsqlClusterId", {
      value: this.cluster.attrIdentifier,
      description: "Aurora DSQL cluster identifier",
    });
  }
}
