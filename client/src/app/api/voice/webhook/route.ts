import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This webhook receives Telnyx voice events
// It should forward them to your Express backend for processing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('Voice webhook received:', {
      event_type: body.data?.event_type,
      call_control_id: body.data?.payload?.call_control_id,
      call_leg_id: body.data?.payload?.call_leg_id,
    });

    // Forward to Express backend for actual processing
    const protocol = process.env.NEXT_PUBLIC_HTTPS === 'true' ? 'https' : 'http';
    const backendUrl = `${protocol}://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}/api/voice/webhook`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Backend webhook failed:', response.status, await response.text());
      return NextResponse.json(
        { error: 'Backend processing failed' },
        { status: response.status }
      );
    }

    // Backend returns "OK" as plain text, not JSON
    const result = await response.text();
    return new NextResponse(result, { status: 200 });

  } catch (error) {
    console.error('Voice webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Voice webhook endpoint is active'
  });
}
