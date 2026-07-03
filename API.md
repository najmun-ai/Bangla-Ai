# BoroBhai API Reference

**Project**: BoroBhai - Bengali Civic AI Assistant  
**Author**: Najmun Nahar Khan (RoosCloset Labs)  
**Repository**: https://github.com/najmun-ai/Bangla-Ai

---

## Overview

All endpoints are HTTP/REST. Authentication via request headers (API key optional for MVP).

**Base URL**: `https://api.borobhai.example.com` (or Vercel URL during development)

## Endpoints

### 1. POST /api/chat

Stream conversational responses and document generation.

**Request**

```json
POST /api/chat HTTP/1.1
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "আমার CV তৈরি করো"
    }
  ],
  "user_id": "user_12345",
  "context": {
    "language": "Bengali",
    "location": "Dhaka"
  },
  "stream": true
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | Array | Yes | Chat history. Each message: `{role: "user\|assistant", content: "..."}` |
| `user_id` | String | Yes | Unique identifier for session isolation (S3 prefix) |
| `context` | Object | No | Additional context (language, location, preferences) |
| `stream` | Boolean | No | Enable Server-Sent Events (default: true) |

**Response (Streaming)**

```
event: chunk
data: {"type": "message", "content": "CV তৈরি করছি..."}

event: chunk
data: {"type": "document", "title": "CV", "url": "https://s3-presigned-url-here"}

event: done
data: {"status": "success", "messages_processed": 1}
```

**Response (Non-Streaming)**

```json
{
  "status": "success",
  "messages": [
    {
      "role": "assistant",
      "content": "CV তৈরি হয়েছে। [DOCUMENT_READY] 📄 Download"
    }
  ],
  "documents": [
    {
      "type": "cv",
      "url": "https://proofsheet-user-files.s3.amazonaws.com/users/user_12345/exports/cv_1688234567.docx?AWSAccessKeyId=...",
      "filename": "cv.docx",
      "expires_at": "2026-07-03T10:45:00Z"
    }
  ],
  "tokens_used": {
    "input": 2150,
    "output": 450,
    "total": 2600
  }
}
```

**Error Responses**

```json
{
  "status": "error",
  "error": {
    "code": "BEDROCK_UNAVAILABLE",
    "message": "Claude model currently unavailable. Please try again in 1 minute.",
    "retry_after": 60
  }
}
```

**Status Codes**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (invalid JSON, missing fields) |
| 401 | Unauthorized (invalid API key) |
| 429 | Rate limited (too many requests) |
| 500 | Server error (Lambda timeout, Bedrock unavailable) |

### 2. POST /api/upload

Get S3 presigned URL for client-side file upload.

**Request**

```json
POST /api/upload HTTP/1.1
Content-Type: application/json

{
  "user_id": "user_12345",
  "filename": "resume.pdf",
  "content_type": "application/pdf",
  "file_size_bytes": 524288
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | String | Yes | S3 prefix for isolation |
| `filename` | String | Yes | Original filename (no path traversal allowed) |
| `content_type` | String | Yes | MIME type (application/pdf, image/png, etc.) |
| `file_size_bytes` | Number | Yes | File size for quota validation |

**Response**

```json
{
  "status": "success",
  "upload_url": "https://proofsheet-user-files.s3.amazonaws.com/users/user_12345/uploads/resume_1688234567.pdf?...",
  "fields": {
    "key": "users/user_12345/uploads/resume_1688234567.pdf",
    "acl": "private",
    "X-Amz-Signature": "..."
  },
  "expires_at": "2026-07-03T10:15:00Z"
}
```

**Client-Side Upload (Browser)**

```javascript
// After getting presigned URL from /api/upload:
const formData = new FormData();
formData.append('key', uploadResponse.fields.key);
formData.append('Content-Type', 'application/pdf');
formData.append('file', fileInputElement.files[0]);

const uploadResponse = await fetch(uploadResponse.upload_url, {
  method: 'POST',
  body: formData,
});

if (uploadResponse.ok) {
  console.log('File uploaded to S3');
  // Now send file path to /api/chat for processing
}
```

### 3. POST /api/presign-upload

Generate S3 presigned URL for direct download.

**Request**

```json
POST /api/presign-upload HTTP/1.1
Content-Type: application/json

{
  "key": "users/user_12345/exports/cv.docx",
  "action": "get_object",
  "expires_in_seconds": 900
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | String | Yes | S3 object key (must start with `users/{user_id}/`) |
| `action` | String | No | `get_object` (download) or `put_object` (upload). Default: `get_object` |
| `expires_in_seconds` | Number | No | URL expiration time (default: 900, max: 3600) |

**Response**

```json
{
  "status": "success",
  "download_url": "https://proofsheet-user-files.s3.amazonaws.com/users/user_12345/exports/cv.docx?AWSAccessKeyId=AKIA...&Signature=...",
  "filename": "cv.docx",
  "content_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "expires_at": "2026-07-03T10:45:00Z",
  "file_size_bytes": 45678
}
```

### 4. POST /api/stt

Transcribe Bengali audio to text (via Groq Whisper or Web Speech API fallback).

**Request (Multipart)**

```
POST /api/stt HTTP/1.1
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="audio"; filename="audio.wav"
Content-Type: audio/wav

[binary audio data]
------FormBoundary
Content-Disposition: form-data; name="language"

bn
------FormBoundary--
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | File | Yes | WAV, MP3, or M4A audio file (max 10MB) |
| `language` | String | No | Language code (default: `bn` for Bengali) |

**Response**

```json
{
  "status": "success",
  "text": "আমার CV তৈরি করো",
  "language": "bn",
  "confidence": 0.98,
  "duration_seconds": 2.5
}
```

**Error Response**

```json
{
  "status": "error",
  "error": {
    "code": "SPEECH_NOT_RECOGNIZED",
    "message": "Could not recognize speech. Please try again."
  }
}
```

## Authentication

### Development (No Auth)

During development, all endpoints are unauthenticated. Add to `.env.local`:

```
NEXT_PUBLIC_API_KEY=optional_dev_key
```

### Production (API Key)

Add `Authorization` header to all requests:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.borobhai.example.com/api/chat
```

Verify in Next.js API route:

```typescript
// app/api/chat/route.ts
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.split(' ')[1];
  
  if (!token || token !== process.env.API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // ... rest of handler
}
```

## Rate Limiting

### Limits

| Endpoint | Limit | Window | Notes |
|----------|-------|--------|-------|
| /api/chat | 30 | 1 minute | Soft limit (warning at 25) |
| /api/upload | 50 | 1 minute | Per file |
| /api/stt | 60 | 1 minute | Per audio stream |
| /api/presign-upload | 100 | 1 minute | Lightweight |

### Rate Limit Headers

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 27
X-RateLimit-Reset: 1688234400
```

When rate limit exceeded:

```json
{
  "status": "error",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 15 seconds.",
    "retry_after": 15
  }
}
```

## Document Types & Tools

### Supported Generations

When Claude detects document keywords, it can invoke these tools:

| Tool | Triggered By | Output |
|------|--------------|--------|
| `generate_cv_docx` | CV, resume, CV তৈরি করো | DOCX file |
| `generate_letter_docx` | Letter, আবেদন, চিঠি | DOCX file |
| `generate_excel` | Spreadsheet, এক্সেল, তালিকা | XLSX file |
| `compress_pdf` | Compress, কমাও, ফাইল | Compressed PDF |
| `merge_pdfs` | Merge, একসাথে, মিশান | Merged PDF |
| `resize_image` | Resize, ছবি, ইমেজ | PNG image |

Example: User says "আমার পাসপোর্ট আবেদনের চিঠি লিখে দাও" (Write my passport application letter)

```
1. Claude detects: "চিঠি" (letter) → invoke generate_letter_docx
2. Tool fills fields: recipient, body, signature
3. Lambda renders Jinja2 template → DOCX
4. S3 upload → presigned URL returned
5. Frontend shows DocumentCard with download
```

## Streaming vs Non-Streaming

### Streaming (Recommended for UX)

Use Server-Sent Events (SSE) for progressive response display:

```javascript
// Frontend
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages, stream: true }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const event = JSON.parse(text.split('data: ')[1]);
  
  if (event.type === 'message') {
    // Append chunk to chat
    updateChatUI(event.content);
  } else if (event.type === 'document') {
    // Render DocumentCard
    showDocumentPreview(event);
  }
}
```

### Non-Streaming

Waits for full response before returning:

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ messages, stream: false }),
});

const data = await response.json();
updateChatUI(data.messages);
renderDocuments(data.documents);
```

## Error Codes

| Code | HTTP | Meaning | Action |
|------|------|---------|--------|
| `INVALID_REQUEST` | 400 | Malformed JSON or missing fields | Check request body |
| `MISSING_API_KEY` | 401 | No Authorization header | Add `Authorization: Bearer KEY` |
| `BEDROCK_UNAVAILABLE` | 503 | Bedrock API down | Retry after 60s |
| `BEDROCK_TIMEOUT` | 504 | Response took >60s | Reduce query complexity |
| `S3_ERROR` | 500 | S3 upload/download failed | Retry with exponential backoff |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry |
| `SPEECH_NOT_RECOGNIZED` | 400 | Audio not valid Bengali | Repeat or use text input |
| `FILE_TOO_LARGE` | 413 | File exceeds 10MB | Split or compress file |
| `INVALID_FILE_FORMAT` | 400 | Unsupported MIME type | Use PDF, PNG, DOCX, XLSX |

## Example Workflows

### Workflow 1: Generate CV

```
1. User: "আমার CV তৈরি করো" (Create my CV)
   POST /api/chat
   {
     "messages": [{"role": "user", "content": "আমার CV তৈরি করো"}],
     "user_id": "user_12345"
   }

2. Backend: Claude analyzes, detects CV intent
   → Calls generate_cv_docx tool

3. Response:
   {
     "status": "success",
     "messages": [...],
     "documents": [
       {
         "type": "cv",
         "url": "https://...",
         "filename": "cv.docx"
       }
     ]
   }

4. Frontend: Renders DocumentCard
   User clicks "Download" → S3 presigned URL
```

### Workflow 2: Upload & Process File

```
1. User selects file: resume.pdf (200KB)
   POST /api/upload
   {
     "user_id": "user_12345",
     "filename": "resume.pdf",
     "content_type": "application/pdf",
     "file_size_bytes": 200000
   }

2. Response:
   {
     "status": "success",
     "upload_url": "https://...",
     "fields": {...}
   }

3. Frontend: Upload file directly to S3
   (Browser sends multipart form to presigned URL)

4. User: "এই CV থেকে একটি চিঠি লিখে দাও" (Write a letter from this CV)
   POST /api/chat
   {
     "messages": [...],
     "files": ["users/user_12345/uploads/resume.pdf"]
   }

5. Backend: Extracts text from PDF
   → Injects into RAG context
   → Generates letter based on resume

6. Response: DocumentCard with letter DOCX
```

### Workflow 3: Voice Input

```
1. Browser: User clicks microphone
   MediaRecorder captures Bengali speech

2. Browser: Sends audio to /api/stt
   POST /api/stt (multipart)
   [audio binary data]

3. Response:
   {
     "status": "success",
     "text": "আমার CV তৈরি করো",
     "confidence": 0.98
   }

4. Frontend: Sends text to /api/chat
   (Same as Workflow 1)

5. User sees response + document download
```

## CORS & Headers

### Allowed Origins

```
https://borobhai.example.com
https://borobhai-*.vercel.app
http://localhost:3000 (dev only)
```

### Required Headers

```
Content-Type: application/json
Authorization: Bearer {API_KEY} (production only)
```

### Response Headers

```
Access-Control-Allow-Origin: https://borobhai.example.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

## Webhook Integration (Optional)

For external services to receive completion notifications:

```bash
curl -X POST https://your-webhook-url \
  -H "Content-Type: application/json" \
  -d '{
    "event": "document_generated",
    "user_id": "user_12345",
    "document_type": "cv",
    "download_url": "https://...",
    "timestamp": "2026-07-03T10:00:00Z"
  }'
```

Configure webhooks in `.env.local`:

```
WEBHOOK_ENDPOINT=https://your-service.com/webhooks/borobhai
WEBHOOK_SECRET=your_shared_secret
```

---

**API Version**: 1.0  
**Last Updated**: July 2026  
**Swagger/OpenAPI**: Available at `/api/docs`
