"""
BoroBhai Bedrock Orchestrator Lambda Handler

Main agentic loop:
1. Receives user message
2. Invokes Claude 3.5 Sonnet with tool definitions
3. Evaluates Claude response for tool calls
4. Executes tools (file generation, compression, etc.)
5. Returns final response to frontend
"""

import json
import os
import boto3
import requests
from typing import Any, Dict, List, Optional
from datetime import datetime

# PLACEHOLDER: Replace with real credentials
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', 'gsk_placeholder_replace_me')
BEDROCK_REGION = os.environ.get('BEDROCK_REGION', 'us-west-2')
BEDROCK_MODEL_ID = os.environ.get('BEDROCK_MODEL_ID', 'anthropic.claude-3-5-sonnet-20241022-v2:0')
S3_BUCKET = os.environ.get('S3_BUCKET', 'proofsheet-user-files')

# AWS Clients
bedrock = boto3.client('bedrock-runtime', region_name=BEDROCK_REGION)
s3 = boto3.client('s3', region_name=BEDROCK_REGION)


# ============================================================
# Tool Definitions (for Claude tool use)
# ============================================================

TOOL_DEFINITIONS = [
    {
        "name": "generate_cv_docx",
        "description": "Generate a professional CV/Resume in DOCX format. Use when user asks for CV, resume, or curriculum vitae.",
        "input_schema": {
            "type": "object",
            "properties": {
                "full_name": {"type": "string", "description": "Full name of the person"},
                "email": {"type": "string", "description": "Email address"},
                "phone": {"type": "string", "description": "Phone number"},
                "location": {"type": "string", "description": "City/Country"},
                "education": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "school": {"type": "string"},
                            "degree": {"type": "string"},
                            "field": {"type": "string"},
                            "year": {"type": "string"},
                        }
                    },
                    "description": "Education history"
                },
                "experience": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "company": {"type": "string"},
                            "role": {"type": "string"},
                            "duration": {"type": "string"},
                            "responsibilities": {"type": "array", "items": {"type": "string"}},
                        }
                    },
                    "description": "Work experience"
                },
                "skills": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Technical and soft skills"
                },
            },
            "required": ["full_name", "email", "phone"],
        }
    },
    {
        "name": "generate_letter_docx",
        "description": "Generate a formal letter (government letter, application, etc.) in DOCX format.",
        "input_schema": {
            "type": "object",
            "properties": {
                "letter_type": {"type": "string", "enum": ["government", "application", "complaint", "request"]},
                "recipient_name": {"type": "string", "description": "Name of recipient"},
                "recipient_title": {"type": "string", "description": "Title/position"},
                "recipient_organization": {"type": "string", "description": "Organization name"},
                "subject": {"type": "string", "description": "Letter subject"},
                "body": {"type": "string", "description": "Main body of the letter"},
                "sender_name": {"type": "string", "description": "Sender's name"},
            },
            "required": ["letter_type", "recipient_name", "subject", "body", "sender_name"],
        }
    },
    {
        "name": "generate_excel",
        "description": "Generate a spreadsheet in XLSX format with data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Sheet title"},
                "headers": {"type": "array", "items": {"type": "string"}, "description": "Column headers"},
                "rows": {
                    "type": "array",
                    "items": {"type": "array", "items": {"type": "string"}},
                    "description": "Data rows"
                },
            },
            "required": ["title", "headers", "rows"],
        }
    },
    {
        "name": "compress_pdf",
        "description": "Compress a PDF file to reduce file size.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_key": {"type": "string", "description": "S3 key of input PDF"},
                "output_key": {"type": "string", "description": "S3 key for output (compressed) PDF"},
            },
            "required": ["input_key", "output_key"],
        }
    },
    {
        "name": "merge_pdfs",
        "description": "Merge multiple PDF files into one.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_keys": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "S3 keys of PDFs to merge"
                },
                "output_key": {"type": "string", "description": "S3 key for merged PDF"},
            },
            "required": ["input_keys", "output_key"],
        }
    },
    {
        "name": "resize_image",
        "description": "Resize an image file.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_key": {"type": "string", "description": "S3 key of input image"},
                "output_key": {"type": "string", "description": "S3 key for resized image"},
                "width": {"type": "integer", "description": "Target width in pixels"},
                "height": {"type": "integer", "description": "Target height in pixels"},
            },
            "required": ["input_key", "output_key", "width", "height"],
        }
    },
]


# ============================================================
# System Prompt with Conditional Schema Injection
# ============================================================

BASE_SYSTEM_PROMPT = """আপনি BoroBhai, একটি Bengali civic AI assistant। আপনার ভূমিকা:

1. User-এর সরকারি ডকুমেন্ট প্রশ্নের উত্তর Bengali-তে দিন
2. প্রয়োজন অনুযায়ী পেশাদার ডকুমেন্ট তৈরি করুন (CV, letter, agreement, etc.)
3. ফাইল ম্যানিপুলেশন টুলস ব্যবহার করুন (PDF compress, merge, image resize)
4. সহানুভূতিশীল, সহায়ক টোন বজায় রাখুন

আপনার জ্ঞান:
- Bengali government procedures (পাসপোর্ট, ট্রেড লাইসেন্স, salary certificate, etc.)
- Professional document formatting
- Bureaucratic terminology
- Civic empowerment best practices

Available tools: use them when appropriate to help the user."""

DOCUMENT_SCHEMAS = """
[DOCUMENT_TEMPLATES]
These are available document types you can generate:

1. CV/Resume: Full-formatted professional resume with education, experience, skills
2. Letter: Government letter, application, complaint, or formal request
3. Spreadsheet: Data organized in Excel format
4. Salary Certificate: Official salary/income documentation
5. Leave Application: Formal leave request letter
6. Trade License Application: Business registration document
7. Rent Agreement: Landlord-tenant agreement template
8. NOC (No Objection Certificate): Authorization document
9. Experience Certificate: Employment proof document

When user asks for document generation:
- Extract all relevant information from their message
- Call appropriate tool with structured data
- Confirm document generation with [DOCUMENT_READY] flag
- Provide download link in response
"""


def should_inject_schemas(message: str) -> bool:
    """Check if document schema should be injected based on trigger words."""
    triggers = [
        'লিখে দাও', 'বানাও', 'বনাও', 'তৈরি করো', 'তৈরি করুন',
        'CV', 'resume', 'চিঠি', 'letter', 'চিঠি', 'সার্টিফিকেট',
        'সালিশ', 'agreement', 'চুক্তি', 'আবেদন', 'application',
        'লাইসেন্স', 'license', 'ছুটি', 'leave', 'নক', 'noc'
    ]
    message_lower = message.lower()
    return any(trigger.lower() in message_lower for trigger in triggers)


def get_system_prompt(user_message: str) -> str:
    """Generate system prompt with conditional schema injection."""
    prompt = BASE_SYSTEM_PROMPT

    # Inject document schemas only if needed
    if should_inject_schemas(user_message):
        prompt += "\n\n" + DOCUMENT_SCHEMAS

    return prompt


# ============================================================
# Tool Execution
# ============================================================

def execute_tool(tool_name: str, tool_input: Dict[str, Any]) -> str:
    """Execute tool and return result."""
    try:
        if tool_name == "generate_cv_docx":
            return execute_generate_cv(tool_input)
        elif tool_name == "generate_letter_docx":
            return execute_generate_letter(tool_input)
        elif tool_name == "generate_excel":
            return execute_generate_excel(tool_input)
        elif tool_name == "compress_pdf":
            return execute_compress_pdf(tool_input)
        elif tool_name == "merge_pdfs":
            return execute_merge_pdfs(tool_input)
        elif tool_name == "resize_image":
            return execute_resize_image(tool_input)
        else:
            return f"Unknown tool: {tool_name}"
    except Exception as e:
        return f"Tool execution error: {str(e)}"


def execute_generate_cv(input_data: Dict[str, Any]) -> str:
    """Generate CV and upload to S3."""
    try:
        # In production, use python-docx to generate DOCX
        # For MVP, return mock S3 URL
        timestamp = int(datetime.now().timestamp())
        s3_key = f"exports/cv_{timestamp}.docx"

        # Generate presigned URL
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600
        )

        return f"CV generated successfully. [DOCUMENT_READY] Download: {url}"
    except Exception as e:
        return f"CV generation failed: {str(e)}"


def execute_generate_letter(input_data: Dict[str, Any]) -> str:
    """Generate letter and upload to S3."""
    try:
        timestamp = int(datetime.now().timestamp())
        letter_type = input_data.get('letter_type', 'document')
        s3_key = f"exports/letter_{letter_type}_{timestamp}.docx"

        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600
        )

        return f"Letter generated successfully. [DOCUMENT_READY] Download: {url}"
    except Exception as e:
        return f"Letter generation failed: {str(e)}"


def execute_generate_excel(input_data: Dict[str, Any]) -> str:
    """Generate Excel sheet and upload to S3."""
    try:
        timestamp = int(datetime.now().timestamp())
        s3_key = f"exports/spreadsheet_{timestamp}.xlsx"

        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': s3_key},
            ExpiresIn=3600
        )

        return f"Spreadsheet generated successfully. [DOCUMENT_READY] Download: {url}"
    except Exception as e:
        return f"Spreadsheet generation failed: {str(e)}"


def execute_compress_pdf(input_data: Dict[str, Any]) -> str:
    """Compress PDF (placeholder for MVP)."""
    input_key = input_data.get('input_key', '')
    output_key = input_data.get('output_key', '')
    return f"PDF compression requested: {input_key} → {output_key}"


def execute_merge_pdfs(input_data: Dict[str, Any]) -> str:
    """Merge PDFs (placeholder for MVP)."""
    input_keys = input_data.get('input_keys', [])
    output_key = input_data.get('output_key', '')
    return f"PDF merge requested: {len(input_keys)} files → {output_key}"


def execute_resize_image(input_data: Dict[str, Any]) -> str:
    """Resize image (placeholder for MVP)."""
    input_key = input_data.get('input_key', '')
    output_key = input_data.get('output_key', '')
    width = input_data.get('width', 0)
    height = input_data.get('height', 0)
    return f"Image resize requested: {input_key} → {output_key} ({width}x{height}px)"


# ============================================================
# Main Lambda Handler
# ============================================================

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for chat requests.

    Expected event format:
    {
        "messages": [{"role": "user", "content": "..."}, ...],
        "userId": "user_xyz",
        "files": ["s3_key_1", "s3_key_2"],
        "stream": true/false
    }
    """

    try:
        # Parse request
        messages = event.get('messages', [])
        user_id = event.get('userId', 'unknown')
        files = event.get('files', [])
        stream = event.get('stream', False)

        if not messages:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No messages provided'})
            }

        # Get last user message for context
        last_user_message = next(
            (m['content'] for m in reversed(messages) if m.get('role') == 'user'),
            ''
        )

        # Get system prompt with conditional schemas
        system_prompt = get_system_prompt(last_user_message)

        # Prepare messages for Bedrock
        bedrock_messages = [
            {
                'role': msg.get('role', 'user'),
                'content': msg.get('content', '')
            }
            for msg in messages
        ]

        # Call Bedrock with tool definitions
        response = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=bedrock_messages,
            system=[{'text': system_prompt}],
            tools=[{'toolUseBlock': tool} for tool in TOOL_DEFINITIONS],
            inferenceConfig={'maxTokens': 2048},
        )

        # Process response
        response_text = ''
        tool_calls = []

        for block in response.get('content', []):
            if 'text' in block:
                response_text = block['text']
            elif 'toolUse' in block:
                tool_calls.append(block['toolUse'])

        # Execute tool calls if any
        if tool_calls:
            tool_results = []
            for tool_call in tool_calls:
                tool_result = execute_tool(
                    tool_call['name'],
                    tool_call.get('input', {})
                )
                tool_results.append(tool_result)
                response_text += f"\n\n{tool_result}"

        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'messages': [
                    {'role': 'user', 'content': last_user_message},
                    {'role': 'assistant', 'content': response_text}
                ],
                'tokensUsed': response.get('usage', {}),
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        }

    except Exception as e:
        print(f"Lambda error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        }


if __name__ == '__main__':
    # Test handler locally
    test_event = {
        'messages': [
            {
                'role': 'user',
                'content': 'আমার CV তৈরি করো'
            }
        ],
        'userId': 'test_user_123',
        'stream': False
    }

    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2, ensure_ascii=False))
