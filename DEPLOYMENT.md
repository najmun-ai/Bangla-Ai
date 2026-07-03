# BoroBhai Deployment Guide

This guide covers step-by-step AWS deployment for the complete BoroBhai stack.

## Prerequisites

- AWS Account with Bedrock access (Claude 3.5 Sonnet)
- AWS CLI v2 configured locally
- Node.js 18+
- Python 3.9+
- Groq API key (get free at console.groq.com)

## Step 1: Create S3 Bucket

```bash
aws s3api create-bucket \
  --bucket proofsheet-user-files \
  --region us-west-2 \
  --create-bucket-configuration LocationConstraint=us-west-2

# Enable CORS for browser presigned uploads
aws s3api put-bucket-cors \
  --bucket proofsheet-user-files \
  --cors-configuration file://- <<EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
      "ExposeHeaders": ["ETag", "x-amz-version-id"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

# Add lifecycle rule: delete objects after 7 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket proofsheet-user-files \
  --lifecycle-configuration file://- <<EOF
{
  "Rules": [
    {
      "Id": "delete-after-7-days",
      "Status": "Enabled",
      "Expiration": {
        "Days": 7
      },
      "Prefix": "users/"
    }
  ]
}
EOF

# Enable S3-managed encryption (default)
aws s3api put-bucket-encryption \
  --bucket proofsheet-user-files \
  --server-side-encryption-configuration file://- <<EOF
{
  "Rules": [
    {
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }
  ]
}
EOF
```

## Step 2: Create IAM Roles

### Lambda Execution Role

```bash
# Create trust policy document
cat > /tmp/lambda-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name ProofSheetLambdaExecutionRole \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json

# Attach policies
aws iam attach-role-policy \
  --role-name ProofSheetLambdaExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create inline policy for S3 + Bedrock
cat > /tmp/lambda-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GeneratePresignedUrl"
      ],
      "Resource": "arn:aws:s3:::proofsheet-user-files/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:us-west-2::foundation-model/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name ProofSheetLambdaExecutionRole \
  --policy-name ProofSheetPolicy \
  --policy-document file:///tmp/lambda-policy.json
```

## Step 3: Build and Deploy Lambda Functions

### Orchestrator Lambda (Bedrock + Tool Routing)

```bash
cd BoroBhai/lambda/orchestrator

# Build Docker image
docker build -t proofsheet-orchestrator:latest .

# Push to ECR (or use local .zip approach below)
# aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-west-2.amazonaws.com
# docker tag proofsheet-orchestrator:latest 123456789.dkr.ecr.us-west-2.amazonaws.com/proofsheet-orchestrator:latest
# docker push 123456789.dkr.ecr.us-west-2.amazonaws.com/proofsheet-orchestrator:latest

# OR: Create .zip for direct Lambda upload
pip install -r requirements.txt -t package/
cp handler.py package/
cd package && zip -r ../lambda_function.zip . && cd ..

# Create Lambda function
aws lambda create-function \
  --function-name proofsheet-orchestrator \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/ProofSheetLambdaExecutionRole \
  --handler handler.lambda_handler \
  --zip-file fileb://lambda_function.zip \
  --timeout 60 \
  --memory-size 1024 \
  --environment Variables="{GROQ_API_KEY=PLACEHOLDER_REPLACE_ME,BEDROCK_REGION=us-west-2}"

# OR if using ECR:
# aws lambda create-function \
#   --function-name proofsheet-orchestrator \
#   --role arn:aws:iam::YOUR_ACCOUNT_ID:role/ProofSheetLambdaExecutionRole \
#   --code ImageUri=123456789.dkr.ecr.us-west-2.amazonaws.com/proofsheet-orchestrator:latest \
#   --package-type Image \
#   --timeout 60 \
#   --memory-size 1024 \
#   --environment Variables="{GROQ_API_KEY=PLACEHOLDER_REPLACE_ME,BEDROCK_REGION=us-west-2}"
```

### File Tools Lambda (PDF/Image/Excel/DOCX)

```bash
cd BoroBhai/lambda/tools

docker build -t proofsheet-tools:latest .

# For .zip approach:
pip install -r requirements.txt -t package/
cp file_tools.py package/
cd package && zip -r ../file_tools.zip . && cd ..

aws lambda create-function \
  --function-name proofsheet-file-tools \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/ProofSheetLambdaExecutionRole \
  --handler file_tools.lambda_handler \
  --zip-file fileb://file_tools.zip \
  --timeout 300 \
  --memory-size 2048 \
  --environment Variables="{BEDROCK_REGION=us-west-2}"
```

### Presign Lambda (S3 URL Generator)

```bash
cd BoroBhai/lambda/presign

pip install -r requirements.txt -t package/
cp index.py package/lambda_function.py
cd package && zip -r ../presign.zip . && cd ..

aws lambda create-function \
  --function-name proofsheet-presign \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/ProofSheetLambdaExecutionRole \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://presign.zip \
  --timeout 10 \
  --memory-size 256 \
  --environment Variables="{BUCKET_NAME=proofsheet-user-files,AWS_REGION=us-west-2}"
```

## Step 4: Create HTTP API Gateway

```bash
# Create API
API_ID=$(aws apigatewayv2 create-api \
  --name proofsheet-api \
  --protocol-type HTTP \
  --target arn:aws:lambda:us-west-2:YOUR_ACCOUNT_ID:function:proofsheet-orchestrator \
  --query 'ApiId' \
  --output text)

# Create integration for /api/chat
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-method POST \
  --payload-format-version 2.0 \
  --target arn:aws:lambda:us-west-2:YOUR_ACCOUNT_ID:function:proofsheet-orchestrator \
  --query 'IntegrationId' \
  --output text)

# Create route /api/chat POST
aws apigatewayv2 create-route \
  --api-id $API_ID \
  --route-key 'POST /api/chat' \
  --target "integrations/$INTEGRATION_ID"

# Create stage
aws apigatewayv2 create-stage \
  --api-id $API_ID \
  --stage-name prod \
  --auto-deploy

# Get API endpoint
API_ENDPOINT=$(aws apigatewayv2 get-api \
  --api-id $API_ID \
  --query 'ApiEndpoint' \
  --output text)

echo "API Endpoint: $API_ENDPOINT"
```

## Step 5: Configure Frontend Environment

Create `.env.local` in `BoroBhai/app/`:

```bash
# PLACEHOLDER: Replace with actual Groq API key from console.groq.com
NEXT_PUBLIC_GROQ_API_KEY=placeholder_groq_key_replace_me

# PLACEHOLDER: Replace with HTTP API endpoint from Step 4
NEXT_PUBLIC_API_ENDPOINT=https://PLACEHOLDER_API_ID.execute-api.us-west-2.amazonaws.com/prod

# AWS Credentials (used server-side for presigned URLs)
AWS_ACCESS_KEY_ID=placeholder_replace_me
AWS_SECRET_ACCESS_KEY=placeholder_replace_me
AWS_REGION=us-west-2
AWS_S3_BUCKET=proofsheet-user-files

# Bedrock configuration
BEDROCK_REGION=us-west-2
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

## Step 6: Deploy Frontend

### Option A: Vercel (Recommended)

```bash
cd BoroBhai/app
npm install
vercel login
vercel deploy --prod
```

### Option B: Self-hosted on EC2

```bash
cd BoroBhai/app
npm install
npm run build
npm start
# Or use PM2: pm2 start "npm start" --name borobhai
```

## Step 7: Deploy Infrastructure with CDK (Alternative to Manual Setup)

If you prefer Infrastructure-as-Code:

```bash
cd BoroBhai/lib
npm install
cdk deploy

# This will:
# - Create S3 bucket with lifecycle rules
# - Create Lambda functions (orchestrator, file tools, presign)
# - Create API Gateway with routes
# - Output endpoint URLs
```

## Step 8: Post-Deployment Verification

### Test Orchestrator Lambda

```bash
aws lambda invoke \
  --function-name proofsheet-orchestrator \
  --payload '{"messages": [{"role": "user", "content": "আমার CV তৈরি করো"}]}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
```

### Test Presign Lambda

```bash
aws lambda invoke \
  --function-name proofsheet-presign \
  --payload '{"key": "users/test-user/exports/resume.pdf"}' \
  --cli-binary-format raw-in-base64-out \
  response.json

cat response.json
```

### Test Frontend

Open `https://yourdomain.com` (or Vercel URL) and:
1. Type a Bengali query: "আমার CV তৈরি করো" (Create my CV)
2. Try voice input (should work in desktop Chrome)
3. Try file upload (should generate presigned URL)
4. Verify document rendering

## Security Checklist

- [ ] Replace all PLACEHOLDER keys in `.env.local` with real credentials
- [ ] Enable S3 bucket versioning (optional, for recovery)
- [ ] Set CloudWatch log retention to 7 days (sensitive data)
- [ ] Enable CloudTrail logging for compliance
- [ ] Set Lambda concurrency limits to prevent runaway costs
- [ ] Enable API Gateway CloudWatch logging
- [ ] Rotate Groq API key regularly
- [ ] Use AWS Secrets Manager for production credentials

## Monitoring & Cost Control

### Set up CloudWatch Alarms

```bash
# Alert if Lambda errors exceed 5% in 5 minutes
aws cloudwatch put-metric-alarm \
  --alarm-name proofsheet-orchestrator-errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=FunctionName,Value=proofsheet-orchestrator

# Alert if Bedrock costs exceed threshold
aws ce create-cost-category-definition \
  --name-prefix ProofSheet \
  --rules file:///tmp/cost-rules.json
```

### Monitor Token Usage

Lambda logs will show token counts:

```bash
aws logs tail /aws/lambda/proofsheet-orchestrator --follow | grep -i token
```

## Troubleshooting

### Lambda Cold Start Delays

**Problem**: First invocation takes 5-10 seconds.  
**Solution**: 
- Enable Lambda Provisioned Concurrency (costs ~$0.30/hour but eliminates cold starts)
- Or accept cold starts for MVP (typical 2-3 seconds with Python)

### S3 Presigned URL Fails

**Problem**: `403 Forbidden` when downloading file.  
**Solution**:
- Verify CORS configuration on bucket
- Check S3 bucket policies allow Lambda role
- Verify presigned URL is not expired (default 15 minutes)

### Bedrock Model Access Denied

**Problem**: `ValidationException: Access Denied`.  
**Solution**:
- Enable Claude 3.5 Sonnet model access in Bedrock console
- Verify Lambda execution role has `bedrock:InvokeModel` permission

### Groq API Rate Limit

**Problem**: `429 Too Many Requests` from Groq.  
**Solution**:
- Free tier has 30 req/minute limit
- Cache transcriptions for repeated audio
- Consider Modal Whisper as fallback ($60/mo credit)

## Rollback

To rollback to previous Lambda version:

```bash
# List versions
aws lambda list-versions-by-function --function-name proofsheet-orchestrator

# Create alias pointing to previous version
aws lambda update-alias \
  --function-name proofsheet-orchestrator \
  --name prod \
  --function-version PREVIOUS_VERSION
```

## Next Steps

- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Enable VPC integration for Lambda (if using RDS)
- [ ] Implement DynamoDB session persistence
- [ ] Migrate to Qdrant vector DB for larger KB
- [ ] Set up monitoring dashboards
- [ ] Plan scale testing (1000 concurrent users)

---

---

## Support & Contact

For deployment issues, feature requests, or collaboration inquiries:

**GitHub Issues**: https://github.com/najmun-ai/Bangla-Ai/issues  
**Email**: najmun@rooscloset.store  
**Phone**: +8801798344063  

**RoosCloset Labs**  
Dhaka, Bangladesh  
www.rooscloset.store

Built with ❤️ for Bangladesh.
