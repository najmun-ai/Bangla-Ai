import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: Message[];
  userId: string;
  files?: string[];
  stream?: boolean;
}

// PLACEHOLDER: Replace with real Bedrock client configuration
// This is a mock implementation for MVP
async function invokeBedrockChat(request: ChatRequest) {
  const apiEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT;

  if (!apiEndpoint) {
    return {
      content: 'দুঃখিত, API কনফিগারেশন সমস্যা। পরিবেশ ভেরিয়েবল চেক করুন।',
      documents: [],
    };
  }

  // In production, this would call AWS Bedrock via Lambda orchestrator
  // For MVP with mock, return a placeholder response
  const lastMessage = request.messages[request.messages.length - 1];

  return {
    content: `আপনি বলেছেন: "${lastMessage.content}"\n\nসিস্টেম এখনও Bedrock Lambda এর সাথে সংযুক্ত নয়। DEPLOYMENT.md ফলো করুন।`,
    documents: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    if (!body.messages || !body.userId) {
      return NextResponse.json(
        { error: 'Missing required fields: messages, userId' },
        { status: 400 }
      );
    }

    if (body.stream === false) {
      // Non-streaming response
      const response = await invokeBedrockChat(body);
      return NextResponse.json({
        status: 'success',
        messages: [
          ...body.messages,
          {
            role: 'assistant',
            content: response.content,
          },
        ],
        documents: response.documents,
      });
    } else {
      // Streaming response (SSE)
      const encoder = new TextEncoder();
      let content = '';

      const response = await invokeBedrockChat(body);
      content = response.content;

      // Create readable stream for SSE
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send content chunks
            for (let i = 0; i < content.length; i += 10) {
              const chunk = content.slice(i, i + 10);
              const event = `data: ${JSON.stringify({ type: 'message', content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(event));

              // Simulate streaming delay
              await new Promise((resolve) => setTimeout(resolve, 50));
            }

            // Send completion
            const done = `data: ${JSON.stringify({ type: 'done', status: 'success' })}\n\n`;
            controller.enqueue(encoder.encode(done));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
