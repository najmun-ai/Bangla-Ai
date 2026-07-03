import { NextRequest, NextResponse } from 'next/server';

interface UploadRequest {
  user_id: string;
  filename: string;
  content_type: string;
  file_size_bytes: number;
}

// PLACEHOLDER: Replace with real AWS S3 client
// This is a mock implementation for MVP
async function generatePresignedUrl(request: UploadRequest): Promise<string> {
  // In production, this would call AWS S3 API to generate a real presigned URL
  // For MVP, return a mock presigned URL
  const bucket = process.env.AWS_S3_BUCKET || 'proofsheet-user-files';
  const region = process.env.AWS_REGION || 'us-west-2';

  const key = `users/${request.user_id}/uploads/${Date.now()}_${request.filename}`;
  const mockPresignedUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}?AWSAccessKeyId=PLACEHOLDER&Signature=PLACEHOLDER&Expires=${Date.now() + 900000}`;

  return mockPresignedUrl;
}

export async function POST(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();

    // Validate request
    if (!body.user_id || !body.filename || !body.content_type) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, filename, content_type' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB for MVP)
    if (body.file_size_bytes > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large (max 10MB)' },
        { status: 413 }
      );
    }

    // Generate presigned URL
    const uploadUrl = await generatePresignedUrl(body);

    return NextResponse.json({
      status: 'success',
      upload_url: uploadUrl,
      expires_at: new Date(Date.now() + 900000).toISOString(),
    });
  } catch (error) {
    console.error('Upload API error:', error);
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
