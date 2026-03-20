<div align="center">
<h1 align="center">
<img src="telnyx_logo.png"
     alt="Telnyx Logo"
     style="float: center; margin-right: 10px;" />
<br>WEBRTC CONTACT CENTER</h1>
<h3>Developed with the software and tools below.</h3>

<p align="center">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=for-the-badge&logo=JavaScript&logoColor=black" alt="JavaScript" />
<img src="https://img.shields.io/badge/Next.js-000000.svg?style=for-the-badge&logo=Next.js&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React-61DAFB.svg?style=for-the-badge&logo=React&logoColor=black" alt="React" />
<img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4.svg?style=for-the-badge&logo=Tailwind-CSS&logoColor=white" alt="Tailwind CSS" />
<img src="https://img.shields.io/badge/Redux-764ABC.svg?style=for-the-badge&logo=Redux&logoColor=white" alt="Redux" />
<img src="https://img.shields.io/badge/Express-000000.svg?style=for-the-badge&logo=Express&logoColor=white" alt="Express" />
<img src="https://img.shields.io/badge/Sequelize-52B0E7.svg?style=for-the-badge&logo=Sequelize&logoColor=white" alt="Sequelize" />
<img src="https://img.shields.io/badge/Socket.io-010101.svg?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
<img src="https://img.shields.io/badge/PostgreSQL-4169E1.svg?style=for-the-badge&logo=PostgreSQL&logoColor=white" alt="PostgreSQL" />
</p>
</div>

---

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Release Notes](#release-notes)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Webhook Configuration](#webhook-configuration)
- [Architecture](#architecture)
- [Known Issues](#known-issues)
- [Acknowledgments](#acknowledgments)

---

## Overview

A full-featured WebRTC contact center platform built on Telnyx Programmable Voice and Messaging APIs. The application provides a complete agent desktop experience with inbound/outbound voice, SMS/MMS messaging, IVR flow builder, automatic call distribution, Google SSO authentication, and a modern dark mode UI.

**Backend:** Node.js/Express (ESM) with PostgreSQL via Sequelize, Telnyx Node SDK v6, Socket.IO for real-time events.

**Frontend:** Next.js 15 with React, Redux Toolkit (RTK Query), Tailwind CSS, and Telnyx WebRTC SDK.

---

## Features

### Voice
- **Inbound Call Handling** with IVR flow engine
- **Automatic Call Distribution (ACD)** — routes calls to available agents by priority
- **Agent Auto-Routing** — event-driven routing when agents come online
- **Call Bridging** with park-after-unbridge for transfers
- **Cold Transfer** between agents (SIP)
- **Warm Transfer (3-Way)** using supervisor barge with real-time status (dialing/active/failed)
- **Hold Music** playback while callers wait in queue
- **WebRTC Softphone** with dial pad, mute, hold, and call controls
- **Call History** with filterable records

### Messaging
- **Inbound & Outbound SMS** with real-time delivery status updates
- **MMS Support** — send and receive images with inline rendering
- **Media Storage** — inbound MMS attachments downloaded and stored locally
- **Conversation Threading** with agent assignment
- **iMessage-style UI** with message bubbles, timestamps, and delivery indicators

### IVR Builder
- **Visual Flow Editor** built with React Flow (drag-and-drop)
- **30+ Node Types** — answer, speak, gather (DTMF), enqueue, transfer, record, AI assistant, conferencing, and more
- **Publish/Unpublish** flows to phone numbers via dropdown (auto-populated from voice application)
- **Per-Number Routing** — each phone number can have its own IVR flow

### Agent Management
- **Priority-Based Routing** — agents have configurable routing priority
- **Status Management** — online, away, busy, break, DND, offline
- **Real-Time Agent Dashboard** with status indicators
- **Notification Badges** for new calls and messages

### Authentication & Onboarding
- **Username/Password Login** with JWT tokens
- **Google SSO** (OAuth 2.0 via Google Identity Services)
- **Auto-Provisioning** — SIP credential connections created automatically when API key is set
- **Onboarding Wizard** — 6-step guided setup for new users
- **Profile Management** — API keys, connection IDs, avatar upload

### UI/UX
- **Dark Mode** with persistent toggle (localStorage)
- **Responsive Sidebar** with collapsible navigation
- **Telnyx Branding** with custom logo
- **Real-time Updates** via WebSocket (Socket.IO)

---

## Release Notes

### Version 4.0.0 (Latest)
**Released:** 2026-03-20

#### Architecture
- **Full ESM Migration** — all backend code converted from CommonJS to ES Modules
- **Telnyx Node SDK v6** — uses `new Telnyx({ apiKey })` with proper resource methods (`telnyx.calls.actions.answer()`, `telnyx.credentialConnections.create()`, etc.)
- **Next.js App Router** — migrated from CRA to Next.js 15 with app directory structure
- **Redux Toolkit** with RTK Query for API state management
- **Removed all legacy React components** — clean codebase with no dead code

#### New Features
- **IVR Flow Builder** — visual drag-and-drop editor with 30+ node types
- **Automatic Call Distribution** — priority-based agent routing with fallback
- **Event-Driven Auto-Routing** — routes queued calls when agents come online (no polling)
- **Warm Transfer with Supervisor Barge** — 3-way calling with real-time status via webhook
- **Google SSO** — sign in/register with Google, auto-creates user account
- **MMS Support** — send/receive images, local media storage
- **Onboarding Wizard** — guided 6-step setup for new users
- **Dark Mode** — system-wide dark theme with persistent toggle
- **Notification Badges** — real-time badge counts for calls and messages
- **SIP Auto-Provisioning** — credential connections created when user adds API key
- **Connection ID Management** — voice app and WebRTC connection IDs in user profile
- **Cloudflare Tunnel Support** — configured for split frontend/backend with `trust proxy`

#### Security
- **Helmet** with CORS properly configured for cross-origin tunnels
- **Rate Limiting** on login and webhook endpoints
- **JWT Authentication** with middleware
- **AES-256-GCM Encryption** for SIP passwords at rest
- **Zod Validation** for environment variables

---

### Previous Releases

#### Version 3.1.0
- Hold music system with Base64-encoded MP3 playback
- Telnyx status monitoring components
- Enhanced phone validation

#### Version 3.0.0
- Migration to Next.js 15 and TypeScript
- Enhanced call management system
- Refactored WebRTC call handling

[View All Releases](https://github.com/team-telnyx/SE-webrtc-contact_center/releases)

---

## Repository Structure

```
SE-webrtc-contact_center/
├── client/                          # Next.js Frontend
│   ├── app/
│   │   ├── (auth)/                  # Login & Register pages
│   │   ├── (dashboard)/             # Protected dashboard pages
│   │   │   ├── dashboard/           # Agent dashboard
│   │   │   ├── phone/               # Phone page with queue & transfers
│   │   │   ├── sms/                 # SMS/MMS conversations
│   │   │   ├── ivr/                 # IVR flow builder
│   │   │   ├── history/             # Call history
│   │   │   ├── numbers/             # Phone number management
│   │   │   ├── profile/             # User profile & settings
│   │   │   └── layout.jsx           # Dashboard layout (sidebar, header, softphone)
│   │   ├── components/              # Shared components
│   │   │   ├── GoogleSignIn.jsx     # Google SSO button
│   │   │   ├── OnboardingWizard.jsx # New user setup wizard
│   │   │   ├── Softphone.jsx        # Full softphone with dialpad
│   │   │   ├── SoftphoneMini.jsx    # Compact softphone in header
│   │   │   └── TelnyxRTCWrapper.jsx # WebRTC client provider
│   │   ├── globals.css              # Global styles + dark mode overrides
│   │   └── layout.jsx               # Root layout with dark mode init
│   └── src/
│       ├── features/                # Redux slices
│       │   ├── auth/authSlice.js
│       │   ├── call/callSlice.js
│       │   ├── notifications/notificationSlice.js
│       │   └── socket/socketSlice.js
│       ├── store/                   # Redux store, API, middleware
│       │   ├── api.js               # RTK Query API definitions
│       │   ├── socketMiddleware.js   # Socket.IO Redux middleware
│       │   └── store.js
│       └── lib/                     # Utilities
├── server/                          # Express Backend (ESM)
│   ├── config/database.js           # Sequelize PostgreSQL connection
│   ├── models/                      # Database models
│   │   ├── User.js                  # Agent accounts + SIP credentials
│   │   ├── Voice.js                 # Active call tracking
│   │   ├── CallRecord.js            # Call history records
│   │   ├── Conversations.js         # SMS conversation threads
│   │   ├── Messages.js              # Individual messages (SMS/MMS)
│   │   └── IvrFlow.js               # IVR flow definitions
│   ├── routes/
│   │   ├── voiceRoutes.js           # Voice webhooks, queue, transfers
│   │   ├── conversationRoutes.js    # SMS/MMS webhooks, compose, media
│   │   ├── userRoutes.js            # Auth, profile, Google SSO, SIP provisioning
│   │   ├── ivrRoutes.js             # IVR CRUD, publish, connection numbers
│   │   └── websocket.js             # Socket.IO server
│   ├── src/
│   │   ├── services/
│   │   │   ├── auto-route.js        # Automatic call distribution engine
│   │   │   ├── ivr-engine.js        # IVR flow execution engine
│   │   │   ├── telnyx.service.js    # Telnyx SDK service layer
│   │   │   └── ...
│   │   ├── middleware/              # JWT auth, validation, error handling
│   │   └── config/env.js           # Zod-validated environment config
│   ├── seeds/seed.js               # Database seed data
│   └── server.js                   # Express app entry point (HTTPS + WebSocket)
├── telnyx_logo.png
└── package.json                    # Workspace root
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** database
- **Telnyx Account** with:
  - API Key (v2)
  - Call Control Application (voice)
  - SIP Credential Connection (WebRTC)
  - Messaging Profile with phone numbers
- **Google Cloud OAuth Client ID** (optional, for SSO)

### Installation

```bash
git clone https://github.com/team-telnyx/SE-webrtc-contact_center.git
cd SE-webrtc-contact_center
npm install
```

### Environment Configuration

#### Server (`server/.env`)

```env
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="your_db_user"
DB_PASSWORD="your_db_password"
DB_NAME="agent_desktop"

TELNYX_API="KEY_YOUR_TELNYX_API_KEY"
TELNYX_CONNECTION_ID="your_voice_app_connection_id"
TELNYX_VOICE_APP_ID="your_voice_app_connection_id"

APP_HOST="your.domain.com"
APP_PORT="443"

JWT_SECRET="your_32_char_minimum_jwt_secret"
ENCRYPTION_KEY="64_hex_char_encryption_key"

GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
CORS_ORIGINS="*"
```

#### Client (`client/.env.local`)

```env
NEXT_PUBLIC_API_HOST=your.domain.com
NEXT_PUBLIC_API_PORT=443
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

### Running the Application

```bash
# Start both client and server
npm start

# Or run individually
npm run server   # Backend on port 3000
npm run client   # Frontend on port 3001

# Development mode with hot reload
npm run dev
```

---

## Webhook Configuration

Set these webhook URLs in your Telnyx Portal:

| Service | Where to Configure | Webhook URL |
|---------|-------------------|-------------|
| **Voice** | Call Control Application | `https://your.domain.com/api/voice/webhook` |
| **Messaging** | Messaging Profile | `https://your.domain.com/api/conversations/webhook` |

---

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Next.js App   │◄────►│  Express Server  │◄────►│   Telnyx APIs   │
│   (Port 3001)   │      │   (Port 3000)    │      │  Voice, SMS,    │
│                 │      │                  │      │  WebRTC, Numbers│
│  React + Redux  │      │  Socket.IO       │      └─────────────────┘
│  Tailwind CSS   │      │  Sequelize ORM   │
│  WebRTC SDK     │      │  Telnyx SDK v6   │
└─────────────────┘      │  Auto-Route ACD  │
                         │  IVR Engine      │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │   PostgreSQL DB   │
                         │  Users, Calls,    │
                         │  Messages, IVR    │
                         └──────────────────┘
```

**Call Flow:**
1. Inbound call hits voice webhook, IVR engine checks for published flow
2. If IVR flow exists, executes nodes (answer, speak, gather, enqueue)
3. If no flow, default answer + enqueue to General_Queue
4. Auto-route checks for online agents (sorted by priority)
5. Dials agent via SIP, bridges on answer
6. If agent declines, routes to next agent by priority
7. If no agents available, hold music until agent comes online

---

## Known Issues

- Cloudflare Tunnel QUIC connections may drop intermittently (auto-restarts via systemd `Restart=always`)
- Telnyx SDK v6 `.get()` method doesn't pass query params correctly — use `.list()` resource methods instead
- Google Sign-In popup triggers harmless `Cross-Origin-Opener-Policy` console warnings

---

## Acknowledgments

- [Telnyx](https://telnyx.com) — Voice, Messaging, and WebRTC APIs
- [React Flow](https://reactflow.dev) — IVR visual flow editor
- [Tailwind CSS](https://tailwindcss.com) — Utility-first CSS framework
- [Redux Toolkit](https://redux-toolkit.js.org) — State management

---
