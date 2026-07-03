'use client';

import React, { useState, useRef } from 'react';
import { useVoice } from '@/hooks/useVoice';

interface InputBarProps {
  onSendMessage: (content: string, files?: File[], isVoiceInput?: boolean) => void;
  disabled?: boolean;
  userId: string;
}

export function InputBar({ onSendMessage, disabled = false, userId }: InputBarProps) {
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isRecording, startRecording, stopRecording } = useVoice(userId);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input, selectedFiles.length > 0 ? selectedFiles : undefined, false);
      setInput('');
      setSelectedFiles([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleVoiceClick = async () => {
    if (isRecording) {
      const transcript = await stopRecording();
      if (transcript) {
        onSendMessage(transcript, undefined, true);
      }
    } else {
      startRecording();
    }
  };

  return (
    <div className="space-y-2">
      {/* File preview */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedFiles.map((file) => (
            <div
              key={file.name}
              className="bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-3 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              <span>📎</span>
              <span>{file.name}</span>
              <button
                onClick={() =>
                  setSelectedFiles((prev) =>
                    prev.filter((f) => f.name !== file.name)
                  )
                }
                className="ml-auto text-lg hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          title="Attach file"
        >
          📎
        </button>

        {/* Voice button */}
        <button
          onClick={handleVoiceClick}
          disabled={disabled}
          className={`p-2 rounded-lg ${
            isRecording
              ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          } disabled:opacity-50`}
          title="Voice input"
        >
          🎤
        </button>

        {/* Text input */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="আপনার প্রশ্ন বা অনুরোধ লিখুন... (Write your question)"
          disabled={disabled}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
          rows={3}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:bg-gray-400"
          title="Send message"
        >
          ⬆️
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
      />
    </div>
  );
}
