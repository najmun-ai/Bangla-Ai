'use client';

import { useCallback } from 'react';

export function useFileUpload(userId: string) {
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const apiEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3001';

      try {
        // Step 1: Get presigned URL
        const presignResponse = await fetch(`${apiEndpoint}/api/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            filename: file.name,
            content_type: file.type,
            file_size_bytes: file.size,
          }),
        });

        if (!presignResponse.ok) {
          throw new Error('Failed to get presigned URL');
        }

        const { upload_url } = await presignResponse.json();

        // Step 2: Upload file to S3
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(upload_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('File upload failed');
        }

        // Return S3 key for Lambda processing
        return `users/${userId}/uploads/${file.name}`;
      } catch (error) {
        console.error('File upload error:', error);
        throw error;
      }
    },
    [userId]
  );

  return { uploadFile };
}
