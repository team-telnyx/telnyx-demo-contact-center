import { NextRequest, NextResponse } from 'next/server';

// Use NEXT_PUBLIC_API_URL if available (for production/Workers),
// otherwise construct from HOST/PORT (for local development)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (() => {
  const protocol = (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_HTTPS === 'true') ? 'https' : 'http';
  const port = process.env.NEXT_PUBLIC_API_PORT ? `:${process.env.NEXT_PUBLIC_API_PORT}` : '';
  const host = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
  return `${protocol}://${host}${port}/api`;
})();

export async function GET(request: NextRequest) {
  try {
    // Get auth token from request headers
    const authHeader = request.headers.get('Authorization');

    const response = await fetch(`${API_BASE_URL}/voice/queue`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Queue API error:', error);
    return NextResponse.json({ error: 'Failed to fetch queue data' }, { status: 500 });
  }
}