import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

/**
 * BoroBhai Infrastructure Stack
 *
 * Deploys:
 * - S3 bucket for user files (with lifecycle rules)
 * - Lambda: Orchestrator (Bedrock + tool routing)
 * - Lambda: File tools (PDF, Excel, DOCX generation)
 * - Lambda: Presign URL generator
 * - HTTP API Gateway with integrations
 * - CloudWatch log groups
 */

interface StackProps extends cdk.StackProps {
  environment?: 'dev' | 'prod';
}

export class ProofsheetToolsStack extends cdk.Stack {
  public readonly apiEndpoint: string;
  public readonly s3BucketName: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';
    const region = this.region;
    const account = this.account;

    // ============================================================
    // S3 Bucket for User Files
    // ============================================================

    const userFilesBucket = new s3.Bucket(this, 'UserFilesBucket', {
      bucketName: `proofsheet-user-files-${account}`,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Prevent accidental deletion
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          prefix: 'users/',
          expiration: cdk.Duration.days(7), // Auto-delete user files after 7 days
        },
      ],
    });

    // Enable CORS for browser presigned uploads
    userFilesBucket.addCorsRule({
      allowedMethods: [
        s3.HttpMethods.GET,
        s3.HttpMethods.PUT,
        s3.HttpMethods.POST,
      ],
      allowedOrigins: ['*'],
      allowedHeaders: ['*'],
      exposedHeaders: ['ETag', 'x-amz-version-id'],
      maxAge: cdk.Duration.minutes(50),
    });

    // ============================================================
    // IAM Role for Lambda
    // ============================================================

    const lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // Grant Lambda S3 access
    userFilesBucket.grantReadWrite(lambdaExecutionRole);

    // Grant Lambda Bedrock access
    lambdaExecutionRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [`arn:aws:bedrock:${region}::foundation-model/*`],
      })
    );

    // ============================================================
    // Lambda Functions
    // ============================================================

    // 1. Orchestrator Lambda (Bedrock + Tool Routing)
    const orchestratorFunction = new lambda.Function(
      this,
      'OrchestratorFunction',
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'handler.lambda_handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/orchestrator')),
        role: lambdaExecutionRole,
        timeout: cdk.Duration.seconds(60),
        memorySize: 1024,
        environment: {
          BEDROCK_REGION: region,
          BEDROCK_MODEL_ID: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          S3_BUCKET: userFilesBucket.bucketName,
          GROQ_API_KEY: 'gsk_placeholder_replace_me', // PLACEHOLDER
        },
        logRetention: logs.RetentionDays.ONE_WEEK,
      }
    );

    // 2. File Tools Lambda (PDF, Excel, DOCX)
    const fileToolsFunction = new lambda.Function(this, 'FileToolsFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'file_tools.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/tools')),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(300),
      memorySize: 2048,
      environment: {
        BEDROCK_REGION: region,
        S3_BUCKET: userFilesBucket.bucketName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // 3. Presign Lambda (S3 URL Generator)
    const presignFunction = new lambda.Function(this, 'PresignFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/presign')),
      role: lambdaExecutionRole,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        BUCKET_NAME: userFilesBucket.bucketName,
        AWS_REGION: region,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // ============================================================
    // HTTP API Gateway
    // ============================================================

    const api = new apigateway.HttpApi(this, 'Api', {
      defaultIntegration: new apigatewayIntegrations.HttpLambdaIntegration(
        'OrchestratorIntegration',
        orchestratorFunction
      ),
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST],
        allowOrigins: ['*'],
      },
    });

    // POST /api/chat → Orchestrator
    api.addRoutes({
      path: '/api/chat',
      methods: [apigateway.HttpMethod.POST],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(
        'ChatIntegration',
        orchestratorFunction
      ),
    });

    // POST /api/presign-upload → Presign Function
    api.addRoutes({
      path: '/api/presign-upload',
      methods: [apigateway.HttpMethod.POST],
      integration: new apigatewayIntegrations.HttpLambdaIntegration(
        'PresignIntegration',
        presignFunction
      ),
    });

    // ============================================================
    // Outputs
    // ============================================================

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      description: 'HTTP API Endpoint',
      value: api.url || 'N/A',
      exportName: `${this.stackName}-ApiEndpoint`,
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      description: 'S3 Bucket for user files',
      value: userFilesBucket.bucketName,
      exportName: `${this.stackName}-S3Bucket`,
    });

    new cdk.CfnOutput(this, 'OrchestratorFunctionName', {
      description: 'Orchestrator Lambda function name',
      value: orchestratorFunction.functionName,
      exportName: `${this.stackName}-OrchestratorFunction`,
    });

    new cdk.CfnOutput(this, 'FileToolsFunctionName', {
      description: 'File Tools Lambda function name',
      value: fileToolsFunction.functionName,
      exportName: `${this.stackName}-FileToolsFunction`,
    });

    new cdk.CfnOutput(this, 'PresignFunctionName', {
      description: 'Presign Lambda function name',
      value: presignFunction.functionName,
      exportName: `${this.stackName}-PresignFunction`,
    });

    this.apiEndpoint = api.url || '';
    this.s3BucketName = userFilesBucket.bucketName;
  }
}

// ============================================================
// CDK App
// ============================================================

const app = new cdk.App();

new ProofsheetToolsStack(app, 'ProofsheetToolsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-2',
  },
  description: 'BoroBhai infrastructure: Lambda functions, S3, API Gateway',
});

app.synth();
