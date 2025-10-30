# Queue Callback Feature

## Overview

The Queue Callback feature allows callers who are waiting in queue to receive a callback instead of waiting on hold. This improves customer experience by reducing hold times and allowing callers to continue with their day while maintaining their place in the queue.

## How It Works

1. **Call Answered**: When an inbound call is answered and no agents are immediately available, the system uses Telnyx's `gather_using_speak` to present options to the caller.

2. **Caller Chooses**:
   - **Press 1**: Stay on hold with music (no callback)
   - **Press 2**: Receive a callback when an agent is available

3. **Press 1 Flow** (Stay on Hold):
   - Call is enqueued without callback options
   - Hold music plays continuously
   - Caller waits in queue for next available agent

4. **Press 2 Flow** (Request Callback):
   - System speaks confirmation message
   - Call is enqueued WITH callback parameters
   - Original call is hung up
   - After timeout period, Telnyx initiates callback to customer's number
   - Customer answers callback → automatically re-enqueued
   - Agent accepts the callback call from queue

5. **No Input/Invalid Input**: Defaults to stay on hold (same as Press 1)

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Queue Callback Configuration
QUEUE_CALLBACK_ENABLED=true
QUEUE_CALLBACK_TIMEOUT_SECS=300
QUEUE_MAX_WAIT_TIME_SECS=600
```

### Parameters

- **QUEUE_CALLBACK_ENABLED**: Enable or disable queue callback functionality (true/false)
- **QUEUE_CALLBACK_TIMEOUT_SECS**: Time in seconds before initiating a callback (default: 300 = 5 minutes)
- **QUEUE_MAX_WAIT_TIME_SECS**: Maximum time a call can remain in queue (default: 600 = 10 minutes)

## Implementation Details

### Gather Using Speak

When no agents are available, the system prompts the caller:

```javascript
{
  payload: 'All agents are currently busy. Press 1 to stay on hold, or press 2 to receive a callback when an agent becomes available.',
  voice: 'female',
  language: 'en-US',
  minimum_digits: 1,
  maximum_digits: 1,
  timeout_millis: 10000,
  valid_digits: '12'
}
```

### Webhook Handlers

**call.gather.ended** - Handles digit selection:
- `digits: '1'` → Enqueue without callback, start hold music
- `digits: '2'` → Speak confirmation, enqueue with callback, hangup
- `status: 'no_input'` or `status: 'invalid'` → Default to enqueue without callback

**queue-callback** - Handles callback events:
- **call.initiated**: Callback call is initiated by Telnyx
- **call.answered**: Customer answers → re-enqueue for agent
- **call.hangup**: Callback call ends

### Call Flow

```
1. Inbound Call → Answer → Check Agents
2. No Agents Available → Gather Using Speak (Press 1 or 2)
3a. Press 1 → Enqueue → Play Hold Music → Agent Accepts
3b. Press 2 → Confirm → Enqueue with Callback → Hangup
4. [After timeout] → Telnyx Initiates Callback
5. Customer Answers Callback → Re-enqueue
6. Agent Accepts → Bridge Call
```

## Database Tracking

Callback calls are tracked with:
- `direction: 'callback'` in Voice and CallSession tables
- Original call metadata preserved in client_state
- Full call lifecycle tracking with CallLeg entries

## API Endpoints

### Queue Callback Webhook
- **POST** `/api/voice/queue-callback`
- Handles Telnyx webhook events for callback calls
- Automatically answers and re-enqueues callback calls

## Testing

To test queue callback functionality:

1. Enable callback in `.env`:
   ```bash
   QUEUE_CALLBACK_ENABLED=true
   ```

2. Make a test inbound call with all agents offline

3. Wait for the callback timeout period

4. Telnyx will initiate a callback to the original caller

5. Answer the callback and it will be placed in queue for an agent

## Monitoring

Check server logs for callback activity:

```bash
# Gather prompt
🎤 Starting gather with speak to offer callback option...
✅ Gather with speak initiated successfully

# Digit selection
=== GATHER ENDED ===
Digits collected: 1 (or 2)
📞 Caller pressed 1 - staying on hold without callback
(or)
🔔 Caller pressed 2 - enabling callback

# Enqueue with callback
🔔 Queue callback enabled:
   - Callback URL: https://your-domain.com/api/voice/queue-callback
   - Callback timeout: 300 seconds
   - Max wait time: 600 seconds
✅ Call successfully enqueued with callback support

# Callback webhook events
=== QUEUE CALLBACK WEBHOOK ===
📞 Queue callback call initiated
📞 Queue callback call answered by customer
✅ Callback call enqueued for agent
```

## Benefits

- **Reduced Hold Times**: Customers don't wait on hold
- **Better Experience**: Customers can go about their day
- **Maintains Queue Position**: Callbacks preserve queue order
- **Configurable**: Adjust timeouts based on your needs
- **Full Tracking**: Complete call history and analytics

## Troubleshooting

### Callbacks Not Working

1. Verify `QUEUE_CALLBACK_ENABLED=true` in `.env`
2. Check that webhook URL is publicly accessible
3. Ensure `APP_HOST` and `APP_PORT` are configured correctly
4. Review server logs for callback webhook events
5. Verify Telnyx API credentials

### Callback Timeout Issues

- Adjust `QUEUE_CALLBACK_TIMEOUT_SECS` for faster/slower callbacks
- Ensure value is less than `QUEUE_MAX_WAIT_TIME_SECS`
- Consider queue traffic and average wait times

## Related Documentation

- [Telnyx Queue Callback Documentation](https://telnyx.com/release-notes/queue-callback-functionality)
- [Telnyx Enqueue API](https://developers.telnyx.com/api/call-control/enqueue-call)
- [Telnyx Update Call in Queue API](https://developers.telnyx.com/api/call-control/update-call-in-queue)

## Version History

- **v3.2.0**: Initial implementation of queue callback feature
