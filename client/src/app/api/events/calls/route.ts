import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  // Connect directly to localhost backend to avoid ngrok loop
  const backendSSEUrl = `http://localhost:3000/api/sse/call-events`;

  // Create a readable stream that proxies the backend SSE
  const stream = new ReadableStream({
    async start(controller) {
      let backendResponse: Response | null = null;
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      let isClosed = false;

      const safeClose = () => {
        if (!isClosed) {
          try {
            controller.close();
            isClosed = true;
          } catch (error) {
            // Already closed, ignore
          }
        }
      };

      const safeEnqueue = (chunk: Uint8Array) => {
        if (!isClosed) {
          try {
            controller.enqueue(chunk);
          } catch (error) {
            isClosed = true;
          }
        }
      };

      try {
        // For development with self-signed certificates, disable certificate validation
        // IMPORTANT: Only use this in development, never in production
        if (process.env.NODE_ENV === 'development' && backendSSEUrl.startsWith('https')) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        // Connect to backend SSE endpoint
        backendResponse = await fetch(backendSSEUrl, {
          headers: {
            'Accept': 'text/event-stream',
          },
        });

        if (!backendResponse.ok) {
          throw new Error(`Backend SSE connection failed: ${backendResponse.status}`);
        }

        // Get the reader from the backend response
        reader = backendResponse.body?.getReader();

        if (!reader) {
          throw new Error('Backend response has no body');
        }

        // Stream data from backend to client
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            safeClose();
            break;
          }

          // Forward the chunk to the client
          safeEnqueue(value);
        }
      } catch (error) {
        console.error('📡 Next.js SSE: Error streaming from backend:', error);

        // Send error message to client if controller is not closed
        safeEnqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'ERROR',
            message: 'Backend connection failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`)
        );

        safeClose();
      }

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        reader?.cancel();
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
