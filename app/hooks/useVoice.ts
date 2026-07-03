'use client';

import { useState, useRef, useCallback } from 'react';

export function useVoice(userId: string) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('দুঃখিত, মাইক্রোফোন অ্যাক্সেস করতে পারিনি। ব্রাউজার পারমিশন চেক করুন।');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;
      if (!mediaRecorder) {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

        // Call Groq STT endpoint
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('language', 'bn');

        try {
          const apiEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3001';
          const response = await fetch(`${apiEndpoint}/api/stt`, {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            resolve(data.text || null);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('STT error:', error);
          resolve(null);
        }

        setIsRecording(false);
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.stop();
    });
  }, []);

  return { isRecording, startRecording, stopRecording };
}
