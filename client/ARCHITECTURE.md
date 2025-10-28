# Contact Center V2 - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js Client                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ PhonePage    │  │  SmsPage     │  │  Dashboard   │      │
│  │              │  │              │  │              │      │
│  │ - Dial Pad   │  │ - Convos     │  │ - Metrics    │      │
│  │ - Call Queue │  │ - Messages   │  │ - Status     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                  │                                 │
│         ├──────────────────┴─────────────────┐              │
│         │                                    │              │
│  ┌──────▼──────────────┐            ┌───────▼───────┐      │
│  │ CallManagerContext  │            │  SSE Hook     │      │
│  │                     │            │               │      │
│  │ - Call State        │            │ - Auto-       │      │
│  │ - Queue Data        │            │   Reconnect   │      │
│  └──────┬──────────────┘            └───────┬───────┘      │
│         │                                    │              │
└─────────┼────────────────────────────────────┼──────────────┘
          │                                    │
          │                                    │
    ┌─────▼────────┐                  ┌────────▼─────┐
    │   WebRTC     │                  │  SSE Stream  │
    │  (WebSocket) │                  │   (HTTP/2)   │
    └─────┬────────┘                  └────────┬─────┘
          │                                    │
          │                                    │
┌─────────▼────────────────────────────────────▼──────────────┐
│                    Express Backend Server                    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Telnyx WebRTC  │  │  Call Queue  │  │  Conversations  │ │
│  │   Signaling    │  │   Manager    │  │    Manager      │ │
│  └────────────────┘  └──────────────┘  └─────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   SQLite Database                      │ │
│  │  - Call Sessions  - Messages  - Users  - Queue        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                │
                    ┌───────────▼───────────┐
                    │   Telnyx Cloud APIs   │
                    │  - SIP Trunking       │
                    │  - SMS Messaging      │
                    └───────────────────────┘
```

## Data Flow

### Call Queue Updates (SSE)
```
Backend               Next.js API Route          Client Component
   │                         │                          │
   │◄────Poll every 2s───────┤                          │
   │                         │                          │
   ├─────Queue Data─────────►│                          │
   │                         │                          │
   │                         ├───SSE Stream────────────►│
   │                         │  {type: QUEUE_UPDATE}    │
   │                         │                          │
   │                         │                          ├──Update UI
   │                         │                          │
```

### SMS Updates (SSE)
```
Backend               Next.js API Route          SmsPage
   │                         │                       │
   │◄────Poll every 3s───────┤                       │
   │                         │                       │
   ├─────Conversations───────►│                       │
   │                         │                       │
   │                         ├───SSE Stream──────────►│
   │                         │  {type: ASSIGNED_...}  │
   │                         │                       │
   │                         │                       ├──Update Convos
   │                         │                       │
```

### WebRTC Call (WebSocket)
```
Client                Telnyx SDK              Backend
  │                       │                      │
  ├───newCall()──────────►│                      │
  │                       │                      │
  │                       ├──WebSocket SDP──────►│
  │                       │  (Signaling)         │
  │                       │                      │
  │                       │◄─────SDP Answer──────┤
  │                       │                      │
  │◄──RTP Media Stream────┤                      │
  │   (Audio)             │                      │
```

## Technology Stack

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router
- **UI Library**: Material-UI (MUI) v5
- **WebRTC**: Telnyx React Client SDK
- **State Management**: React Context API
- **Real-time Updates**: Server-Sent Events (SSE)
- **Styling**: Material-UI Theme + Tailwind CSS

### Backend (Express)
- **Framework**: Express.js
- **Database**: SQLite3
- **WebRTC**: Telnyx WebRTC SDK
- **SMS**: Telnyx REST API
- **Authentication**: JWT tokens

## Key Features

### 1. Phone Center (`/phone`)
- WebRTC-based calling
- Dial pad interface
- Call queue management
- Hold/Unhold functionality
- Call transfer capabilities

### 2. SMS Center (`/sms`)
- Multi-conversation management
- Message queue (unassigned messages)
- Real-time message updates via SSE
- Compose new conversations

### 3. Dashboard (`/dashboard`)
- Active calls metrics
- Message queue status
- Agent availability
- Average response time

### 4. Profile (`/profile`)
- User information management
- Avatar upload
- Phone number configuration

## API Routes

### Next.js API Routes (SSE)
- `GET /api/events/calls` - Call queue stream
- `GET /api/events/messages?username={user}` - Conversation stream

### Express Backend APIs
- `POST /api/calls/accept` - Accept queue call
- `GET /api/calls/queue` - Get call queue
- `GET /api/conversations/assignedTo/:username` - Get conversations
- `GET /api/conversations/unassignedConversations` - Get message queue
- `POST /api/conversations/assignAgent` - Assign conversation

## Security

- JWT-based authentication
- Token stored in localStorage
- API routes protected with middleware
- HTTPS required for WebRTC
- SIP credentials fetched from backend

## Performance Optimizations

1. **SSE vs Polling**: Reduced from constant polling to event-driven updates
2. **Component Lazy Loading**: Dynamic imports for large components
3. **Image Optimization**: Next.js automatic image optimization
4. **Code Splitting**: Automatic route-based splitting
5. **Caching**: API responses cached where appropriate

## Development Commands

```bash
# Install dependencies
npm install

# Development server (port 3001)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Run with HTTPS (for WebRTC testing)
npm run dev:https
```

## Environment Variables

Required in `.env.local`:
```bash
NEXT_PUBLIC_API_HOST=localhost
NEXT_PUBLIC_API_PORT=3000
NEXT_PUBLIC_SIP_LOGIN=your_sip_username
NEXT_PUBLIC_SIP_PASSWORD=your_sip_password
```

## Browser Requirements

- **Chrome/Edge**: v90+ (recommended)
- **Firefox**: v88+
- **Safari**: v14+
- **WebRTC**: Required for voice calls
- **EventSource**: Required for SSE (all modern browsers)

## Deployment Considerations

### Next.js Deployment
- Vercel (recommended)
- Docker container
- Node.js server (standalone)

### WebRTC Requirements
- HTTPS/TLS required
- STUN/TURN servers configured
- Firewall: UDP ports for RTP media

### SSE Considerations
- Keep-alive headers properly set
- Proxy configuration for SSE passthrough
- Load balancer sticky sessions (optional)

## Monitoring & Debugging

### Client-Side Logs
- SSE connection status: `console.log` in useServerSentEvents
- WebRTC call state: Telnyx SDK debug logs
- Component state: React DevTools

### Server-Side Logs
- Express request logging
- Database query logging
- Telnyx API response logging

## Future Enhancements

1. **Redis Integration**: Replace polling with Redis Pub/Sub for SSE
2. **WebSocket Fallback**: Automatic fallback for older browsers
3. **Call Recording**: Store and playback recordings
4. **Analytics Dashboard**: Call metrics and reporting
5. **Multi-tenant Support**: Support multiple organizations
6. **Mobile App**: React Native version
