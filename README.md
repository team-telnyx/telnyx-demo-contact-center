<div align="center">
<h1 align="center">
<img src="telnyx_logo.png"
     alt="Telnyx Logo"
     style="float: center; margin-right: 10px;" />
<br>WEBRTC CONTACT CENTER</h1>
<h3>Developed with the software and tools below.</h3>

<p align="center">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=for-the-badge&logo=JavaScript&logoColor=black" alt="JavaScript" />
<img src="https://img.shields.io/badge/HTML5-E34F26.svg?style=for-the-badge&logo=HTML5&logoColor=white" alt="HTML5" />
<img src="https://img.shields.io/badge/React-61DAFB.svg?style=for-the-badge&logo=React&logoColor=black" alt="React" />

<img src="https://img.shields.io/badge/Axios-5A29E4.svg?style=for-the-badge&logo=Axios&logoColor=white" alt="Axios" />
<img src="https://img.shields.io/badge/Sequelize-52B0E7.svg?style=for-the-badge&logo=Sequelize&logoColor=white" alt="Sequelize" />
<img src="https://img.shields.io/badge/Socket.io-010101.svg?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
<img src="https://img.shields.io/badge/JSON-000000.svg?style=for-the-badge&logo=JSON&logoColor=white" alt="JSON" />
<img src="https://img.shields.io/badge/Express-000000.svg?style=for-the-badge&logo=Express&logoColor=white" alt="Express" />
</p>
</div>

---

##  Table of Contents
- [ Table of Contents](#-table-of-contents)
- [ Overview](#-overview)
- [ Features](#-features)
- [ Release Notes](#-release-notes)
- [ Repository Structure](#-repository-structure)
- [ Modules](#modules)
- [ Getting Started](#-getting-started)
    - [ Installation](#-installation)
    - [ Running SE-webrtc-contact_center_v2](#-running-SE-webrtc-contact_center_v2)
    - [ Tests](#-tests)
- [ Known Issues](#-knownissues)
- [ Acknowledgments](#-acknowledgments)

---


##  Overview

The following repository houses a WebRTC contact center application, building a bridge between client and server-side telephony application using Telnyx Programmable Voice APIs. The client-side lays out a user-friendly interface with features like login, call handling, and real-time messaging. Server-side functionalities include user management, conversations maintenance, and backend voice services interactions such as call bridging, transferring, dialling, queuing and conferencing.

---

##  Features

- Call Bridging
- Cold Transfer
- Warm Transfer
- Conferencing
- Hold, Unhold, Hangup, Dial
- Inbound Messaging
- Outbound Messaging
- Hold Music with Base64-encoded MP3 playback
- Real-time Telnyx Status Monitoring
- Enhanced Authentication and Protected Routes

---

##  Release Notes

### Version 3.1.0 (Latest)
**Released:** 2025-01-28

#### 🎵 New Features
- **Hold Music System**: Base64-encoded MP3 playback (923KB) with infinite loop
- **Telnyx Status Monitoring**: Real-time service status components
- **Phone Validation Enhancement**: Improved validation for multiple formats and country codes

#### 🔒 Authentication Improvements
- Enhanced ProtectedRoute component with better redirect logic
- Removed redundant authentication checks for better performance
- Improved authentication state handling

#### 🎨 UI Enhancements
- Updated Dashboard with better layout and responsiveness
- Enhanced SmsPage with improved message handling
- Refined Softphone and SoftphoneMini components

[View Full Release Notes](https://github.com/team-telnyx/SE-webrtc-contact_center/releases/tag/v3.1.0)

---

### Version 3.0.0
**Released:** 2024

#### Major Upgrade
- Migration to Next.js 15 and TypeScript
- Enhanced call management system
- Refactored WebRTC call handling
- Updated UI components with Material-UI
- Improved database models with enhanced call tracking

[View Full Release Notes](https://github.com/team-telnyx/SE-webrtc-contact_center/releases/tag/v3.0.0)

---

### All Releases
View all releases and their detailed notes on GitHub:
- [Latest Releases](https://github.com/team-telnyx/SE-webrtc-contact_center/releases)
- [Release Tags](https://github.com/team-telnyx/SE-webrtc-contact_center/tags)

---


##  Repository Structure

```sh
└── SE-webrtc-contact_center_v2/
    ├── client/
    │   ├── .env
    │   ├── package-lock.json
    │   ├── package.json
    │   ├── public/
    │   │   ├── index.html
    │   │   ├── manifest.json
    │   │   └── robots.txt
    │   └── src/
    │       ├── App.css
    │       ├── App.js
    │       ├── App.test.js
    │       ├── components/
    │       ├── index.css
    │       ├── index.js
    │       ├── reportWebVitals.js
    │       └── setupTests.js
    ├── package-lock.json
    ├── package.json
    └── server/
        ├── .env
        ├── config/
        │   └── database.js
        ├── models/
        │   ├── Conversations.js
        │   ├── Messages.js
        │   ├── User.js
        │   └── Voice.js
        ├── package-lock.json
        ├── package.json
        ├── routes/
        │   ├── conversationRoutes.js
        │   ├── userRoutes.js
        │   ├── voiceRoutes.js
        │   └── websocket.js
        ├── seeds/
        │   └── seed.js
        └── server.js

```

---


##  Modules

<details closed><summary>Client Components</summary>

| File                                  | Summary                                                                                                                                                                                                                                                                                                                                                                                   |
| ---                                   | ---                                                                                                                                                                                                                                                                                                                                                                                       |
| [Dashboard.tsx]({file})               | Main dashboard layout component that serves as the container for the application's primary interface. Manages navigation state and renders the sidebar, header, and main content area with responsive design.                                                                                                                                                                             |
| [DashboardHeader.tsx]({file})         | Header component displaying user profile, online status, and navigation controls. Includes logout functionality, profile popover with settings/profile links, and integrates with authentication context for user management.                                                                                                                                                             |
| [MainContent.tsx]({file})             | Primary content area component that renders the main dashboard interface. Checks authentication status and adjusts layout based on sidebar state. Displays agent dashboard heading when user is logged in.                                                                                                                                                                                |
| [PhonePage.tsx]({file})               | Comprehensive phone interface component for handling call operations. Features include call queue display, agent list, call acceptance, transfer functionality (cold and warm), and real-time call state management. Integrates with CallManager context and WebSocket for live updates.                                                                                                  |
| [SmsPage.tsx]({file})                 | SMS messaging interface allowing agents to view conversations, send messages, and manage SMS communications. Includes conversation list, message display, and composition interface with real-time updates via WebSocket.                                                                                                                                                                 |
| [Softphone.tsx]({file})               | Full-featured softphone component with dial pad, call controls (hold, unhold, mute, transfer), and call state management. Integrates with Telnyx WebRTC for voice communication and displays active call information.                                                                                                                                                                    |
| [SoftphoneMini.tsx]({file})           | Compact version of the softphone for minimized call control. Provides essential call functions in a smaller interface while maintaining access to key features like hold, mute, and transfer.                                                                                                                                                                                             |
| [Profile.tsx]({file})                 | User profile management component allowing agents to view and update their personal information including name, phone number, and avatar. Handles file uploads for avatar changes and integrates with user API endpoints.                                                                                                                                                                 |
| [ProtectedRoute.tsx]({file})          | Authentication wrapper component that protects routes from unauthorized access. Checks for valid authentication tokens, displays loading state during verification, and redirects unauthenticated users to login page.                                                                                                                                                                    |
| [SideNav.tsx]({file})                 | Navigation sidebar component displaying menu items with icons and unread count badges. Provides links to Dashboard, Phone, Conversations, and other sections with responsive drawer functionality.                                                                                                                                                                                        |
| [CountryCodeSelector.tsx]({file})     | Dropdown component for selecting country codes in phone number inputs. Enhances phone validation and international dialing capabilities.                                                                                                                                                                                                                                                  |
| [TelnyxStatus.tsx]({file})            | Real-time Telnyx service status monitoring component. Displays current operational status of Telnyx services with visual indicators and updates.                                                                                                                                                                                                                                          |
| [TelnyxStatusDashboard.tsx]({file})   | Comprehensive dashboard view of Telnyx service status. Provides detailed status information for multiple Telnyx services and components.                                                                                                                                                                                                                                                  |

</details>

<details closed><summary>Client Contexts</summary>

| File                              | Summary                                                                                                                                                                                                                                                                                       |
| ---                               | ---                                                                                                                                                                                                                                                                                           |
| [AuthContext.tsx]({file})         | Authentication context managing user login state, token validation, and session management. Uses JWT decode to verify tokens and provides authentication state to all components.                                                                                                             |
| [CallManagerContext.tsx]({file})  | Comprehensive call management context handling WebRTC calls, queue management, and call state transitions. Manages incoming calls, active calls, and provides methods for call operations.                                                                                                    |
| [DataCacheContext.tsx]({file})    | Data caching context for optimizing API requests by storing frequently accessed data like agent lists and user information. Reduces network calls and improves performance.                                                                                                                   |
| [EnhancedModalContext.tsx]({file})| Modal management context for handling call-related modals and overlays. Manages modal state for incoming calls, call controls, and user interactions.                                                                                                                                         |
| [PhoneUiProvider.tsx]({file})     | UI state management context specifically for phone interface components. Handles UI-specific state like dialpad visibility and phone interface interactions.                                                                                                                                  |
| [SIPCredentialsContext.tsx]({file})| SIP credentials management context that retrieves and stores user's SIP authentication details. Integrates with Telnyx WebRTC for establishing voice connections.                                                                                                                             |

</details>

<details closed><summary>Server</summary>

| File                        | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---                         | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [package-lock.json]({file}) | This code represents a WebRTC contact center application structure. The 'client' directory contains JavaScript files, and CSS for rendering the interface, with configuration, components, and testing files. The'server' directory manages server-side operations, housing configuration for database, API routing scripts, seeds for initializing data, and model files for user messages and interactions. The'package-lock.json' files list the specific versions of dependencies the project relies on.                                |
| [server.js]({file})         | This is a server-side Node.js application that uses Express.js for API routing. It sets up a secure HTTPS server and initializes a WebSocket connection. It also configures session management, applies middleware for cross-origin resource sharing (CORS) and JSON parsing, and sets up API routes for users, conversations, and voice interactions. Upon startup, this server synchronizes with its database and seeds it with initial data. It operates on a designated port and logs any database initialization errors.              |
| [package.json]({file})      | The directory tree represents a web application using the React.JS library. The client folder contains application front-end elements including JavaScript, CSS, testing files, and public assets. The server folder mainly houses back-end elements: API routes, an Express server file, and Sequelize models for database interactions. It has a package.json file listing important dependencies like express, sequelize, socket.io, and jsonwebtoken for establishing a secure, real-time communication service with database support. |
| [.env]({file})              | The code represents a WebRTC contact center application, in both client and server sections. It holds features for users, conversations, messages, and voice components. The client side contains the React application and tests; the server side handles database configuration, model definitions, routes, seed data and a central server file. An environmental file (.env) for each includes settings like database credentials, API Keys, and host details.                                                                          |

</details>

<details closed><summary>Config</summary>

| File                  | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---                   | ---                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [database.js]({file}) | The code is responsible for setting up a database connection utilizing Sequelize in a Node.js environment. It retrieves configuration from environment variables to set the host, username, password, and database name. The code also provides for error-handling mechanisms for connection issues. Using Sequelize's sync method, tables are created if they do not already exist in the database or are updated if alterations are needed. |

</details>

<details closed><summary>Seeds</summary>

| File              | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---               | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [seed.js]({file}) | The code comprises a script to seed a database. It performs encryption and decryption, and uses the Sequelize ORM to sync models to a database. It generates test users and conversations data, encrypts SIP passwords, hashes user passwords and then creates records in the User and Conversation tables. It's intended to set up the initial state of the database, supporting a web service dealing with user and conversation data management. |

</details>

<details closed><summary>Server Routes</summary>

| File                            | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---                             | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [inboundVoiceRoutes.js]({file}) | Comprehensive inbound voice call handling with webhook endpoints for call events (initiated, answered, enqueued, bridged, hangup). Manages call queue operations, agent acceptance workflow, cold/warm transfers, and call bridging. Includes hold music playback with base64-encoded MP3, queue status monitoring, and call session tracking with detailed state management.                                                                              |
| [outboundVoiceRoutes.js]({file})| Handles outbound WebRTC call operations including dial, answer, bridge, and hangup functionality. Manages agent-initiated calls with webhook handling for call state changes. Integrates with Telnyx API for call control and tracks outbound call sessions in database.                                                                                                                                                                                 |
| [userRoutes.js]({file})         | User management routes handling registration, authentication (login/logout), SIP credential creation and encryption, agent status updates, and profile management. Creates Telnyx SIP connections and manages JWT token-based authentication with bcrypt password hashing.                                                                                                                                                                              |
| [conversationRoutes.js]({file}) | SMS conversation management API providing endpoints for creating conversations, sending/receiving messages, assigning agents to conversations, and webhook handling for incoming SMS and delivery status updates. Manages conversation state and message history in database.                                                                                                                                                                            |
| [telnyxRoutes.js]({file})       | Telnyx-specific API integration routes for phone number management, messaging profiles, and service configuration. Provides endpoints for fetching Telnyx resources and managing telephony settings.                                                                                                                                                                                                                                                     |
| [sseRoutes.js]({file})          | Server-Sent Events (SSE) endpoints providing real-time updates for call events, queue changes, and system notifications. Enables live dashboard updates without WebSocket connections.                                                                                                                                                                                                                                                                   |
| [websocket.js]({file})          | WebSocket server implementation using Socket.IO for real-time bidirectional communication. Handles client connections, disconnections, and broadcasts events like new calls, call state changes, and agent updates. Provides broadcast functions for targeted and global message delivery to connected clients.                                                                                                                                         |

</details>

<details closed><summary>Server Models</summary>

| File                       | Summary                                                                                                                                                                                                                                                                                                                                                                                      |
| ---                        | ---                                                                                                                                                                                                                                                                                                                                                                                          |
| [User.js]({file})          | User model defining agent/user accounts with fields for personal information (firstName, lastName, phoneNumber), authentication credentials (username, password), online status, avatar, and SIP credentials (sipUsername, sipPassword, sipConnection). Includes validation and uniqueness constraints for username and sipUsername.                                                           |
| [Voice.js]({file})         | Voice call tracking model storing call metadata including direction (inbound/outbound), phone numbers (telnyx_number, destination_number), queue information (queue_name, queue_uuid), agent assignments (accept_agent, transfer_agent), call identifiers (bridge_uuid, conference_id), and call status. Used for call history and session management.                                        |
| [CallSession.js]({file})   | Call session model tracking complete call lifecycle with fields for sessionKey (unique identifier), status (ringing/active/ended), from/to numbers, direction, timestamps (started_at, ended_at). Represents the overall call context linking customer and agent call legs together.                                                                                                          |
| [CallLeg.js]({file})       | Individual call leg model representing each participant in a call session. Tracks leg_type (customer/agent), call_control_id, status, direction, start/end times, hangup details, and links to parent CallSession via sessionKey. Enables tracking of multi-party calls and transfers with separate legs for each participant.                                                                |
| [Conversations.js]({file}) | SMS conversation model with fields for conversation_id, from_number, to_number, agent assignment (assigned_agent, assigned_to), message content (last_message), status tracking, and timestamps. Defines one-to-many relationship with Messages model where each conversation can have multiple messages.                                                                                     |
| [Messages.js]({file})      | SMS message model storing individual message data including message_id, direction (inbound/outbound), message type, from/to numbers, text body, media attachments, delivery status, tags, and foreign key reference to parent Conversation. Supports both text and MMS messages with media URLs.                                                                                              |

</details>

---

##  Getting Started

***Dependencies***

Please ensure you have the following dependencies installed on your system:

1. Setup .env in your client folder:
```sh
REACT_APP_TELNYX_API_KEY="TELNYX API KEY"
REACT_APP_API_HOST="FQDN OR IP OF YOUR FRONT END"
REACT_APP_API_PORT="CLIENT PORT HERE"
```
2. Setup .env in your server folder:
```sh
DB_HOST="IP or FQDN OF YOUR DATABASE"
DB_USER="DATABASE USER"
DB_PASSWORD="DATABASE PASSWORD"
DB_NAME="agent_desktop"
TELNYX_API="TELNYX API KEY"
APP_HOST="FQDN OR IP OF YOUR APP (THIS WILL BE USED FOR SETTING UP YOUR TELNYX WEBHOOK URLs)"
APP_PORT="APP PORT (THIS WILL BE USED FOR SETTING UP YOUR TELNYX WEBHOOK URLs)"
```

###  Installation

1. Clone the SE-webrtc-contact_center_v2 repository:
```sh
git clone https://github.com/team-telnyx/SE-webrtc-contact_center_v2.git
```

2. Change to the project directory:
```sh
cd SE-webrtc-contact_center_v2
```

3. Install the dependencies:
```sh
npm install
```

###  Running SE-webrtc-contact_center_v2

```sh
npm run start
```

###  Tests
```sh
npm test
```

---


##  Known Issues

> - `Warm Transfer`


---

##  Acknowledgments

- TELNYX LLC

---

