# System Architecture

This document provides a comprehensive overview of the WebRTC Contact Center v2 architecture, including system design, data flow, and component relationships.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Browser   │    │   Web Browser   │    │   Web Browser   │
│   (Agent 1)     │    │   (Agent 2)     │    │   (Agent N)     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ HTTPS/WSS           │ HTTPS/WSS           │ HTTPS/WSS
          │                      │                      │
    ┌─────┴──────────────────────┴──────────────────────┴─────┐
    │                 Load Balancer                           │
    │            (nginx/CloudFlare)                           │
    └─────────────────────┬───────────────────────────────────┘
                          │ HTTPS/WSS
                          │
    ┌─────────────────────┴───────────────────────────────────┐
    │              React Frontend                             │
    │         (Client Application)                            │
    │  • Material-UI Components                              │
    │  • WebSocket Client                                    │
    │  • Telnyx WebRTC SDK                                  │
    │  • Call Management UI                                  │
    └─────────────────────┬───────────────────────────────────┘
                          │ HTTPS API Calls
                          │ WebSocket Events
                          │
    ┌─────────────────────┴───────────────────────────────────┐
    │              Node.js Backend                            │
    │           (Express + Socket.io)                         │
    │  • REST API Endpoints                                  │
    │  • WebSocket Event Handling                            │
    │  • JWT Authentication                                   │
    │  • Call Queue Management                               │
    └─────────┬───────────────────┬───────────────────────────┘
              │                   │
              │ SQL Queries      │ HTTP API Calls
              │                   │
    ┌─────────┴─────────┐    ┌─────┴─────────┐
    │  SQLite Database  │    │ Telnyx APIs   │
    │   • Users         │    │ • WebRTC      │
    │   • Calls         │    │ • Voice       │
    │   • Messages      │    │ • SMS         │
    └───────────────────┘    └───────────────┘
```

## Component Architecture

### Frontend Architecture (React)

```
App.js (Root Component)
├── AuthContext (Authentication State)
├── CallManagerContext (Call State Management)
├── EnhancedModalContext (WebRTC Management)
│
├── MainContent.jsx (Dashboard)
│   ├── DashboardMetrics
│   ├── AgentStatus
│   └── MessageNotifications
│
├── PhonePage.jsx (Main Interface)
│   ├── DialPad
│   ├── CallQueue
│   ├── AgentDashboard
│   └── CallControls
│
├── UniversalCallModal.jsx (Call Interface)
│   ├── CallControls
│   ├── CallTimer
│   ├── AudioControls
│   └── HangupDetection
│
├── SmsPage.jsx (Messaging)
│   ├── ConversationList
│   ├── MessageThread
│   └── ComposeMessage
│
└── Services
    ├── apiService.js (HTTP Client)
    ├── socketService.js (WebSocket Client)
    └── telnyxService.js (WebRTC Integration)
```

### Backend Architecture (Node.js)

```
server.js (Main Server)
├── Express App Configuration
├── HTTPS Server Setup
├── Socket.io WebSocket Server
├── Database Connection
├── Authentication Middleware
├── CORS Configuration
├── Rate Limiting
└── Route Registration

Routes
├── userRoutes.js
│   ├── POST /api/users/login
│   ├── POST /api/users/register
│   ├── GET  /api/users/agents
│   └── PUT  /api/users/profile
│
├── voiceRoutes.js
│   ├── GET  /api/voice/queue
│   ├── POST /api/voice/accept-call
│   ├── POST /api/voice/decline-call
│   ├── POST /api/voice/hangup-call
│   └── POST /api/telnyx/webhook
│
└── messageRoutes.js
    ├── GET  /api/conversations
    ├── POST /api/conversations/send
    └── POST /api/conversations/assign

WebSocket Events (websocket.js)
├── Connection Management
├── Call Event Broadcasting
├── Agent Status Updates
├── Message Notifications
└── Real-time Queue Updates
```

## Data Flow Architecture

### Call Management Flow

```
1. Incoming Call
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Telnyx    │───▶│    Server    │───▶│  All Agents UI  │
│   Webhook   │    │ NEW_CALL     │    │  Queue Update   │
└─────────────┘    │ Event        │    └─────────────────┘
                   └──────────────┘

2. Call Acceptance
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Agent UI   │───▶│    Server    │───▶│   Telnyx API    │
│  Accept     │    │ accept_call  │    │  Bridge Call    │
│  Button     │    │ Event        │    └─────────────────┘
└─────────────┘    └──────────────┘

3. Call Active State
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Telnyx     │───▶│    Server    │───▶│  Agent Modal    │
│  ACCEPTED   │    │ CALL_ACCEPTED│    │  Opens with     │
│  Webhook    │    │ Event        │    │  Call Controls  │
└─────────────┘    └──────────────┘    └─────────────────┘

4. Call Termination
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ Remote/Agent│───▶│    Server    │───▶│  Agent Modal    │
│  Hangup     │    │ CALL_HANGUP  │    │  Closes +       │
│             │    │ Event        │    │  Queue Update   │
└─────────────┘    └──────────────┘    └─────────────────┘
```

### Real-time Data Synchronization

```
WebSocket Event Flow:

Client                  Server                  Database/API
  │                       │                        │
  │────── Connect ────────▶│                        │
  │                       │                        │
  │                       │◀──── DB Change ───────│
  │◀─── Broadcast ────────│                        │
  │                       │                        │
  │──── User Action ─────▶│                        │
  │                       │────── Update ─────────▶│
  │                       │                        │
  │◀─── Confirmation ─────│                        │
  │                       │                        │

Events:
• NEW_CALL              • CALL_ACCEPTED         • CALL_HANGUP
• NEW_MESSAGE           • AGENT_STATUS_UPDATED  • CALL_UPDATE
• QUEUE_UPDATE          • MESSAGE_RECEIVED      • RECONNECT
```

## Authentication Architecture

### JWT Token Flow

```
Login Process:
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Client     │───▶│    Server    │───▶│   Database      │
│  Credentials│    │  Validate    │    │  User Lookup    │
└─────────────┘    │  + Generate  │    └─────────────────┘
                   │  JWT Token   │
                   └──────┬───────┘
                          │
┌─────────────┐    ┌──────┴───────┐
│  Client     │◀───│  JWT Token   │
│  Storage    │    │  + User Info │
└─────────────┘    └──────────────┘

API Request Flow:
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Client     │───▶│    Server    │───▶│  Token Valid?   │
│  + JWT      │    │  Middleware  │    │  Not Expired?   │
│  Header     │    │              │    │  Signature OK?  │
└─────────────┘    └──────────────┘    └─────────────────┘
                          │                       │
                          ▼                       │
                   ┌──────────────┐              │
                   │   Process    │◀─────────────┘
                   │   Request    │
                   └──────────────┘
```

### Security Layers

```
1. Transport Layer Security (TLS)
   ├── HTTPS for all HTTP traffic
   ├── WSS for WebSocket connections
   └── Certificate validation

2. Application Layer Security
   ├── JWT token authentication
   ├── Password hashing (bcrypt)
   ├── Input validation & sanitization
   └── SQL injection prevention

3. Network Layer Security
   ├── CORS policy enforcement
   ├── Rate limiting per IP
   ├── Request size limits
   └── Helmet.js security headers

4. Authorization
   ├── Role-based access control
   ├── Resource-level permissions
   ├── API endpoint protection
   └── WebSocket event filtering
```

## Database Architecture

### Entity Relationship Diagram

```
┌─────────────────────────────────────────┐
│                 Users                   │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ username (UNIQUE)                       │
│ email (UNIQUE)                          │
│ password (hashed)                       │
│ firstName                               │
│ lastName                                │
│ role (agent/admin/supervisor)           │
│ status (active/inactive)                │
│ phone                                   │
│ created_at                              │
│ updated_at                              │
└─────────────────┬───────────────────────┘
                  │
                  │ 1:N (FK: agent_id)
                  │
┌─────────────────▼───────────────────────┐
│                 Calls                   │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ call_control_id (UNIQUE)                │
│ from_number                             │
│ to_number                               │
│ status (active/completed/failed)        │
│ direction (inbound/outbound)            │
│ duration                                │
│ agent_id (FK)                           │
│ bridge_id                               │
│ customer_call_id                        │
│ created_at                              │
│ ended_at                                │
└─────────────────┬───────────────────────┘
                  │
                  │ 1:N (FK: agent_id)
                  │
┌─────────────────▼───────────────────────┐
│               Messages                  │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ conversation_id                         │
│ from_number                             │
│ to_number                               │
│ body                                    │
│ media_url                               │
│ direction (inbound/outbound)            │
│ status (received/sent/failed)           │
│ agent_id (FK)                           │
│ created_at                              │
└─────────────────────────────────────────┘
```

### Database Indexes

```sql
-- Performance indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_calls_agent_id ON calls(agent_id);
CREATE INDEX idx_calls_status ON calls(status);
CREATE INDEX idx_calls_created_at ON calls(created_at);
CREATE INDEX idx_calls_control_id ON calls(call_control_id);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_agent_id ON messages(agent_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_status ON messages(status);
```

## WebRTC Architecture

### Telnyx Integration Flow

```
Call Initiation:
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Agent UI   │───▶│   Frontend   │───▶│  Telnyx SDK     │
│  Dial       │    │  makeCall()  │    │  call.dial()    │
│  Number     │    │              │    └─────────────────┘
└─────────────┘    └──────────────┘           │
                                              │
                   ┌──────────────┐    ┌─────▼─────────┐
                   │   Backend    │◀───│  Telnyx Cloud │
                   │  Webhook     │    │  WebRTC       │
                   │  Events      │    │  Gateway      │
                   └──────────────┘    └───────────────┘

WebRTC Connection:
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│  Agent A    │◀───────▶│  Telnyx WebRTC  │◀───────▶│  Agent B    │
│  Browser    │   P2P   │    Gateway      │   P2P   │  Browser    │
│             │   Media │  (STUN/TURN)    │  Media  │             │
└─────────────┘         └─────────────────┘         └─────────────┘
       │                                                    │
       │ Signaling                                Signaling │
       │ (WebSocket)                            (WebSocket) │
       │                                                    │
       ▼                ┌──────────────┐                    ▼
┌─────────────┐         │    Server    │         ┌─────────────┐
│ Call State  │◀───────▶│  WebSocket   │◀───────▶│ Call State  │
│ Management  │         │   Events     │         │ Management  │
└─────────────┘         └──────────────┘         └─────────────┘
```

### Call State Management

```
State Transitions:

IDLE ──────▶ TRYING ──────▶ RINGING ──────▶ ACTIVE ──────▶ ENDED
 ▲             │              │             │ ▲           │
 │             ▼              ▼             ▼ │           │
 │           FAILED        DECLINED      HOLDING          │
 │             │              │             │ │           │
 │             └──────────────┴─────────────┘ │           │
 │                                           │           │
 └───────────────────────────────────────────┴───────────┘

Events:
• CALL_INITIATED    → TRYING
• CALL_RINGING      → RINGING
• CALL_ANSWERED     → ACTIVE
• CALL_HOLD         → HOLDING
• CALL_UNHOLD       → ACTIVE
• CALL_DECLINED     → DECLINED → IDLE
• CALL_FAILED       → FAILED → IDLE
• CALL_HANGUP       → ENDED → IDLE
```

## Performance Architecture

### Caching Strategy

```
Frontend Caching:
├── Browser Cache (HTTP headers)
├── Service Worker (offline support)
├── React State Management
├── API Response Caching
└── WebSocket Event Buffering

Backend Caching:
├── Response Compression (gzip)
├── Static Asset Caching
├── Database Query Optimization
├── Connection Pooling
└── Rate Limiting Cache
```

### Scalability Considerations

```
Horizontal Scaling:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Server 1  │    │   Server 2  │    │   Server N  │
│             │    │             │    │             │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
              ┌───────────▼──────────┐
              │    Load Balancer     │
              │   (nginx/haproxy)    │
              └──────────────────────┘

Shared Resources:
├── Redis (Session Store)
├── Database Cluster
├── File Storage (S3/NFS)
└── WebSocket Event Bus
```

## Monitoring Architecture

### Observability Stack

```
Logs:
├── Application Logs (Winston)
├── Access Logs (Morgan)
├── Error Logs (Sentry)
└── System Logs (systemd)

Metrics:
├── Application Metrics (Prometheus)
├── System Metrics (Node Exporter)
├── Database Metrics (SQLite stats)
└── WebRTC Metrics (Telnyx dashboard)

Tracing:
├── Request Tracing (OpenTracing)
├── WebSocket Event Tracing
├── Database Query Tracing
└── External API Tracing

Health Checks:
├── HTTP Health Endpoint
├── Database Connection Check
├── WebSocket Status Check
├── External API Status Check
└── SSL Certificate Expiry Check
```

## Deployment Architecture

### Production Deployment

```
Internet
    │
┌───▼───────────────────────────────────┐
│          CloudFlare CDN               │
│        (SSL Termination)              │
└───┬───────────────────────────────────┘
    │
┌───▼───────────────────────────────────┐
│         nginx Reverse Proxy           │
│    (Load Balancing + SSL Redirect)    │
└───┬───────────────────────────────────┘
    │
┌───▼───┐    ┌─────────┐    ┌─────────┐
│ App 1 │    │  App 2  │    │  App N  │
│ :3001 │    │  :3002  │    │  :300N  │
└───────┘    └─────────┘    └─────────┘
    │            │              │
    └────────────┼──────────────┘
                 │
        ┌────────▼────────┐
        │ Shared Database │
        │   + File Store  │
        └─────────────────┘
```

### Container Architecture

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3002
CMD ["node", "server.js"]
```

### Infrastructure as Code

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
    volumes:
      - ./database:/app/database
      - ./logs:/app/logs
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - app
    restart: unless-stopped
```

## Security Architecture

### Threat Model

```
Attack Vectors:
├── Network Layer
│   ├── DDoS attacks
│   ├── Man-in-the-middle
│   └── Packet sniffing
│
├── Application Layer
│   ├── SQL injection
│   ├── XSS attacks
│   ├── CSRF attacks
│   └── Authentication bypass
│
├── WebRTC Layer
│   ├── Media hijacking
│   ├── Signaling manipulation
│   └── STUN/TURN attacks
│
└── Infrastructure Layer
    ├── Container escapes
    ├── Privilege escalation
    └── Configuration exploits

Mitigations:
├── HTTPS/WSS everywhere
├── Input validation
├── Parameterized queries
├── JWT token expiration
├── Rate limiting
├── CORS policies
├── CSP headers
└── Regular updates
```

This architecture provides a robust, scalable foundation for the WebRTC Contact Center application with proper separation of concerns, real-time capabilities, and enterprise-grade security.