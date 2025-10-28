import { NextRequest, NextResponse } from 'next/server';

// This API route will replace websocket events for call updates
// Instead of real-time websockets, we'll use Server-Sent Events (SSE) or polling

let clients: Set<ReadableStreamDefaultController> = new Set();

export async function GET(request: NextRequest) {
  // Create a Server-Sent Events stream
  const stream = new ReadableStream({
    start(controller) {
      // Add this client to the set
      clients.add(controller);

      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\\n\\n`);

      // Clean up when connection closes
      request.signal.addEventListener('abort', () => {
        clients.delete(controller);
        try {
          controller.close();
        } catch (error) {
          // Connection already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const eventData = await request.json();

    // Broadcast event to all connected clients
    const message = `data: ${JSON.stringify(eventData)}\\n\\n`;

    clients.forEach((controller) => {
      try {
        controller.enqueue(message);
      } catch (error) {
        // Remove disconnected clients
        clients.delete(controller);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to broadcast event' }, { status: 500 });
  }
}