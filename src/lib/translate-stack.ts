import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface HiraviTranslateStackProps extends cdk.StackProps {
  processingFunction: lambda.IFunction;
}

export class HiraviTranslateStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: HiraviTranslateStackProps
  ) {
    super(scope, id, props);

    // Amazon Translate へのアクセス権限を Lambda に付与
    props.processingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "AmazonTranslateAccess",
        effect: iam.Effect.ALLOW,
        actions: [
          "translate:TranslateText",
          "translate:TranslateDocument",
          "translate:ListLanguages",
        ],
        resources: ["*"],
      })
    );

    // Comprehend (言語検出) へのアクセス権限
    // Amazon Translate が自動言語検出に使用
    props.processingFunction.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "ComprehendLanguageDetection",
        effect: iam.Effect.ALLOW,
        actions: [
          "comprehend:DetectDominantLanguage",
        ],
        resources: ["*"],
      })
    );
  }
}
