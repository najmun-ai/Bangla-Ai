# BoroBhai - Bengali Civic AI Assistant

**BoroBhai** is an AI-powered civic assistant that helps Bengali-speaking citizens navigate government documentation and administrative processes through conversational AI.

Built by **Najmun Nahar Khan** @ **RoosCloset Labs**, Dhaka, Bangladesh.  
GitHub: https://github.com/najmun-ai/Bangla-Ai

## What is BoroBhai?

BoroBhai combines modern AI with deep understanding of Bengali bureaucracy. Users ask questions in Bengali or Banglish, and BoroBhai responds with:
- **Generated Documents**: CVs, letters, leave applications, salary certificates, trade licenses, agreements, and more
- **File Manipulation**: PDF compression/merging, image resizing, Excel generation
- **Voice Input**: Transcription in Bengali (bn-BD) via Groq/Web Speech API
- **Smart Retrieval**: Context-aware knowledge base with hybrid search (semantic + keyword)
- **Dual Persona**: Compassionate tone for civic guidance, formal for legal/administrative documents

## Key Features

- **Split-pane Chat UI**: Real-time messaging with document preview
- **Voice-First Input**: Bengali speech recognition (fallback to text)
- **Document Generation**: 12+ professional templates (CV, letter, agreement, salary cert, etc.)
- **File Tools**: Compress PDFs, merge files, resize images, generate Excel sheets
- **Knowledge Base**: 179 expert-reviewed civic procedures + empathy markers
- **Cost Efficient**: ~$22/month all-in (Bedrock + Groq + S3 + EC2)
- **RTL Layout**: Full right-to-left support for Bengali UI

## Tech Stack

**Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS, Vercel AI SDK, MediaRecorder API  
**Backend**: AWS Lambda (Python), AWS Bedrock (Claude 3.5 Sonnet), Amazon Titan Embeddings  
**Data**: S3 (file storage + presigned URLs), DynamoDB (optional session management)  
**Voice**: Groq Whisper API (STT) + Web Speech API (bn-BD)  
**Infrastructure**: AWS CDK (TypeScript), HTTP API Gateway

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- AWS Account (Bedrock + Lambda + S3)
- Groq API key (free tier available)

### Local Development (Frontend Only)

```bash
cd BoroBhai/app
npm install
cp .env.example .env.local
# Fill in Groq API key and AWS credentials in .env.local
npm run dev
# Open http://localhost:3000
```

### Full Stack Deployment

See **DEPLOYMENT.md** for step-by-step AWS setup:
1. Create IAM roles (Lambda execution, API Gateway invoke)
2. Deploy S3 bucket with lifecycle rules
3. Deploy Lambda functions (Bedrock orchestrator, file tools)
4. Deploy HTTP API Gateway
5. Update frontend .env.local with API endpoints

## Cost Breakdown

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| **Bedrock** | ~$0.50 | Claude 3.5 Sonnet: ~$0.50/1M input tokens at scale |
| **Groq STT** | ~$2-5 | Whisper API: $0.004/min for Bengali transcription |
| **S3 Storage** | ~$1 | Lifecycle auto-delete after 7 days |
| **Lambda** | Included | Free tier covers typical usage; ~$0.20/10M requests |
| **EC2 (optional)** | $0 | Reuses existing t4g.large for Qdrant (if needed) |
| **Total** | ~$3-7 | Plus baseline AWS infrastructure (not incremental) |

## Who Built It?

**BoroBhai** is built by **Najmun Nahar Khan** @ **RoosCloset Labs** as a pro bono civic technology project to empower Bengali-speaking citizens.

**Founder**: Najmun Nahar Khan  
**Company**: RoosCloset Labs, Dhaka, Bangladesh  
**Email**: najmun@rooscloset.store  
**Phone**: +8801798344063  
**Website**: www.rooscloset.store  
**GitHub**: https://github.com/najmun-ai  

**Launch Date**: July 2026  
**Target Users**: Bangladeshi citizens navigating government processes  
**License**: MIT (open source)

## Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — AWS deployment guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Technical deep-dive
- **[AWS_RESOURCES.md](./AWS_RESOURCES.md)** — Complete AWS product inventory
- **[API.md](./API.md)** — Endpoint reference
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Local dev setup
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** — 5-minute walkthrough
- **[COST_BREAKDOWN.md](./COST_BREAKDOWN.md)** — Detailed pricing

## Quick Commands

```bash
# Local development
npm run dev

# Build frontend
npm run build

# Deploy infrastructure (requires AWS CLI + CDK)
cd lib && cdk deploy

# Format code
npm run lint

# Run tests
npm run test
```

## Support & Feedback

Questions or issues? [Create an issue](https://github.com/your-org/borobhai/issues) or email [najmun@rooscloset.store](mailto:najmun@rooscloset.store).

---

**Made for civic empowerment**
