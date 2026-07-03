'use client';

import React from 'react';
import { DocumentCard } from './DocumentCard';

interface Document {
  id: string;
  title: string;
  type: 'pdf' | 'docx' | 'xlsx' | 'image';
  url: string;
  filename: string;
  size?: number;
}

export function DocumentPane({ document }: { document: Document | null }) {
  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
        📄 Document Preview
      </h2>

      {document ? (
        <div className="flex-1 overflow-auto">
          <DocumentCard document={document} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <p className="text-center">
            Generated documents will appear here
          </p>
        </div>
      )}
    </div>
  );
}
