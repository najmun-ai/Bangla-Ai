'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatPane } from '@/components/ChatPane';
import { DocumentPane } from '@/components/DocumentPane';
import { InputBar } from '@/components/InputBar';
import { useStreamChat } from '@/hooks/useStreamChat';
import { useFileUpload } from '@/hooks/useFileUpload';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  flag?: 'document' | 'voice' | 'file';
}

interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'image';
  url: string;
  filename: string;
  size?: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'আপনাকে স্বাগতম বোরোভাই-এ। আমি আপনার সরকারি কাগজপত্র এবং নাগরিক প্রক্রিয়া সম্পর্কে সাহায্য করতে পারি। আপনার যা প্রয়োজন তা বলুন।',
      timestamp: new Date(),
    },
  ]);

  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 9)}`);
  const [isLoading, setIsLoading] = useState(false);
  const chatPaneRef = useRef<HTMLDivElement>(null);

  const { streamChat } = useStreamChat();
  const { uploadFile } = useFileUpload(userId);

  // Auto-scroll to latest message
  useEffect(() => {
    if (chatPaneRef.current) {
      chatPaneRef.current.scrollTop = chatPaneRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (
    content: string,
    files?: File[],
    isVoiceInput?: boolean
  ) => {
    if (!content.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
      flag: isVoiceInput ? 'voice' : files ? 'file' : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Handle file uploads
      const uploadedFilePaths: string[] = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const path = await uploadFile(file);
          uploadedFilePaths.push(path);
        }
      }

      // Stream chat response
      let assistantContent = '';
      const assistantMessageId = `msg_${Date.now()}_assistant`;

      const response = await streamChat({
        messages: [
          ...messages,
          userMessage,
        ].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        userId,
        files: uploadedFilePaths,
      });

      // Add assistant message as it streams
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Stream chunks
      for await (const chunk of response) {
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: assistantContent }
              : m
          )
        );
      }

      // Check for document generation
      if (assistantContent.includes('[DOCUMENT_READY]')) {
        // Extract document URL if present
        const urlMatch = assistantContent.match(/https?:\/\/[^\s)]+/);
        if (urlMatch) {
          setActiveDocument({
            id: `doc_${Date.now()}`,
            title: 'Generated Document',
            type: 'docx',
            url: urlMatch[0],
            filename: 'document.docx',
          });
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'দুঃখিত, কিছু ত্রুটি হয়েছে। দয়া করে আবার চেষ্টা করুন।',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex h-screen bg-white dark:bg-gray-900">
      {/* Chat Pane */}
      <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800">
        <div
          ref={chatPaneRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          <ChatPane messages={messages} />
          {isLoading && (
            <div className="flex items-center gap-2 justify-center py-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200" />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
          <InputBar
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            userId={userId}
          />
        </div>
      </div>

      {/* Document Pane */}
      <div className="hidden lg:flex w-96 flex-col border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        <DocumentPane document={activeDocument} />
      </div>
    </main>
  );
}
