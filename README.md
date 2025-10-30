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

<details closed><summary>Client</summary>

| File                        | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---                         | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [package-lock.json]({file}) | The code represents a structure for a WebRTC Contact Center application, including the client and server folders. The client folder contains front-end code, including components, CSS, test files, and Web vital reports. The server folder consists of back-end functionalities, including database config, user, voice, conversation, and websocket routing, and database seeding. The package-lock.json file in the client folder specifies package dependencies, including versions of Emotion, Material-UI, and Mui for the graphical user interface.                                      |
| [package.json]({file})      | This code specifies a Javascript project called "contact-center-v2-demo" built using React. The application consists of a client and server side. The client side comprises of dependencies used for UI design, testing, routing, secure transmission, and websocket communication. It also specifies scripts for starting, building, testing, and ejecting the project. The project configuration strictly follows certain coding standards and targets all modern browsers except Opera Mini. The server side manages data with specific routes for user conversations and voice transmission. |
| [.env]({file})              | The given code represents a WebRTC-based contact center application structure divided into client and server sides. The server handles user-related operations, voice services, conversations, and WebSocket communication, using database models for storage. The client side, created with React, consists of environment variables, styling, and functionality with component management. A Telnyx API key is used, indicating possible telecommunication functionalities, and the app is hosted on "osbs.ca" on port 3000.                                                                   |

</details>

<details closed><summary>Client SRC</summary>

| File                         | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---                          | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [App.css]({file})            | The code specifies the CSS styling for a WebRTC contact center application. It includes styles for the root App component, such as text alignment and the rotating App logo. There are also styles for the header, links, animation transitions, and different containers like the parent container and queue container. Moreover, the dial pad layout and interaction are styled with grid styling, padding, hover effects, and transitions. A custom font'Inter' is also defined.                                          |
| [index.js]({file})           | The code displays a directory tree for a WebRTC contact center application. The client-side includes a React application, with root component rendered in'index.js'. The server-side contains a Node.js server with various API routes, database configuration and models for chat messaging and voice communication. A'reportWebVitals' function is used in the client-side to monitor app performance, which can report to an analytics endpoint.                                                                          |
| [setupTests.js]({file})      | The code imports'jest-dom' from'@testing-library', a customized jest matchers package for making assertions on DOM nodes. It's used for unit testing in React applications, allowing checks for elements based on text content. This file,'setupTests.js', is located in the client's source directory of a project structured for a contact center application using webRTC technology with separate configurations for client and server.                                                                                  |
| [App.js]({file})             | The code represents a WebRTC contact center application that features authentication and routes to various components like login, registration, a main dashboard, phone, SMS, and message queues, and user settings and profiles. It displays real-time unread message counts using WebSockets. The application utilizes TelnyxRTCProvider to access Telephony capabilities and manages application state using React context for theme, authorization, modals, and SIP credentials.                                         |
| [reportWebVitals.js]({file}) | The provided code is part of a web-based contact center application, which includes separate client and server structures and a WebRTC (Web Real-Time Communication) feature. The specific code excerpt is from `reportWebVitals.js` in the client directory, which exports a function to import and report web vitals like Cumulative Layout Shift (CLS), First Input Delay (FID), First Contentful Paint (FCP), Largest Contentful Paint (LCP), and Time to First Byte (TTFB) if a performance entry function is provided. |
| [App.test.js]({file})        | The provided code is an automated test that verifies the rendering of the'learn react' link in the'App' component. This test is part of a larger application, structured with a front-end client and a back-end server. Overall, the application appears to handle web-based real-time communication, as seen by the WebRTC (Web Real Time Communication) reference in the directory name, and manages conversations, messages, users, and voices.                                                                           |
| [index.css]({file})          | This code sets the overall font styles for a web application housed within the SE-webrtc-contact_center_v2 directory. It designates main fonts for the body text and a monospace font for code elements. It standardizes styling to ensure consistency across different browsers and operating systems by applying font smoothing options.                                                                                                                                                                                   |

</details>

<details closed><summary>Components</summary>

| File                                | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---                                 | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [LoginPage.jsx]({file})             | The code presents a login interface that accepts username and password, sends a login request to the backend using axios, handles errors, and, on successful login, receives a token, which it saves to localStorage. It updates the state to show successful login and redirects the user to the dashboard. There's also an option for navigating to a registration page. Core concepts used are React, hooks, axios for HTTP requests, and react-router-dom for navigation.                                                                          |
| [Modal.jsx]({file})                 | The code defines a React component, CustomModal, for a draggable call UI overlay. Using context, it retrieves the current call state and data about calling/called parties. It displays different strings and buttons based on the call direction and state, such as answering, declining, or hanging up an active call. If the modal is open, it renders the overlay on the document's body through a portal. The styles make the overlay semi-transparent, draggable and clickable.                                      |
| [MainContent.jsx]({file})           | This JavaScript code creates a React component named'MainContent'. It utilizes hooks from React for state and side effects, and uses material UI components for layout. The function "useAuth" is imported from'AuthContext' to check if the user is logged in. If not, a message prompts the user to log in. Otherwise, an Agent Dashboard heading is displayed. The'isOpen' prop controls the component's margin.                                                                                                                                    |
| [UnreadCount.jsx]({file})           | The given code sets up a React context'UnreadCountContext' for managing notifications about unread messages. It provides a provider function'UnreadCountProvider' and a custom hook'useUnreadCount' to access states like total unread count, queue unread count, and call queue unread count, and their respective update functions. The context must be used within a react component wrapped by'UnreadCountProvider'.                                                                                                                               |
| [DashboardHeader.jsx]({file})       | The code defines a react component (DashboardHeader), which displays an application's header bar, including the profile and settings options for logged-in users. It fetches user data, displays logout functionality, updates the user's online status, and decodes a token stored in the local storage to extract the username. The ProfilePopover provides links to update user settings and view the user's profile. It uses Context and Hooks for state management and side effects. The header also includes a logo and a slide-out menu button. |
| [SideNav.jsx]({file})               | The code describes a sidebar component in a React application. It uses Material-UI components to create a navigation drawer populated with list items linked to different paths. Each item consists of an icon, a text label, and possibly a badge showing unread counts. The badge counts vary depending on the item, reflecting unread messages or calls. The drawer's width varies according to the'isOpen' prop received.                                                                                                                          |
| [SmsPage.css]({file})               | The provided code is a CSS file for styling a web application's SMS page. It defines styles for different elements of the page, like conversation lists, message lists, sent and received messages. It also includes the styling of an input field for messaging, with a particular focus on responsiveness and user engagement. The layout is designed to be in a two-column flex display, with both columns having equal flex values. Various visual enhancements, including colors, padding, and shadows, are used to improve aesthetics.           |
| [RegisterPage.jsx]({file})          | The given code defines a'RegisterPage' component in a web-based contact center application. It provides a registration form where users can enter data such as firstName, lastName, phoneNumber, avatar (as.jpeg), username, and password. Input validation is performed, ensuring that the appropriate file type is uploaded for the avatar. A successful form submission leads to an API request to a server to register the user, and then redirects them to the login page. Error states are managed and displayed to the user as necessary.       |
| [SmsPage.jsx]({file})               | The provided code represents an SMS (Short Message Service) page in a client-server application where agents can view and participate in SMS conversations. The app fetches agent details and conversations from an API, establishes a WebSocket connection for receiving real-time updates, allows the user to view and select existing conversations, and enables sending new messages or replies. It maintains the unread count and provides an interface for composing new messages, with functionality for logging in.                            |
| [SIPCredentialsContext.jsx]({file}) | This code handles the creation and management of SIP user credentials within a web app’s Context. It defines a React functional component that uses the built-in state and effect hooks to retrieve user's SIP credentials via an axios HTTP request whenever a user logs in. The retrieved credentials are then provided to child components through context, thus making it easily accessible globally.                                                                                                                                              |
| [LoginPage.css]({file})             | The code consists of CSS for styling a login page. It includes design attributes for a flexbox layout, color patterns, font styles, and responsive behaviors. It also defines styles for form elements like email and password fields, checkboxes, and drop-down lists. Moreover, the code specifies distinct visual designs for alert boxes displaying warnings, informational messages, and errors. The layout also includes a logo and a footer section.                                                                                            |
| [AuthContext.jsx]({file})           | The code defines an `AuthContext` utilizing React's Context API, providing user authentication management across the app. It leverages jwt-decode to validate tokens stored in local storage. If valid and not expired, it sets the user's login status, online state, and username. If invalid or expired, it removes the token and resets the login state. The `AuthProvider` component manages these states and effects, providing encapsulated authentication functions and state to its child components.                                         |
| [Profile.jsx]({file})               | The code represents a React component called 'Profile' serving the functionality of the user profile page. The component displays a user's first and last name, phone number, and avatar. It enables file selection for avatar changes, retrieves the user's data on component mount, and allows updating the user's data. If a user is not logged in, an access restriction message is displayed. User data is fetched and updated through API calls to the configured host and port.                                                                  |
| [ModalContext.jsx]({file})          | The given code is a React component that uses the TelnyxRTC web client to handle voice call operations in a contact center application. It manages state relevant to calls, such as client status, call state, dialed numbers, and device information. It provides methods to make, answer, decline, and hang up calls, handle hold and unhold actions, and manage a modal. Context API is used to provide these states and methods to child components. Notifications are handled to reflect call state changes.                                      |
| [PhonePage.jsx]({file})             | The given code represents a'PhonePage' component in a React application. It offers phone controls and displays agent and call queue dashboards. The component integrates with a backend using Axios and fetch for data exchange, WebSocket for real-time updates, and uses material UI for the user interface. It handles call-related actions like dialing, hanging up, hold, unhold, accept, transfer, and warm transfer. Context APIs are used to manage the state of SIP credentials, unread count, and modal functionalities.                     |
| [MessageQueue.jsx]({file})          | The code is a React component for'MessageQueue' for a contact center application. It fetches unassigned conversations from an API, listens for new conversations or assigned conversations via WebSockets, and updates the message queue and unread count accordingly. Furthermore, it provides a function to assign an unassigned conversation to a logged-in user. Messages are displayed in tabular format and if the user isn't logged in, they're requested to log in to view the queue.                                                          |
| [Theme.jsx]({file})                 | The code defines a theme for a web application using Material-UI library. It sets specific color schemes for primary, secondary, and text components and sets Inter, Arial, sans-serif as the typography. Besides, it customizes the style of table rows and cells and buttons, by adjusting borders, corner radius and text transformation. And finally, it sets a custom content width and spacing. The theme can then be utilized across the application for a consistent look and feel.                                                            |

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

<details closed><summary>Routes</summary>

| File                            | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---                             | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [websocket.js]({file})          | The code initializes and manages a WebSocket server using the Socket.IO library. It allows all CORS origins and listens for client connections, receiving messages from clients, or client disconnections. It also boasts error handling capabilities. An emit function broadcast is included, permitting server-side broadcasting of data to clients. The server states are exported for use in other code modules. Primarily, it enables real-time, bidirectional communication between the server and the client.                                                                                                                                                |
| [userRoutes.js]({file})         | The code represents an Express.js server, handling user-specific routes for a contact center application. It provides endpoints for user registration, encryption of SIP credentials, authentication, fetching a specific user and all agents, login/logout, and updating/deleting an agent. SIP connection creation is handled via the Telnyx API. It also offers an endpoint to fetch SIP credentials of an authenticated user. Agent statuses are updateable via a separate endpoint. The utility for generating random strings is used for SIP credential creation.                                                                                             |
| [voiceRoutes.js]({file})        | The code is defining a set of RESTful routes for a contact center application built with WebRTC. The routes are designed to handle a variety of VoIP functionality, such as handling inbound calls, adding calls to a queue, enabling agents to accept calls from the queue, initiating cold and warm transfers between agents, managing outbound calls made via WebRTC, and routings for a callback scenario. It interacts with the Telnyx API for call control operations and uses Express.js for routing, axios for HTTP requests and dotenv for environment configurations. All call information is stored and updated in a MySQL database using Sequelize ORM. |
| [conversationRoutes.js]({file}) | This JavaScript code defines an API for managing conversations in a contact center application. It handles creating, updating and querying conversations and messages, as well as assigning agents to conversations. There are APIs to compose and send a message, handle incoming messages and outgoing status updates via webhooks, fetch unassigned conversations, assign an agent to a conversation, and fetch all messages in a conversation. All message and conversation data are stored in a database.                                                                                                                                                      |

</details>

<details closed><summary>Models</summary>

| File                       | Summary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---                        | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [Conversations.js]({file}) | The provided code represents a part of a contact center application using WebRTC. It specifically sets up a 'Conversations' model with the Sequelize ORM for a Node.js server. This model is used to structure conversation data with fields like conversation_id, from_number, to_number etc. It also defines relationships with the'Messages' model-each Conversation can have many Messages, while each Message belongs to a specific Conversation.                                                                      |
| [Voice.js]({file})         | The provided code defines a'Voice' model in Sequelize for a contact center application. It specifies fields such as 'uuid', 'direction', 'telnyx_number', 'destination_number', 'queue_name', 'accept_agent', 'transfer_agent', 'bridge_uuid', 'queue_uuid', and 'conference_id', all of which can be null. The model connects to a database configured in '/config/database'. Additionally, there's an option to forcefully create a new'Voice' table based on the model's schema if it doesn't already exist.                     |
| [Messages.js]({file})      | The code describes the schema of a "Messages" model in a contact center application. This model, handled with Sequelize, manages attributes like unique ID, direction, type, originating and destination numbers, text body, media, tag, and conversation ID (foreign key). It forms a significant database configuration and interaction for handling messages within conversations.                                                                                                                                      |
| [User.js]({file})          | The code defines a User model in a Node.js application using the Sequelize ORM. The model has fields for the first name, last name, phone number, username, password, status, avatar, and SIP (Session Initiation Protocol) credentials. It represents users in a contact center that utilizes WebRTC for real-time communication, encapsulated by the directory structure including client (front-end) and server (back-end) codebases. Validation and uniqueness constraints are also described in the model definition. |

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

