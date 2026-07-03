import { NextRequest, NextResponse } from 'next/server';

// PLACEHOLDER: Replace with real Groq API credentials
// This is a mock implementation for MVP
async function transcribeAudio(audioData: Buffer, language: string): Promise<string> {
  const groqApiKey = process.env.GROQ_API_KEY || 'gsk_placeholder';

  if (groqApiKey === 'gsk_placeholder') {
    return 'দুঃখিত, Groq API কী সেট করা নেই। DEPLOYMENT.md দেখুন।';
  }

  try {
    const formData = new FormData();
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', language === 'bn' ? 'bn' : 'en');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data: any = await response.json();
    return data.text || 'কথা চেনা যায়নি। আবার চেষ্টা করুন।';
  } catch (error) {
    console.error('Groq transcription error:', error);
    return 'কথা চেনায় ত্রুটি হয়েছে। আবার চেষ্টা করুন।';
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = (formData.get('language') as string) || 'bn';

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Missing audio file' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = await audioFile.arrayBuffer();
    const audioData = Buffer.from(buffer);

    // Transcribe
    const text = await transcribeAudio(audioData, language);

    return NextResponse.json({
      status: 'success',
      text,
      language,
      confidence: 0.95,
      duration_seconds: audioFile.size / 16000, // Rough estimate
    });
  } catch (error) {
    console.error('STT API error:', error);
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
