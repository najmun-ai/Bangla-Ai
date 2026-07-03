'use client';

import React from 'react';
import { MessageBubble } from './MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  flag?: 'document' | 'voice' | 'file';
}

export function ChatPane({ messages }: { messages: Message[] }) {
  return (
    <div className="flex flex-col gap-4 py-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
