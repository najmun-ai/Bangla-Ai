# AWS Resources & Architecture Reference

Complete inventory of all AWS products, services, and resources used by BoroBhai — both **currently deployed** and **planned for future phases**.

---

## Currently Deployed AWS Resources

### 1. **EC2 (Elastic Compute Cloud)**

**Instance Details:**
- **Type**: t4g.large (Graviton ARM64 processor)
- **Region**: us-west-2
- **OS**: Ubuntu 24.04 (ARM64)
- **vCPU**: 2 cores
- **Memory**: 8 GB RAM
- **Current Usage**: Development environment, Qdrant hosting (optional), knowledge base storage
- **Monthly Cost**: ~$60-80 (reused for multiple workloads)
- **Status**: ✅ Running and active

**Current Workloads:**
- Development environment for BoroBhai frontend/backend
- Optional Qdrant Docker container (vector database)
- Knowledge base JSON files storage
- Lambda deployment pipeline testing
- CDK stack deployment tools

**Future Use:**
- Persistent Qdrant cluster for large KB (>5K chunks)
- Backup and disaster recovery node
- CI/CD runner (GitHub Actions self-hosted)
- Log aggregation server

**ARM64 Compatibility Notes:**
- All Docker images must be ARM64-compatible
- Qdrant: ✅ ARM64 native support
- Node.js/Python: ✅ Available as ARM64 binaries
- Benefits: 20-30% cost savings vs x86

---

### 2. **Lambda (AWS Lambda)**

**Functions Deployed:**

#### **A. Orchestrator Lambda**
```
Function Name: proofsheet-orchestrator
Runtime: Python 3.11
Memory: 512 MB (configurable up to 10 GB)
Timeout: 90 seconds
Trigger: HTTP API Gateway
Purpose: Main agentic loop - Bedrock orchestration + tool routing
```

**Current Capabilities:**
- Invoke Bedrock Claude 3.5 Sonnet
- Tool-use loop (up to 5 iterations)
- Response streaming to frontend
- Error handling & retry logic
- Conditional schema injection

**Future Enhancements:**
- Support for Claude 5 (when available)
- Concurrent tool execution (parallel file ops)
- Advanced prompt caching (reduce token cost)
- Rate limiting per user

---

#### **B. File Tools Lambda**
```
Function Name: proofsheet-file-tools
Runtime: Python 3.11 (container image)
Memory: 1024 MB (configurable)
Timeout: 60 seconds
Trigger: Called by Orchestrator Lambda
Purpose: Document generation + file manipulation
```

**Current Capabilities:**
- PDF compression (iterative quality reduction)
- PDF merging
- Image resizing (Pillow)
- Excel/CSV generation
- DOCX generation (CV, letters, agreements)
- Bengali font embedding
- Base64 image processing

**Dependencies:**
- PyMuPDF (PDF operations)
- Pillow (image processing)
- openpyxl (Excel generation)
- python-docx (Word document generation)
- Noto Sans Bengali font
- Hind Siliguri font

**Future Enhancements:**
- OCR for document extraction (Textract integration)
- Batch processing queue (SQS)
- S3 Select for CSV parsing
- Advanced image optimization

---

#### **C. Presign Lambda**
```
Function Name: proofsheet-presign
Runtime: Python 3.11
Memory: 256 MB
Timeout: 10 seconds
Trigger: HTTP API Gateway (/api/presign-upload)
Purpose: Generate S3 presigned URLs for file upload/download
```

**Current Capabilities:**
- Generate presigned PUT URLs (user uploads)
- Generate presigned GET URLs (file downloads)
- URL expiration handling (15 minutes default)
- Request validation

**Future Enhancements:**
- Per-user rate limiting
- File type validation
- Virus scanning integration (ClamAV)
- Audit logging to CloudTrail

---

### 3. **S3 (Simple Storage Service)**

**Bucket Configuration:**

```
Bucket Name: proofsheet-user-files
Region: us-west-2
Versioning: Disabled (cost optimization)
Encryption: AES-256 (server-side, default)
Public Access: Blocked (private bucket)
```

**Folder Structure:**
```
s3://proofsheet-user-files/
├── users/{user_id}/
│   ├── uploads/              # User-uploaded files
│   ├── compressed/           # Compressed PDFs
│   ├── merged/              # Merged documents
│   ├── images/              # Resized images
│   ├── exports/             # Generated Excel files
│   ├── letters/             # Generated DOCX letters
│   └── cv/                  # Generated CVs
├── knowledge_base/           # Pre-embedded chunks
│   └── procedures_embedded/  # Bedrock Titan embeddings (JSON)
└── backups/                  # Disaster recovery (optional)
```

**Lifecycle Rules:**
- **Auto-delete user files**: 7 days (GDPR/privacy compliance)
- **Archive old logs**: 30 days → Glacier (cost optimization)
- **Delete incomplete uploads**: 1 day (cleanup)

**CORS Configuration:**
```json
{
  "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
  "AllowedMethods": ["GET", "PUT", "POST"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3000
}
```

**Current Costs:**
- Storage: ~$1-5/month (user files + KB)
- Requests: <$0.50/month (typical usage)
- **Total**: ~$1-6/month

**Future Uses:**
- Knowledge base versioning (multiple KB snapshots)
- User session backup (JSON exports)
- Analytics data warehouse (logs + metrics)
- Media library (images, templates)

---

### 4. **Bedrock (Generative AI)**

**Models Used:**

#### **A. Claude 3.5 Sonnet (Text Generation)**
```
Model ID: anthropic.claude-3-5-sonnet-20241022
Purpose: Main agentic orchestrator for chat
Context Window: 200K tokens
Input Cost: ~$3 per 1M tokens
Output Cost: ~$15 per 1M tokens
Routing: Always used for complex user queries
```

**Capabilities:**
- Natural language understanding
- Tool-use (function calling)
- Streaming responses
- Multi-turn conversations
- Bengali context awareness

**Current Usage:**
- ~50-200 requests/day (MVP scale)
- Average tokens: 2-3K per request
- **Monthly cost**: ~$10-15

**Future Models:**
- Claude 5 (when available, faster/cheaper)
- Claude 3 Haiku (cost optimization for simple queries)
- Claude 3 Opus (complex reasoning tasks)

---

#### **B. Amazon Titan Embeddings (Vector Generation)**
```
Model ID: amazon.titan-embed-text-v2:0
Purpose: Convert text → 1024-dim vectors
Input Cost: ~$0.0001 per 100 tokens
Dimensions: 1024 (normalized)
```

**Current Usage:**
- Pre-compute embeddings once at ingestion
- ~179 chunks × 1 call = $0.001 total
- Runtime: 1 call per user query (~$0.10/1000 queries)

**Future Uses:**
- Re-embed KB quarterly (new procedures added)
- User profile embeddings (personalization)
- Document similarity analysis
- Clustering civic procedures by theme

---

### 5. **API Gateway (HTTP API)**

**Configuration:**
```
Name: proofsheet-api
Protocol: HTTP/2 (not REST)
Route Selection: $1.00/million requests
Data Transfer: $0.50/GB (outbound)
Target: Lambda functions
```

**Routes:**
```
POST /api/chat              → Orchestrator Lambda (streaming)
POST /api/upload            → Presign Lambda
POST /api/stt              → Groq STT proxy (frontend)
GET /api/presign-upload    → Presign Lambda
```

**Current Costs:**
- Routes: <$1/month (typical usage)
- Data: <$1/month

**CORS Headers:**
```
Access-Control-Allow-Origin: https://yourdomain.com
Access-Control-Allow-Methods: POST, GET, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**Future Enhancements:**
- API key authentication
- Rate limiting (throttle: 10,000 req/sec)
- Request logging to CloudWatch
- Mock endpoints for testing

---

### 6. **CloudWatch (Monitoring & Logging)**

**Log Groups:**
```
/aws/lambda/proofsheet-orchestrator    (chat logs)
/aws/lambda/proofsheet-file-tools      (file operation logs)
/aws/lambda/proofsheet-presign         (presign logs)
/aws/apigateway/proofsheet-api         (API access logs)
```

**Retention:**
- Default: 7 days (cost optimization)
- Production: 30 days (compliance)

**Current Metrics Tracked:**
- Lambda invocation count
- Lambda duration (P50, P99)
- Lambda errors
- API Gateway requests
- Bedrock token usage
- S3 operations

**Future Uses:**
- Custom dashboards (CloudWatch Dashboards)
- Alarms (SNS notifications on errors)
- Log Insights queries (complex analysis)
- X-Ray tracing (request flow visualization)

**Monthly Cost:**
- Logs: ~$1-3 (7-day retention)
- Metrics: <$0.50
- Dashboards: Free (up to 3)

---

### 7. **IAM (Identity & Access Management)**

**Roles & Policies:**

#### **Lambda Execution Role**
```
Role Name: ProofSheetLambdaExecutionRole
Policies:
  1. AWSLambdaBasicExecutionRole
     - CloudWatch Logs (PutLogEvents)
  2. Custom: Bedrock invoke
     - bedrock:InvokeModel (Claude Sonnet)
     - bedrock:InvokeModel (Titan Embeddings)
  3. Custom: S3 access (principle of least privilege)
     - s3:GetObject (procedures_embedded/)
     - s3:PutObject (user/{user_id}/*)
     - s3:DeleteObject (lifecycle cleanup)
  4. Custom: Presign URLs
     - s3:GetSignedUrl
     - s3:PutSignedUrl
```

**Trust Relationship:**
```json
{
  "Service": "lambda.amazonaws.com"
}
```

**Future Roles:**
- API Gateway role (invoke Lambda)
- DynamoDB role (session persistence)
- CloudFormation role (CDK deployments)

---

## Future AWS Resources (Planned)

### 1. **DynamoDB (NoSQL Database)**

**Purpose**: User session persistence, chat history

**Current Status**: ⏳ Not deployed (in-memory only)

**Future Configuration:**
```
Table Name: borobhai-sessions
Partition Key: user_id (String)
Sort Key: timestamp (Number)
TTL: 30 days (auto-expire old sessions)
Billing Mode: Pay-per-request
```

**Estimated Cost**: ~$5-10/month (at scale)

**Use Cases:**
- Store chat history across sessions
- User preferences (language, document defaults)
- Rate limiting per user
- Audit trail for compliance

---

### 2. **Qdrant Vector Database**

**Current Status**: 🔄 Optional (in-memory JSON fallback)

**Future Deployment Options:**

#### **Option A: Self-Hosted on EC2**
```
Instance: t4g.large (existing)
Docker Image: qdrant/qdrant:latest-arm64
Port: 6333 (HTTP API)
Disk: 50 GB EBS volume
Cost: $0 incremental (reuse EC2)
Collection: procedures (179 chunks, 1024-dim vectors)
```

#### **Option B: Qdrant Cloud (Managed)**
```
Cluster Size: Small (dev), Medium (prod)
Storage: 10 GB (scalable)
Monthly Cost: $50-200
SLA: 99.9% uptime
Backup: Automatic daily
```

**When to Migrate:**
- KB grows beyond 1,000 chunks
- Query latency becomes critical
- Availability SLA required
- Multiple regions needed

---

### 3. **SageMaker (Machine Learning)**

**Potential Uses:**
- Fine-tune Claude on Bengali civic procedures
- Custom embeddings (domain-specific)
- Named Entity Recognition (NER) for Bengali
- Sentiment analysis on user feedback

**Estimated Cost**: $50-500/month (depending on workload)

---

### 4. **Textract (Document Processing)**

**Purpose**: Extract text from user-uploaded PDFs/images

**Use Case**: Inject extracted text into RAG context

**Pricing**: $1.50 per 1,000 pages (async), $2.50 per 1,000 pages (sync)

**When Needed**: Phase 3+ (advanced document processing)

---

### 5. **Comprehend (NLP Service)**

**Purpose**: Bengali language detection, sentiment analysis, key phrase extraction

**Use Cases:**
- Detect user frustration (trigger escalation)
- Extract key terms for better retrieval
- Language detection (Bengali vs Banglish vs English)

**Pricing**: $0.0002 per unit (variable by task)

---

### 6. **Secrets Manager (Credential Storage)**

**Current Status**: ⏳ Not used (placeholder keys in .env)

**Future Implementation:**
```
Secrets Stored:
  - GROQ_API_KEY
  - BEDROCK_API_KEY
  - Modal API token
  - Database credentials
  - OAuth tokens
```

**Cost**: $0.40/secret/month + request fees

**Security Benefits:**
- Automatic rotation
- CloudTrail audit logs
- Encryption at rest (KMS)
- No hardcoded credentials

---

### 7. **RDS (Relational Database Service)**

**Potential Future Use**: PostgreSQL for session management

**Why Not Now**: DynamoDB is cheaper for this scale

**When Needed**: If complex relational queries required

---

### 8. **ElastiCache (In-Memory Cache)**

**Potential Use**: Cache Bedrock responses, vector search results

**Benefit**: Reduce latency on repeated queries

**Cost**: $15-50/month (small Redis cluster)

**When Needed**: P99 latency becomes critical

---

### 9. **OpenSearch (Full-Text Search)**

**Current Status**: ❌ NOT recommended (expensive, $700/mo minimum)

**Alternative**: Use S3 + Athena for log analysis

---

### 10. **EventBridge (Event-Driven Architecture)**

**Potential Uses:**
- Trigger embeddings on KB update
- Fan-out document generation
- User activity tracking

**Cost**: $0.35/million events

---

### 11. **SNS (Simple Notification Service)**

**Potential Uses:**
- Email alerts on Lambda errors
- SMS notifications for urgent civic alerts
- Slack integration for team notifications

**Cost**: $0.50/1M requests

---

### 12. **SQS (Simple Queue Service)**

**Potential Uses:**
- Queue heavy file operations
- Batch document generation
- Decouple frontend from backend

**Cost**: $0.40/1M requests

---

## AWS Cost Summary

### Current Monthly Costs
| Service | Cost | Notes |
|---------|------|-------|
| **EC2** | $60-80 | t4g.large, reused |
| **Lambda** | $1-2 | Orchestrator + file tools + presign |
| **S3** | $1-6 | Storage + requests |
| **Bedrock** | $10-15 | Claude Sonnet ($10), Titan embeddings ($0.10) |
| **API Gateway** | <$1 | Routes + data transfer |
| **CloudWatch** | $1-3 | Logs (7-day retention) |
| **Groq STT** | $2-5 | External service (not AWS) |
| **Total** | **$75-112/mo** | At current usage scale |

### Future Costs (if all services deployed)
| Service | Cost | Scale |
|---------|------|-------|
| All above | $75-112 | MVP |
| + DynamoDB | +$5-10 | Sessions (1M requests) |
| + Qdrant Cloud | +$50-200 | Vector DB (managed) |
| + Textract | +$10-50 | Document processing |
| + RDS | +$20-50 | Database (optional) |
| + ElastiCache | +$15-50 | Caching (optional) |
| **Total (Full Stack)** | **$175-472/mo** | Production scale |

---

## AWS Regions & Availability

**Primary Region**: us-west-2 (Graviton t4g available)
- EC2 instances
- S3 buckets
- Lambda functions
- Bedrock
- DynamoDB (if deployed)

**Alternative Regions**:
- us-east-1 (cheapest, widest service availability)
- eu-west-1 (GDPR compliance, if needed)

**Multi-Region Strategy** (Future):
- Replicate S3 to us-east-1 (cross-region replication)
- Run Lambda in multiple regions (global API)
- Route traffic via CloudFront CDN

---

## AWS IAM Best Practices Applied

✅ **Least Privilege**: Each Lambda has minimal permissions  
✅ **Service Roles**: Dedicated role per Lambda function  
✅ **No Hardcoded Credentials**: Use IAM roles, Secrets Manager  
✅ **Encryption**: S3 AES-256, KMS for sensitive data  
✅ **Audit Logging**: CloudTrail enabled (CloudWatch logs)  
✅ **Resource Tags**: Tag all resources by environment/cost-center  

---

## AWS Account Setup Checklist

Before deploying BoroBhai, ensure:

- [ ] AWS account created + billing enabled
- [ ] Bedrock access enabled (Claude 3.5 Sonnet)
- [ ] EC2 t4g.large running (dev environment)
- [ ] S3 bucket created (proofsheet-user-files)
- [ ] IAM role created (ProofSheetLambdaExecutionRole)
- [ ] CloudWatch log groups created
- [ ] API Gateway HTTP API created
- [ ] Lambda functions deployed
- [ ] Environment variables configured
- [ ] CORS policies set on S3
- [ ] CloudTrail enabled (auditing)
- [ ] Billing alerts configured (prevent cost overruns)

---

## Monitoring & Cost Optimization

### CloudWatch Dashboards (Recommended)
```
Dashboard: BoroBhai-Metrics
Widgets:
  1. Lambda invocation count (by function)
  2. Lambda duration (P50, P99, P99.9)
  3. Lambda error rate
  4. Bedrock token usage
  5. S3 request count
  6. S3 storage size
  7. API Gateway request count
  8. CloudWatch log volume
```

### Cost Optimization Tips
1. **Use Lambda provisioned concurrency** → Eliminate cold starts
2. **Enable S3 Intelligent-Tiering** → Auto-archive old files
3. **Use CloudFront CDN** → Cache static assets + API responses
4. **Batch Bedrock calls** → Group requests where possible
5. **Schedule cleanup jobs** → Auto-delete old logs, orphaned files
6. **Use Reserved Capacity** (future) → 30-40% EC2 discount
7. **Enable S3 Block Public Access** → Prevent accidental exposure

---

## Security Best Practices

✅ **Network Security**:
- API Gateway + Lambda only (no public EC2 access)
- S3 bucket private (presigned URLs for access)
- Security groups restrict EC2 access

✅ **Data Security**:
- S3 AES-256 encryption at rest
- HTTPS for all API calls
- 7-day auto-delete lifecycle (PII protection)

✅ **Access Control**:
- IAM roles with least privilege
- API key authentication (future)
- CloudTrail audit logs

✅ **Compliance**:
- No logging of file contents (privacy)
- User session expiry (30 days)
- GDPR-compliant data deletion

---

## Disaster Recovery

**Current Backup Strategy**:
- Knowledge base JSON backed up to S3
- Lambda code in GitHub
- Infrastructure code (CDK) in GitHub
- User files auto-delete after 7 days (no long-term backup)

**Future Improvements**:
- Cross-region S3 replication
- DynamoDB Point-in-Time Recovery
- EC2 AMI snapshots
- Automated failover (Multi-AZ)

**RTO/RPO**:
- RTO (Recovery Time Objective): <1 hour
- RPO (Recovery Point Objective): <1 day
- Backup frequency: Daily

---

## Next Steps

1. **Review** this AWS_RESOURCES.md file
2. **Follow** DEPLOYMENT.md for step-by-step setup
3. **Monitor** costs in AWS Cost Explorer
4. **Plan** Phase 2+ services as needed
5. **Optimize** based on actual usage patterns

---

**Document Version**: 1.0  
**Last Updated**: July 2026  
**Maintainer**: Najmun Nahar Khan (RoosCloset Labs)  
**Next Review**: January 2027 (post-launch)
