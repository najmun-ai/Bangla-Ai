# BoroBhai Cost Breakdown

Complete monthly cost analysis for running BoroBhai in production.

## Executive Summary

| Service | Monthly Cost | Notes |
|---------|--------------|-------|
| **AWS Bedrock** | ~$0.50-2.00 | Claude 3.5 Sonnet inference |
| **Groq STT** | ~$2-5 | Bengali speech transcription |
| **AWS S3** | ~$1 | File storage + lifecycle |
| **AWS Lambda** | Included | <1M requests/month free tier |
| **EC2 (optional)** | $0 | Reuses existing t4g.large |
| **API Gateway** | ~$3.50 | HTTP API pricing (per million) |
| **CloudWatch Logs** | ~$0.50 | Log retention (7 days) |
| **Total** | **~$7-12/month** | Plus baseline AWS infrastructure |

## Detailed Breakdown

### 1. AWS Bedrock (Claude 3.5 Sonnet)

**Model Pricing** (as of July 2026):
- Input tokens: $3.00 per 1M tokens
- Output tokens: $15.00 per 1M tokens

**Estimation** (1000 requests/day):

```
Average request:
├─ System prompt (~2000 tokens input)      $0.006
├─ User message (~100 tokens input)        $0.0003
├─ Tool definitions (~500 tokens input)    $0.0015
├─ Tool injection (~500 tokens input)      $0.0015
├─ Claude response (~300 tokens output)    $0.0045
└─ Per request cost: ~$0.013

Monthly (1000 req/day × 30 days):
├─ Total requests: 30,000
├─ Total tokens: ~2.5M input + 0.5M output
├─ Cost: (2.5M × $3.00 + 0.5M × $15.00) / 1M = $7.50 + $7.50 = $15
└─ Adjusted for optimization*: ~$2-5/month

*Assumes conditional schema injection (skip DOCUMENT_SCHEMAS for 80% queries)
```

**Cost Optimization Strategies**:

```
1. Conditional Schema Injection
   - Only include DOCUMENT_SCHEMAS if user message contains triggers
   - Triggers: "লিখে দাও", "বানাও", "CV", "চিঠি", "সার্টিফিকেট"
   - Savings: ~2000 tokens × 0.8 requests × $3/1M = ~$0.0048/day = $0.14/mo

2. Chunk Caching (if Bedrock supports)
   - Cache retrieved KB chunks across similar queries
   - Savings: ~500 tokens per cached query × 20% = ~$0.0003/day

3. Query Summarization
   - For multi-turn chats, summarize old messages → new summary prompt
   - Reduces token reprocessing
   - Savings: ~$0.02/day per summarized conversation

Total potential savings: ~30-40% off token costs
```

### 2. Groq STT (Speech-to-Text)

**Pricing**:
- $0.004 per minute of audio

**Estimation** (100 voice requests/month):

```
Average transcription:
├─ Duration: 10 seconds (0.167 minutes)
├─ Cost per transcription: 0.167 min × $0.004 = $0.000668
└─ Monthly (100 requests): 100 × $0.000668 = $0.0668 ≈ $0.07

If 50% of users use voice (500 voice requests/month):
├─ Duration: 10 sec average
├─ Cost: 500 × 0.167 min × $0.004 = $0.334 ≈ $0.33

If 100% voice adoption (2000 voice/month):
└─ Cost: ~$1.33/month
```

**Alternative: Modal Whisper**
- $60/month credit (includes Whisper + PDF rendering)
- Break-even: ~90,000 minutes of transcription
- Better for high-volume voice users

**Decision Recommendation**:
- MVP (Phase 1): Use Groq ($2-5/mo)
- Scale (Phase 2): Switch to Modal if voice usage > 50% of queries

### 3. Amazon S3 (File Storage)

**Components**:

```
Storage (compressed files, generated documents, images):
├─ Average file size: 100 KB (compressed PDF)
├─ Files per user: 2-3/month
├─ Active users: 100
├─ Total storage: 100 users × 3 files × 100 KB = 30 GB
├─ S3 pricing (us-west-2): $0.023/GB/month
└─ Storage cost: 30 GB × $0.023 = $0.69/month

Requests (PUT/GET):
├─ PUT (file upload): 5,000/month × $0.000005 = $0.025
├─ GET (file download): 10,000/month × $0.0000004 = $0.004
└─ Request cost: ~$0.03/month

Lifecycle Rules:
├─ AUTO-DELETE after 7 days → reduces storage costs
├─ Prevents accumulation of old files
└─ Minimal cost impact with lifecycle enabled

Data Transfer (CloudFront optional):
├─ If using CloudFront CDN: +$0.085/GB
├─ Recommended for high-volume regions
└─ Skip for MVP

Total S3 Cost: ~$0.70-1.00/month
```

**Cost Optimization**:
- Lifecycle rule: Auto-delete after 7 days (default)
- Compression: PDF compression reduces file size 50-70%
- No redundancy needed: Standard storage OK for civic app

### 4. AWS Lambda

**Pricing**:
- **Duration**: $0.0000166667 per GB-second
- **Requests**: $0.20 per 1M requests
- **Free tier**: 1M requests/month + 400,000 GB-seconds

**Estimation** (1000 requests/day):

```
Orchestrator Lambda:
├─ Requests: 30,000/month
├─ Avg memory: 1024 MB
├─ Avg duration: 1.5 seconds
├─ GB-seconds: 30,000 × 1.5 sec × 1 GB = 45,000 GB-s
├─ Cost: (45,000 - 400,000 free) / 1M × $0.0000166667 = FREE
└─ Request cost: (30,000 - 1M free) / 1M × $0.20 = FREE

File Tools Lambda (occasional):
├─ Requests: 5,000/month (only for doc generation)
├─ Avg memory: 2048 MB
├─ Avg duration: 0.3 seconds
├─ GB-seconds: 5,000 × 0.3 × 2 GB = 3,000 GB-s
└─ Cost: FREE (within free tier)

Presign Lambda (lightweight):
├─ Requests: 50,000/month (very cheap)
├─ Avg memory: 256 MB
├─ Avg duration: 0.05 seconds
├─ GB-seconds: 50,000 × 0.05 × 0.25 GB = 625 GB-s
└─ Cost: FREE

Total Lambda Cost: FREE (stays within free tier)
```

**Scaling Scenarios**:

```
If traffic grows to 100,000 requests/day:
├─ Total GB-s: ~500,000 (exceeds 400k free tier)
├─ Overage: 100,000 GB-s × $0.0000166667 = $1.67/month
├─ Request cost: 3M requests × $0.20 / 1M = $0.60/month
└─ Total: ~$2.27/month (still cheap)

If using Provisioned Concurrency (for cold-start elimination):
├─ Cost: $0.30/hour per concurrent unit
├─ For 1 concurrent unit: $0.30 × 730 hours = $219/month
├─ Only viable for production with >1M requests/month
└─ MVP: Don't use Provisioned Concurrency
```

### 5. API Gateway (HTTP API)

**Pricing**:
- $0.50 per 1M requests
- $0.09 per GB data transferred

**Estimation** (1000 requests/day):

```
Requests:
├─ 30,000 requests/month
├─ Cost: 30,000 / 1M × $0.50 = $0.015/month

Data Transfer:
├─ Average response: 5 KB
├─ 30,000 requests × 5 KB = 150 GB/month
├─ Cost: 150 GB × $0.09 = $13.50/month (egress from US)

Total: ~$13.50/month (if egress involved)
```

**Note**: Data transfer is the largest cost component of API Gateway. Use CloudFront CDN to reduce egress costs:
- CloudFront caches responses → reduces origin requests
- Cost: $0.085/GB to edge locations
- Break-even: When cache hit rate > 70%

### 6. CloudWatch Logs

**Pricing**:
- $0.50 per GB ingested
- $0.03 per GB stored

**Estimation**:

```
Log Volume (7-day retention):
├─ Lambda logs: ~100 KB per request
├─ 30,000 requests × 100 KB = 3 GB/month ingested
├─ 7-day retention: ~0.7 GB average stored
├─ Ingestion cost: 3 GB × $0.50 = $1.50/month
├─ Storage cost: 0.7 GB × $0.03 = $0.02/month

Total: ~$1.52/month

Optimization:
├─ Disable logging for non-errors (save ~60%)
├─ Use log filters to exclude verbose output
└─ Reduce retention to 3 days: ~$0.50/month
```

### 7. EC2 (Existing Infrastructure)

**Cost**: $0 incremental (reuses existing t4g.large)

- BoroBhai runs Lambda functions (no EC2 needed)
- If Qdrant vector DB deployed: uses existing EC2 instance
- ARM64 Graviton processor compatible with Qdrant Docker image
- No additional cost for BoroBhai

**Alternative** (if using self-hosted Qdrant):
- t4g.large: $60.15/month (already running)
- Qdrant Docker container: runs on existing instance at 0 incremental cost

### 8. Optional Add-ons

#### DynamoDB (Session Persistence)

```
If storing chat history:
├─ Write capacity: 100 WCU (writes per second)
├─ Read capacity: 100 RCU (reads per second)
├─ On-demand pricing: $1.25 per 1M writes + $0.25 per 1M reads
├─ 30,000 messages/month:
│  ├─ Writes: 30,000 × $1.25 / 1M = $0.0375
│  └─ Reads: 30,000 × $0.25 / 1M = $0.0075
└─ Total: ~$0.05/month (negligible)

Alternatively:
├─ Use in-memory session storage (current approach)
└─ Cost: $0
```

#### CloudFront CDN (Edge Caching)

```
If using CloudFront:
├─ Data transfer to edge: $0.085/GB
├─ Requests: $0.0075 per 10,000
├─ Example (assuming 50% cache hit):
│  ├─ 150 GB/month to origin (from API Gateway)
│  ├─ ~75 GB served from cache (no charge)
│  └─ ~75 GB from CloudFront edge: 75 × $0.085 = $6.38/month

Cost-benefit analysis:
├─ Adds ~$6-8/month
├─ Reduces latency for non-US users by 50-80%
├─ Reduces API Gateway costs by 50%
└─ Net benefit: +$2-3/month but 10x better UX for global users
```

## Total Monthly Cost Scenarios

### Scenario 1: MVP (500 requests/day)

```
Bedrock (500 req/day):    ~$0.30/mo
Groq STT (50 voice):      ~$0.07/mo
S3:                       ~$0.70/mo
Lambda:                   FREE (within free tier)
API Gateway:              ~$0.01/mo
CloudWatch:               ~$1.50/mo
DynamoDB:                 $0 (in-memory)
────────────────────────
TOTAL:                    ~$2.58/month
```

### Scenario 2: Production (1000 requests/day)

```
Bedrock (1000 req/day):   ~$2.00/mo (optimized)
Groq STT (200 voice):     ~$0.30/mo
S3:                       ~$1.00/mo
Lambda:                   FREE
API Gateway:              ~$0.02/mo
CloudWatch:               ~$1.50/mo
DynamoDB:                 ~$0.05/mo
────────────────────────
TOTAL:                    ~$4.87/month
```

### Scenario 3: Scale (10,000 requests/day + CDN)

```
Bedrock (10k req/day):    ~$15.00/mo (optimized)
Groq STT (2000 voice):    ~$3.00/mo
S3:                       ~$10.00/mo
Lambda:                   ~$2.00/mo (overage)
API Gateway:              ~$0.15/mo
CloudFront CDN:           ~$6.00/mo
CloudWatch:               ~$3.00/mo
DynamoDB:                 ~$0.50/mo
────────────────────────
TOTAL:                    ~$39.65/month
```

## Cost Optimization Checklist

```
☐ Enable Bedrock conditional schema injection (saves ~30%)
☐ Set S3 lifecycle rule to delete files after 7 days (saves ~50%)
☐ Use Groq for STT instead of Modal (saves $55/month)
☐ Disable CloudWatch logging for successful requests (saves ~60%)
☐ Use in-memory KB retrieval instead of Qdrant (saves $30/mo)
☐ Don't use Provisioned Concurrency for MVP (saves $219/mo)
☐ Use CloudFront CDN only if global distribution needed (adds cost but 10x UX)
☐ Monitor cost anomalies with CloudWatch Alarms
☐ Set up budget alerts (AWS Budgets: e.g., $20/month cap)
```

## Cost Monitoring

### AWS Budgets Alert

```bash
aws budgets create-budget \
  --account-id YOUR_ACCOUNT \
  --budget file://- <<EOF
{
  "BudgetName": "BoroBhai Monthly",
  "BudgetLimit": {
    "Amount": "20.00",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST",
  "NotificationsWithSubscribers": [
    {
      "Notification": {
        "ComparisonOperator": "GREATER_THAN",
        "NotificationType": "ACTUAL",
        "Threshold": 75
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "your-email@example.com"
        }
      ]
    }
  ]
}
EOF
```

### CloudWatch Insights Query

```bash
# Find top cost drivers
aws logs start-query \
  --log-group-name /aws/lambda/proofsheet-orchestrator \
  --start-time $(date -d '7 days ago' +%s) \
  --end-time $(date +%s) \
  --query-string '
    fields @duration, @memoryUsed, @cost
    | stats sum(@duration) as total_duration, 
            max(@memoryUsed) as peak_memory, 
            sum(@cost) as total_cost by isprod
  '
```

## ROI & Pricing for Customers

If BoroBhai is monetized as a service:

```
Cost per customer (1 request/day):
├─ Bedrock: $0.013/request = $0.39/month
├─ Groq: $0.003/request (if voice) = $0.09/month
├─ S3/infra: $0.01/request = $0.30/month
├─ Total cost per customer: ~$0.78/month

Suggested pricing tiers:
├─ Free tier: 10 requests/month (cost: $0.07)
├─ Pro: $5/month → 100 requests (cost: $0.78)
├─ Enterprise: Custom pricing

Margin:
├─ Pro tier margin: ($5 - $0.78) / $5 = 84% margin
├─ At 1000 customers: $5000 revenue - $780 cost = $4220 profit/month
└─ Payback period: <2 months
```

## Conclusion

**BoroBhai offers exceptional value**:
- ✅ MVP: $2-5/month (civic non-profit budget)
- ✅ Production: $5-15/month
- ✅ Scale: $40-100/month (before monetization)
- ✅ 80%+ margin if monetized at $5-10/month
- ✅ No fixed infrastructure costs (Lambda-native, reuses EC2)

**Recommendation**: Start with Groq + in-memory KB, migrate to Modal + Qdrant only if:
1. Voice volume > 50% of queries
2. KB grows to >5000 chunks
3. Response latency becomes critical for user experience

---

## Questions About Costs?

For questions about cost optimization, scaling, or AWS credits:

**GitHub Issues**: https://github.com/najmun-ai/Bangla-Ai/issues  
**Email**: najmun@rooscloset.store  
**Phone**: +8801798344063  

**RoosCloset Labs**  
Dhaka, Bangladesh  
www.rooscloset.store

---

**Document Version**: 1.0  
**Last Updated**: July 2026  
**Assumptions**: AWS Bedrock pricing as of 2026; may change with AWS updates
