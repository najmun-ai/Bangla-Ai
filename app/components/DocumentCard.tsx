'use client';

import React from 'react';

interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'image';
  url: string;
  filename: string;
  size?: number;
}

export function DocumentCard({ document }: { document: Document }) {
  const typeEmojis = {
    pdf: '📕',
    docx: '📄',
    xlsx: '📊',
    image: '🖼️',
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="document-card">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{typeEmojis[document.type]}</span>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-gray-100">
            {document.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {document.filename}
          </p>
        </div>
      </div>

      {document.size && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Size: {formatSize(document.size)}
        </p>
      )}

      {/* Document preview (if image) */}
      {document.type === 'image' && (
        <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
          <img
            src={document.url}
            alt={document.title}
            className="w-full h-auto max-h-64 object-contain"
          />
        </div>
      )}

      {/* Document preview (if PDF) */}
      {document.type === 'pdf' && (
        <div className="mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 h-64 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Preview not available. Download to view.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {document.type === 'image' && (
          <a
            href={document.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 btn btn-secondary text-center"
          >
            👁️ View
          </a>
        )}

        <a
          href={document.url}
          download={document.filename}
          className="flex-1 btn btn-primary text-center"
        >
          ⬇️ Download
        </a>
      </div>
    </div>
  );
}
