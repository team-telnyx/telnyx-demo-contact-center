import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const username = request.nextUrl.searchParams.get('username');

  if (!username) {
    return new Response('Username required', { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Poll for assigned conversations
      const pollAssignedInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `http://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}/api/conversations/assignedTo/${username}`
          );

          if (response.ok) {
            const data = await response.json();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'ASSIGNED_CONVERSATIONS_UPDATE', data })}\n\n`)
            );
          }
        } catch (error) {
          console.error('Error polling assigned conversations:', error);
        }
      }, 3000);

      // Poll for unassigned conversations (message queue)
      const pollUnassignedInterval = setInterval(async () => {
        try {
          const response = await fetch(
            `http://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}/api/conversations/unassignedConversations`
          );

          if (response.ok) {
            const data = await response.json();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'UNASSIGNED_CONVERSATIONS_UPDATE', data })}\n\n`)
            );
          }
        } catch (error) {
          console.error('Error polling unassigned conversations:', error);
        }
      }, 3000);

      // Cleanup
      request.signal.addEventListener('abort', () => {
        clearInterval(pollAssignedInterval);
        clearInterval(pollUnassignedInterval);
        controller.close();
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
