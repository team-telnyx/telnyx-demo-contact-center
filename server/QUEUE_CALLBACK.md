# Queue Callback Feature

## Overview

The Queue Callback feature allows callers who are waiting in queue to receive a callback instead of waiting on hold. This improves customer experience by reducing hold times and allowing callers to continue with their day while maintaining their place in the queue.

## How It Works

1. **Call Enqueued**: When an inbound call is answered and no agents are immediately available, the call is placed in the queue with callback options enabled.

2. **Callback Initiated**: Based on the configured timeout and wait time settings, Telnyx's system can initiate a callback to the customer's number.

3. **Customer Answers**: When the customer answers the callback, the call is automatically placed back into the queue.

4. **Agent Accepts**: An available agent can accept the callback call from the queue, just like any other queued call.

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

### Enqueue Call with Callback

When a call is enqueued, the following parameters are sent to Telnyx:

```javascript
{
  queue_name: 'General_Queue',
  queue_callback_url: 'https://your-domain.com/api/voice/queue-callback',
  callback_timeout_secs: 300,
  max_wait_time_secs: 600,
  client_state: <base64-encoded-call-data>
}
```

### Webhook Endpoint

The `/api/voice/queue-callback` endpoint handles callback events:

- **call.initiated**: Callback call is initiated by Telnyx
- **call.answered**: Customer answers the callback
- **call.hangup**: Callback call ends

### Call Flow

```
1. Inbound Call → Answer → Check Agents
2. No Agents Available → Enqueue with Callback Options
3. Play Hold Music
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
# Callback configuration on enqueue
🔔 Queue callback enabled: true
🔔 Queue callback configuration:
   - Callback URL: https://your-domain.com/api/voice/queue-callback
   - Callback timeout: 300 seconds
   - Max wait time: 600 seconds

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
