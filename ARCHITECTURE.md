# BoroBhai Architecture

## System Overview

BoroBhai is a 5-layer Bengali civic AI assistant that combines conversational AI, document generation, and file manipulation.

```
┌─────────────────────────────────────────────────────────────────┐
│                   User Interface Layer                          │
│  Next.js 14 App Router | React 18 | Tailwind CSS | Web Speech   │
│  • Chat pane (messages + streaming)                             │
│  • Document pane (preview + download)                           │
│  • Voice input (bn-BD transcription)                            │
│  • File upload (S3 presigned URLs)                              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    API Integration Layer                        │
│  Next.js API Routes | Node.js Runtime | Vercel AI SDK           │
│  • /api/chat → AWS Bedrock invocation + streaming               │
│  • /api/upload → S3 presigned URL generation                    │
│  • /api/stt → Groq Whisper transcription (fallback)            │
│  • /api/presign-upload → Client-side file PUT                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                  Bedrock Orchestration Layer                    │
│  AWS Bedrock | Claude 3.5 Sonnet | Tool-Use Enabled            │
│  • Receives user message + system prompt + tools                │
│  • Evaluates: chat response OR invoke tool(s)                   │
│  • Routes tool calls to Lambda functions                        │
│  • Streams final response to frontend                           │
│                                                                 │
│  Tools Available:                                               │
│  ├─ compress_pdf (PyMuPDF)                                      │
│  ├─ merge_pdfs (PyMuPDF)                                        │
│  ├─ resize_image (Pillow)                                       │
│  ├─ generate_excel (openpyxl)                                   │
│  ├─ generate_letter_docx (python-docx + Jinja2)               │
│  └─ generate_cv_docx (python-docx + templates)                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                    Lambda Functions Layer                       │
│  AWS Lambda (Python 3.11) | Docker Container Support            │
│  • proofsheet-orchestrator: Bedrock invocation + agentic loop   │
│  • proofsheet-file-tools: PDF/image/Excel/DOCX generation      │
│  • proofsheet-presign: S3 presigned URL generation              │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                   Storage & Retrieval Layer                     │
│  AWS S3 | DynamoDB | In-Memory KB | Amazon Titan Embeddings     │
│  • S3: User files (compressed/, images/, exports/, letters/)    │
│  • DynamoDB: Chat history (optional, for session recovery)      │
│  • In-Memory KB: 179 pre-embedded chunks (1024-dim Titan)       │
│  • Retrieval: Hybrid search (cosine similarity + BM25)          │
│  • Lifecycle: Auto-delete files after 7 days                    │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: "আমার CV তৈরি করো" (Create my CV)

```
User Input (Bengali text or speech)
    │
    ├─→ Frontend: useStreamChat() hook
    │   └─→ POST /api/chat { messages, files, context }
    │
    ├─→ Next.js API Route (/api/chat/route.ts)
    │   └─→ Call AWS Bedrock (Claude 3.5 Sonnet)
    │
    ├─→ Bedrock Orchestrator
    │   └─→ System Prompt: [DOCUMENT_SCHEMAS] (only if "CV" detected)
    │   └─→ Retrieval: Query expanded → Titan embed → hybrid search
    │   └─→ Tools Available: generate_cv_docx, compress_pdf, etc.
    │   └─→ Decision: "User wants CV → invoke generate_cv_docx"
    │
    ├─→ Lambda: generate_cv_docx()
    │   ├─→ Extract fields from user query (education, experience)
    │   ├─→ Render Jinja2 template
    │   ├─→ Generate DOCX with python-docx
    │   └─→ Upload to S3: s3://proofsheet-user-files/users/{user_id}/exports/cv.docx
    │
    ├─→ Bedrock Response
    │   └─→ "CV তৈরি হয়েছে। [DOCUMENT_READY] 📄 Download"
    │   └─→ Returns presigned S3 URL
    │
    └─→ Frontend: MessageBubble + DocumentCard
        ├─→ Render chat message with empathy marker (📄)
        └─→ DocumentCard with download button
            └─→ User clicks → Direct S3 download (presigned URL)
```

## Retrieval Pipeline

### Knowledge Base Structure

```json
// unified_knowledge_base.json (179 chunks, pre-embedded)
[
  {
    "id": "proc_001",
    "title": "পাসপোর্ট আবেদন",
    "category": "নাগরিক",
    "chunk": "পাসপোর্ট আবেদনের জন্য প্রয়োজনীয় কাগজপত্র...",
    "embedding": [0.123, -0.456, ...],  // 1024-dim Titan
    "flag": "document_generation",
    "language": "Bengali"
  },
  ...
]
```

### Query Processing

1. **User Query**: "আমার CV তৈরি করো" (Create my CV)

2. **Query Expansion** (in system prompt):
   - Detect triggers: "CV", "তৈরি করো", "লিখে দাও"
   - Expand: "CV + resume + work experience + education"

3. **Hybrid Search**:
   ```python
   # Semantic search
   query_embedding = bedrock_embed(user_query)  # Titan Embed v2
   semantic_matches = cosine_similarity(query_embedding, kb_embeddings)
   
   # Keyword search (BM25)
   keyword_matches = bm25_rank(user_query, kb_chunks)
   
   # Fusion (RRF: Reciprocal Rank Fusion)
   final_ranking = rrf(semantic_matches, keyword_matches)
   top_3_chunks = final_ranking[:3]
   ```

4. **Chunk Injection** into system prompt:
   ```
   [RETRIEVED_CONTEXT]
   1. পাসপোর্ট: প্রয়োজনীয় কাগজপত্র...
   2. শিক্ষা সনদ: ডিজিটাল সার্টিফিকেট...
   3. অভিজ্ঞতা: প্রথম চাকরির আবেদন...
   
   [DOCUMENT_SCHEMAS]
   CV_TEMPLATE: {education: [], experience: [], skills: []}
   LETTER_TEMPLATE: {recipient: "", body: "", signature: ""}
   ...
   ```

5. **Response Generation**:
   - Claude sees: user query + retrieved context + document templates
   - Decides: Direct chat OR generate document
   - If document: calls `generate_cv_docx()` tool

### Cost Optimization

| Scenario | Tokens Saved | Strategy |
|----------|--------------|----------|
| User asks non-doc question (80% of queries) | ~2500 | Skip `[DOCUMENT_SCHEMAS]` if no trigger words |
| Repeated KB queries | ~1024 | Cache embedding results (5-min TTL) |
| Large user files | ~5000+ | Compress PDF before embedding extraction |

## Key Decision Rationale

### Why In-Memory Retriever (Not Qdrant)?

**In-Memory KB Benefits**:
- ✅ **Zero network latency**: 10-50ms vs 200-500ms (Qdrant round-trip)
- ✅ **Cold-start optimization**: Singleton loaded once per Lambda container
- ✅ **No operational overhead**: No database to manage/monitor/backup
- ✅ **MVP-appropriate**: 179 chunks (481 KB) fit easily in memory

**Qdrant Migration Path** (Phase 2, if KB grows >5000 chunks):
```python
# Same interface, different backend:
def retrieve(query):
    embeddings = bedrock_embed(query)  # Still Titan
    if USE_QDRANT:
        results = qdrant_client.search(embeddings)  # Swap here
    else:
        results = in_memory_search(embeddings)  # Current
    return results
```

### Why Groq STT (Not Modal Whisper)?

| Dimension | Groq | Modal |
|-----------|------|-------|
| **Cost** | $2-5/mo | $60/mo credit |
| **Latency** | 100-500ms | 50-100ms |
| **Bengali Support** | 95%+ (Whisper large-v3) | 95%+ (Whisper large-v3) |
| **Scale** | Auto-scaling | Auto-scaling |
| **Best For** | Budget-conscious | Latency-critical |

**Decision**: Groq for MVP (pro bono budget), Modal as fallback if free credit unused.

### Why Titan Embeddings (Not OpenAI)?

| Model | Dims | Cost | Latency | Bengali |
|-------|------|------|---------|---------|
| Titan Embed v2 | 1024 | ~$0.10/1M | <100ms | Strong (trained on multilingual data) |
| OpenAI text-embedding-3-large | 3072 | ~$0.13/1M | 200-500ms | OK (no specific training) |
| Cohere Embed | 1024 | ~$0.10/1M | <100ms | OK |

**Decision**: Titan (native Bedrock integration, lowest latency, AWS cost credits apply).

### Why HTTP API Gateway (Not Lambda Function URLs)?

| Feature | HTTP API | Function URL |
|---------|----------|--------------|
| **Cold start** | Same | Same |
| **Custom domains** | ✅ | ❌ |
| **API keys** | ✅ | ❌ |
| **Rate limiting** | ✅ | ❌ |
| **Logging** | ✅ | ❌ |
| **Cost** | $3.50/mo | Free |

**Decision**: HTTP API for production (logging + rate limit), Function URL for dev.

## Document Generation Pipeline

### Supported Templates

```
CV Format:
├─ Personal info (name, email, phone, location)
├─ Education (school, degree, year)
├─ Experience (company, role, duration, responsibilities)
└─ Skills (technical, language, soft)

Letter Format:
├─ Header (sender details)
├─ Recipient (recipient name/address)
├─ Subject
├─ Body (paragraphs)
└─ Signature block

Trade License / Salary Certificate / Agreement:
├─ Pre-filled templates
├─ User field substitution
└─ Digital signature placeholder
```

### Generation Flow

```python
# Lambda handler receives tool call from Bedrock
@lambda_handler
def generate_cv_docx(event, context):
    # 1. Parse Bedrock tool input
    fields = event['tool_input']  # {education: [...], experience: [...]}
    
    # 2. Load Jinja2 template
    template = env.get_template('cv_template.jinja2')
    
    # 3. Render with Bengali formatting
    rendered_html = template.render(
        education=fields['education'],
        experience=fields['experience'],
        bn_num=bengali_numerals,  # Convert 2024 → ২০২৪
    )
    
    # 4. Generate DOCX
    doc = Document()
    parser = HtmlToDocx()
    parser.add_html_to_document(rendered_html, doc)
    
    # 5. Save to S3
    s3.put_object(
        Bucket='proofsheet-user-files',
        Key=f'users/{user_id}/exports/cv_{timestamp}.docx',
        Body=doc.getvalue(),
        ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    
    # 6. Return presigned URL
    url = s3.generate_presigned_url('get_object', ...)
    return {'document_url': url}
```

## Security Architecture

### Data Isolation

```
S3 Key Structure: s3://proofsheet-user-files/users/{user_id}/{type}/{filename}
                  ├─ compressed/        (PDF compression outputs)
                  ├─ images/            (resized images)
                  ├─ exports/           (generated exports, CVs, letters)
                  ├─ letters/           (government letters)
                  └─ merged/            (merged PDFs)

Lifecycle Rule: DELETE all objects after 7 days (prevents PII accumulation)
Lambda Role: S3 access scoped to proofsheet-user-files ONLY
Client Auth: Presigned URLs are time-limited (15 min default)
```

### Credential Management

```
NEVER in code:
├─ AWS_SECRET_ACCESS_KEY
├─ GROQ_API_KEY
└─ Bedrock region/model IDs

Store in:
├─ Environment variables (Lambda, Vercel)
├─ AWS Secrets Manager (production)
└─ IAM roles (no explicit credentials)

Frontend (.env.local):
├─ NEXT_PUBLIC_* only for non-sensitive (API endpoints)
└─ AWS_* for server-side API routes only
```

### Network Security

```
Frontend → Next.js API Routes (same-origin, SameSite=Strict)
                          ↓
                    AWS Bedrock (HTTPS only)
                          ↓
                  AWS Lambda + S3 (VPC optional)
                          ↓
                    Groq API (HTTPS only)

No direct S3 access from browser (except presigned URLs)
No direct Bedrock calls from frontend (always via Next.js API routes)
```

## Performance Characteristics

### Latency Breakdown (End-to-End)

```
User types "CV তৈরি করো" (Create CV)

1. Frontend → API route            5ms
2. API route → Bedrock            200ms  (roundtrip)
3. Bedrock processes query        500ms
   ├─ Embed query (Titan)        100ms
   ├─ Hybrid search               50ms
   ├─ System prompt assembly     100ms
   ├─ Claude generation          250ms
   └─ Tool decision               50ms
4. Tool invocation → Lambda       100ms
5. Lambda generates DOCX         300ms
   ├─ Template load               50ms
   ├─ Field extraction            50ms
   ├─ Jinja2 render              100ms
   ├─ python-docx DOCX build     100ms
   └─ S3 upload                   50ms
6. Presigned URL return            50ms
7. Frontend UI update              20ms
                                 ────
Total (synchronous)            ~1175ms

Streaming mode (with SSE):
- Bedrock response starts at ~700ms
- User sees first message chunk at ~750ms
- DOCX upload completes at ~1050ms
- Perceived latency: ~200-300ms (progressive)
```

### Concurrency & Scale

```
Lambda Concurrency:
├─ Orchestrator:   100 concurrent (default AWS limit)
├─ File tools:      50 concurrent (2GB memory per invocation)
└─ Presign:        500 concurrent (lightweight)

S3 Throughput:
├─ Requests/sec:  1000s (unlimited)
└─ Put/Get objects: Auto-scales

Bedrock API Limits:
├─ Requests/min:   1000s
└─ Token limit:     1M tokens/5min
```

### Cost Per Request

```
User Query: "CV তৈরি করো" (Generate CV)

Bedrock:
├─ System prompt (~2000 tokens)      ~$0.003
├─ User message (~100 tokens)        ~$0.0001
├─ Tool definition (~500 tokens)     ~$0.0008
├─ Claude response (~300 tokens)     ~$0.0009
└─ Subtotal: ~$0.005

Titan Embedding (query):
├─ 1 query embedding (50 tokens)     ~$0.0001
└─ Subtotal: ~$0.0001

Lambda (orchestrator):
├─ Execution time: 1.5s, 1024MB      ~$0.00003
└─ Subtotal: ~$0.00003

Lambda (file tools):
├─ Execution time: 0.3s, 2048MB      ~0.00001
└─ Subtotal: ~$0.00001

S3:
├─ PUT object (DOCX, ~50KB)          ~$0.000004
└─ Subtotal: ~$0.000004

Groq STT (if voice):
├─ 10 sec audio @ $0.004/min         ~$0.0007

Total per request: ~$0.006 (text) or ~$0.007 (voice+doc)
Monthly (1000 requests/day):
├─ Bedrock:    $150
├─ Groq:       $2
├─ Lambda:     $1
├─ S3:         $1
└─ Total:      ~$154/mo (or $0.15/request)
```

## Monitoring & Observability

### CloudWatch Metrics to Track

```
Lambda:
├─ Duration (ms)
├─ Error rate (%)
├─ Throttles
└─ Cold starts

Bedrock:
├─ Token usage (input/output)
├─ Model latency
└─ Error rate

S3:
├─ Object count (lifecycle tracking)
├─ Total size
└─ Request rate

Cost:
├─ Daily spend
├─ Cost per request
└─ Forecast
```

### Custom Logging

```python
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def log_request(event):
    logger.info(json.dumps({
        'event': 'chat_request',
        'user_id': event.get('user_id'),
        'query_intent': event.get('intent'),  # 'cv', 'letter', 'chat'
        'timestamp': datetime.now().isoformat(),
        'token_estimate': len(event['query']) * 1.3,  # Rough estimate
    }))
```

## Future Enhancements

### Phase 2: Vector DB Migration
- Migrate to Qdrant for persistent, distributed retrieval
- Unlock kNN search for semantic clustering
- Support larger KB (10K+ chunks)
- Estimated effort: 1 week

### Phase 3: Multi-Step Conversations
- Implement hierarchical summarization
- Track multi-turn context (current: last 12 messages)
- Reduce re-embedding on follow-ups
- Estimated effort: 2 weeks

### Phase 4: Advanced File Processing
- Extract text from user PDFs/images
- Inject extracted text into RAG context
- Support for file-based document editing
- Estimated effort: 2 weeks

---

## About This Project

BoroBhai is developed by **Najmun Nahar Khan** at **RoosCloset Labs** as part of the AWS Activate Founders program. The project is open-source and welcomes contributions.

**Project Repository**: https://github.com/najmun-ai/Bangla-Ai  
**Author GitHub**: https://github.com/najmun-ai

For questions about architecture or design decisions, please open an issue in the repository.

---

**Document Version**: 1.0  
**Last Updated**: July 2026  
**Maintainer**: Najmun Nahar Khan (RoosCloset Labs)  
**Company**: RoosCloset Labs, Dhaka, Bangladesh  
**Email**: najmun@rooscloset.store
