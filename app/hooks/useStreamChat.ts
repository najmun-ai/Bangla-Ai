'use client';

import { useCallback } from 'react';

interface ChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: string;
  files?: string[];
}

export function useStreamChat() {
  const streamChat = useCallback(
    async function* (request: ChatRequest): AsyncGenerator<string> {
      const apiEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3001';

      try {
        const response = await fetch(`${apiEndpoint}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...request,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        // Handle streaming response
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.content) {
                      yield data.content;
                    }
                  } catch {
                    // Skip parse errors
                  }
                }
              }
            }

            // Process remaining buffer
            if (buffer) {
              if (buffer.startsWith('data: ')) {
                try {
                  const data = JSON.parse(buffer.slice(6));
                  if (data.content) {
                    yield data.content;
                  }
                } catch {
                  // Skip parse errors
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
      } catch (error) {
        console.error('Stream chat error:', error);
        yield 'দুঃখিত, কিছু ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।';
      }
    },
    []
  );

  return { streamChat };
}
