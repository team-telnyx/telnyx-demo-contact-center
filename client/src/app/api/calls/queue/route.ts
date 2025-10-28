import { NextRequest, NextResponse } from 'next/server';

// Proxy API calls to the backend server
const API_BASE_URL = `${process.env.NEXT_PUBLIC_API_HOST ?
  `http://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}` :
  'http://localhost:8080'}/api`;

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