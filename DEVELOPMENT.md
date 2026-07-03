# BoroBhai Local Development Guide

Get the BoroBhai stack running on your local machine for development and testing.

## Prerequisites

- **Node.js**: 18+ (check with `node --version`)
- **Python**: 3.9+ (check with `python3 --version`)
- **npm/yarn**: Latest version
- **Git**: For cloning/pulling code
- **Docker** (optional): For Lambda testing with Docker images

### macOS Setup

```bash
# Install Node.js (via Homebrew)
brew install node

# Install Python (via Homebrew)
brew install python@3.11

# Verify
node --version  # v18+ expected
python3 --version  # 3.9+ expected
```

### Ubuntu/Linux Setup

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python
sudo apt-get install -y python3.11 python3.11-venv

# Verify
node --version
python3.11 --version
```

### Windows Setup (WSL2 Recommended)

```bash
# Inside WSL2 Ubuntu terminal:
sudo apt-get update
sudo apt-get install -y nodejs python3.11 npm

# Verify
node --version
python3 --version
```

## Step 1: Clone & Setup

```bash
# Clone repository
git clone https://github.com/your-org/borobhai.git
cd borobhai

# Install frontend dependencies
cd app
npm install

# Install backend dependencies (Python Lambda)
cd ../lambda/orchestrator
python3.11 -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Install CDK dependencies (infrastructure)
cd ../../lib
npm install
```

## Step 2: Environment Configuration

### Frontend (.env.local)

Create `BoroBhai/app/.env.local`:

```bash
# PLACEHOLDER: Replace with real Groq API key from console.groq.com
NEXT_PUBLIC_GROQ_API_KEY=gsk_placeholder_replace_with_real_key

# PLACEHOLDER: Replace with real AWS credentials
AWS_ACCESS_KEY_ID=placeholder_replace_me
AWS_SECRET_ACCESS_KEY=placeholder_replace_me
AWS_REGION=us-west-2
AWS_S3_BUCKET=proofsheet-user-files

# API Endpoint (local development)
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3001

# Bedrock
BEDROCK_REGION=us-west-2
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Optional: For production Vercel deployment
# NEXT_PUBLIC_API_ENDPOINT=https://your-production-api.com
```

### Backend (Lambda Environment)

Create `BoroBhai/lambda/orchestrator/.env`:

```bash
# PLACEHOLDER: Replace with real Groq API key
GROQ_API_KEY=gsk_placeholder_replace_me

# AWS Configuration
BEDROCK_REGION=us-west-2
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# S3 Configuration
S3_BUCKET=proofsheet-user-files
AWS_REGION=us-west-2
```

### Get Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free tier: 30 requests/minute)
3. Create API key in dashboard
4. Copy key to `.env.local` and Lambda `.env`

### Get AWS Credentials

#### Option A: Use AWS IAM User (Development)

```bash
# 1. Create IAM user in AWS Console (named: borobhai-dev)
# 2. Create Access Key (CLI)
# 3. Download CSV with credentials

# 2. Configure AWS CLI
aws configure

# Enter:
# AWS Access Key ID: [from CSV]
# AWS Secret Access Key: [from CSV]
# Default region: us-west-2
# Default output format: json

# 3. Verify
aws sts get-caller-identity
```

#### Option B: Use Environment Variables

```bash
export AWS_ACCESS_KEY_ID="your_access_key_id"
export AWS_SECRET_ACCESS_KEY="your_secret_access_key"
export AWS_REGION="us-west-2"
```

#### Option C: Use AWS Profile (Recommended)

```bash
# In ~/.aws/credentials
[borobhai-dev]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY

# In ~/.aws/config
[profile borobhai-dev]
region = us-west-2

# Use in terminal:
export AWS_PROFILE=borobhai-dev
```

## Step 3: Start Local Development Server

### Frontend Only (Recommended for UI Development)

```bash
cd BoroBhai/app
npm run dev

# Server starts on http://localhost:3000
# Changes auto-reload (Fast Refresh)
```

Visit [http://localhost:3000](http://localhost:3000) and you should see:

```
[BoroBhai Chat UI]
┌─────────────────────────────┬──────────────────┐
│         Chat Pane           │ Document Preview │
│                             │                  │
│ Hello! I'm BoroBhai...      │    (empty until  │
│                             │    doc generated)│
├─────────────────────────────┴──────────────────┤
│  [Attach File] [Microphone] [Send]             │
└─────────────────────────────────────────────────┘
```

### Frontend + Backend (Full Stack)

If you want to test the full pipeline locally:

#### 1. Start Backend Lambda Locally (with LocalStack or AWS SAM)

```bash
# Option A: Using AWS SAM CLI (recommended)

cd BoroBhai/lambda/orchestrator

# Install SAM CLI (one-time)
brew install aws-sam-cli  # macOS
# or: pip install aws-sam-cli

# Start local Lambda
sam local start-api --port 3001

# Output:
# Running on http://127.0.0.1:3001
# Press CTRL+C to quit
```

#### 2. Update Frontend .env.local

```bash
# Change API endpoint to local Lambda
NEXT_PUBLIC_API_ENDPOINT=http://localhost:3001
```

#### 3. Start Frontend

```bash
cd BoroBhai/app
npm run dev

# Now at http://localhost:3000
# Requests will hit local Lambda at http://localhost:3001
```

#### 4. Test End-to-End

In chat, type: "আমার CV তৈরি করো" (Create my CV)

Expected flow:
```
Frontend (3000) → Lambda (3001) → Bedrock → S3 → Presigned URL → DocumentCard
```

### Backend Only (Lambda Testing)

```bash
cd BoroBhai/lambda/orchestrator

# Activate Python venv
source venv/bin/activate

# Run Lambda handler locally
python3 -c "
from handler import lambda_handler
event = {
    'messages': [
        {'role': 'user', 'content': 'আমার CV তৈরি করো'}
    ],
    'user_id': 'test_user_123'
}
result = lambda_handler(event, None)
print(result)
"
```

## Step 4: Development Workflow

### Making Code Changes

#### Frontend Changes

```bash
cd BoroBhai/app

# Edit files (auto-reload on save)
# npm run dev is already watching

# After changes:
npm run build  # Verify build succeeds
npm run lint   # Check code style
npm test       # Run unit tests (if available)
```

#### Backend Changes

```bash
cd BoroBhai/lambda/orchestrator

# Edit handler.py or supporting files

# Test locally:
source venv/bin/activate
python3 -m pytest tests/  # Run tests

# If using SAM:
sam local start-api --port 3001  # Restarts automatically on changes
```

#### Infrastructure Changes

```bash
cd BoroBhai/lib

# Edit proofsheet-tools-stack.ts

# Validate TypeScript:
npx tsc --noEmit

# Preview changes:
cdk diff

# Deploy to AWS (if testing against real services):
cdk deploy
```

### Debugging

#### Frontend Debugging

```bash
# Chrome DevTools (F12)
# • Inspect React components: React DevTools extension
# • Network tab: See API requests
# • Console: JavaScript errors

# Or use VS Code debugger:
# .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/app"
    }
  ]
}
```

#### Backend Debugging

```bash
# Python debugger (pdb)
# Add breakpoint in handler.py:
import pdb; pdb.set_trace()

# Or use VS Code Python debugger:
# .vscode/launch.json
{
  "type": "python",
  "request": "launch",
  "name": "Lambda Handler",
  "program": "${workspaceFolder}/lambda/orchestrator/handler.py",
  "console": "integratedTerminal"
}
```

#### AWS Lambda Logs

```bash
# View recent logs
aws logs tail /aws/lambda/proofsheet-orchestrator --follow

# Or with CloudWatch Insights:
aws logs start-query \
  --log-group-name /aws/lambda/proofsheet-orchestrator \
  --start-time $(date -d '10 minutes ago' +%s) \
  --end-time $(date +%s) \
  --query-string "fields @timestamp, @message | stats count() by @message"
```

## Step 5: Testing

### Frontend Unit Tests

```bash
cd BoroBhai/app

# Run tests
npm test

# With coverage
npm test -- --coverage

# Watch mode (rerun on file change)
npm test -- --watch
```

### Backend Unit Tests

```bash
cd BoroBhai/lambda/orchestrator

# Run pytest
source venv/bin/activate
python3 -m pytest tests/ -v

# With coverage
python3 -m pytest tests/ --cov=handler --cov-report=html
```

### Integration Tests

```bash
# Test full chat flow locally
cd BoroBhai/app

npm run test:integration

# Or manually:
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "user_id": "test_user"
  }'
```

## Step 6: Development Commands Reference

### Frontend

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Build for production
npm start          # Start production server
npm run lint       # ESLint code style check
npm run format     # Prettier code formatter
npm test           # Run Jest tests
npm run type-check # TypeScript type checking
```

### Backend (Lambda)

```bash
source venv/bin/activate

# Development
python3 -m pytest tests/                    # Run tests
python3 -m black handler.py                # Format code
python3 -m pylint handler.py               # Lint code
sam local start-api --port 3001            # Start SAM local

# Packaging for AWS Lambda
pip freeze > requirements.txt               # Save dependencies
zip -r lambda_function.zip . -x "*.pyc"    # Create deployment package
```

### Infrastructure (CDK)

```bash
cd BoroBhai/lib

npm run build       # Build TypeScript → JavaScript
cdk synth           # Generate CloudFormation template
cdk diff            # Preview AWS changes
cdk deploy          # Deploy to AWS
cdk destroy         # Delete all AWS resources
npm test            # Run CDK unit tests
```

## Common Issues & Fixes

### Issue: "Cannot find module 'next'"

**Fix**:
```bash
cd BoroBhai/app
npm install
```

### Issue: "AWS credentials not found"

**Fix**:
```bash
# Set environment variables
export AWS_ACCESS_KEY_ID="your_key"
export AWS_SECRET_ACCESS_KEY="your_secret"

# Or use AWS CLI config
aws configure
```

### Issue: "Groq API key invalid"

**Fix**:
1. Visit [console.groq.com](https://console.groq.com)
2. Create new API key
3. Update `.env.local` with new key
4. Restart dev server

### Issue: "S3 bucket does not exist"

**Fix**:
```bash
# Create bucket
aws s3api create-bucket \
  --bucket proofsheet-user-files \
  --region us-west-2 \
  --create-bucket-configuration LocationConstraint=us-west-2

# Or modify S3_BUCKET in .env.local to use existing bucket
```

### Issue: "Bedrock model not available"

**Fix**:
1. Go to AWS Console → Bedrock → Model Access
2. Request access to Claude 3.5 Sonnet (takes ~1-2 minutes)
3. Verify in Models list
4. Update BEDROCK_MODEL_ID if necessary

### Issue: "Port 3000 already in use"

**Fix**:
```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
npm run dev -- -p 3001
```

## Performance Tips

### Frontend Performance

```bash
# Analyze bundle size
npm run build
npm install -g webpack-bundle-analyzer
```

### Backend Performance

```bash
# Profile Lambda execution
# Add to handler.py:
import cProfile
import pstats
from io import StringIO

profiler = cProfile.Profile()
profiler.enable()
# ... your code ...
profiler.disable()
stats = pstats.Stats(profiler, stream=StringIO())
stats.print_stats()
```

## Code Style & Formatting

### Frontend

```bash
# ESLint
npm run lint

# Prettier (auto-format)
npm run format

# Check TypeScript types
npm run type-check
```

### Backend

```bash
# Black (Python formatter)
python3 -m black handler.py tools/

# Pylint (linter)
python3 -m pylint handler.py

# Isort (import sorting)
python3 -m isort handler.py
```

## Next Steps

1. **Read the codebase**: Start with `app/page.tsx` (main UI)
2. **Make a small change**: Update a color in `globals.css`
3. **Test locally**: Verify it works in `npm run dev`
4. **Commit & push**: Create a pull request for review
5. **Deploy to AWS**: Follow `DEPLOYMENT.md` for full stack

## Getting Help

### Local Development Questions
- Check GitHub Issues: https://github.com/najmun-ai/Bangla-Ai/issues
- Create a new issue if your question isn't answered

### Contact
- **Email**: najmun@rooscloset.store
- **Phone**: +8801798344063
- **GitHub**: https://github.com/najmun-ai

### RoosCloset Labs
- **Website**: www.rooscloset.store
- **Location**: Dhaka, Bangladesh

---

Happy coding! 🚀
