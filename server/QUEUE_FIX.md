# Queue Configuration Fix

## Problem
Your backend is trying to access a Telnyx queue named `General_Queue` that doesn't exist, causing 404 errors:
```
Error fetching queue: 404 - Queue not found
```

## Solution Options

### Option 1: Create the Queue in Telnyx (Recommended)

1. **Log into Telnyx Mission Control**: https://portal.telnyx.com
2. **Navigate to**: Voice → Call Control → Call Queues
3. **Create a new queue** with the name: `General_Queue`
4. **Configure queue settings**:
   - Max wait time
   - Max queue size
   - Music on hold
   - Timeout behavior

### Option 2: Use Existing Queue Name

If you already have a queue in Telnyx with a different name:

1. **Add to `.env` file**:
```bash
TELNYX_QUEUE_NAME=your_actual_queue_name
```

2. **Update backend code** to use environment variable:
```javascript
// In server/routes/voiceRoutes.js
const QUEUE_NAME = process.env.TELNYX_QUEUE_NAME || 'General_Queue';

// Replace all hardcoded 'General_Queue' with QUEUE_NAME
```

### Option 3: Disable Queue Features (Temporary)

If you don't need call queueing right now, you can modify the SSE endpoint to handle the 404 gracefully:

**Update: `/client/src/app/api/events/calls/route.ts`**

```typescript
const pollInterval = setInterval(async () => {
  try {
    const response = await fetch(
      `http://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}/api/calls/queue`
    );

    // Handle 404 gracefully - queue might not exist yet
    if (response.status === 404) {
      console.log('Queue not found - sending empty queue');
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({
          type: 'QUEUE_UPDATE',
          data: { incomingCalls: [] }
        })}\n\n`)
      );
      return;
    }

    if (response.ok) {
      const data = await response.json();
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'QUEUE_UPDATE', data })}\n\n`)
      );
    }
  } catch (error) {
    console.error('Error polling call queue:', error);
    // Send empty queue on error
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({
        type: 'QUEUE_UPDATE',
        data: { incomingCalls: [] }
      })}\n\n`)
    );
  }
}, 2000);
```

## Quick Fix for Development

Add this to your server `.env` file:
```bash
# Use a queue name that exists in your Telnyx account
# Or leave empty to skip queue functionality for now
TELNYX_QUEUE_NAME=
```

Then update `server/routes/voiceRoutes.js`:
```javascript
const QUEUE_NAME = process.env.TELNYX_QUEUE_NAME;

// In /queue endpoint
router.get('/queue', async (req, res) => {
  if (!QUEUE_NAME) {
    // Return empty queue if no queue configured
    return res.json({ incomingCalls: [] });
  }

  try {
    const response = await axios.get(
      `https://api.telnyx.com/v2/queues/${QUEUE_NAME}/calls`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API}`
        }
      }
    );
    res.send(response.data);
  } catch (error) {
    console.error('Queue error:', error.response?.status);
    if (error.response?.status === 404) {
      return res.json({ incomingCalls: [] });
    }
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});
```

## Recommended Production Setup

1. **Create the Telnyx Queue** (Option 1 above)
2. **Add to `.env`**:
```bash
TELNYX_QUEUE_NAME=General_Queue
TELNYX_QUEUE_MAX_WAIT=300
TELNYX_QUEUE_MAX_SIZE=50
```
3. **Configure proper error handling** in backend
4. **Set up monitoring** for queue metrics

## Testing

After applying the fix:

1. **Check backend logs**: Should see "Queue configured: [name]" or "Queue disabled"
2. **Check Next.js SSE**: Should receive `QUEUE_UPDATE` events without errors
3. **Test call flow**: Make a test call and verify queueing behavior

## Current Status

Your system is currently trying to use `General_Queue` but it doesn't exist in Telnyx, causing:
- Backend 404 errors every 2 seconds
- Frontend shows empty queue (which is correct fallback behavior)
- No impact on WebRTC calls (those work independently)

The app will continue to work for direct WebRTC calls, but queue-based inbound call handling won't work until the queue is configured.
