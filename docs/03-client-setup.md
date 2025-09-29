# Client Setup Guide

This guide covers setting up the React frontend application for the WebRTC Contact Center.

## Overview

The client is a React application that provides:
- Agent dashboard with call queue management
- Real-time WebRTC calling interface
- Call history and metrics
- SMS/messaging interface
- Responsive Material-UI design
- Real-time WebSocket updates

## Directory Structure

```
client/
├── package.json              # Client dependencies and scripts
├── public/                   # Static assets
│   ├── index.html           # Main HTML template
│   ├── favicon.ico          # App icon
│   └── manifest.json        # PWA manifest
├── src/                      # Source code
│   ├── index.js             # App entry point
│   ├── App.js               # Main app component
│   ├── components/          # React components
│   │   ├── AuthContext.jsx  # Authentication context
│   │   ├── PhonePage.jsx    # Main phone interface
│   │   ├── UniversalCallModal.jsx # Call modal
│   │   ├── MainContent.jsx  # Dashboard
│   │   └── ...              # Other components
│   ├── contexts/            # React contexts
│   │   └── CallManagerContext.jsx # Call management
│   ├── hooks/               # Custom React hooks
│   │   └── useLegacyModalContext.js
│   ├── services/            # API services
│   │   └── apiService.js    # HTTP API client
│   ├── utils/               # Utility functions
│   │   └── apiUtils.js      # API helper functions
│   └── styles/              # CSS and styling
├── .env                      # Environment configuration
├── cert.pem                 # SSL certificate
├── key.pem                  # SSL private key
└── node_modules/            # Dependencies (created after npm install)
```

## Installation Steps

### 1. Navigate to Client Directory
```bash
cd SE-webrtc-contact_center_v2/client
```

### 2. Install Dependencies
```bash
npm install
```

This will install key dependencies including:
- **react**: UI framework
- **@mui/material**: Material-UI components
- **socket.io-client**: WebSocket client
- **axios**: HTTP client
- **jwt-decode**: JWT token handling
- **@telnyx/webrtc**: Telnyx WebRTC SDK

### 3. Verify Package.json Scripts
The client's `package.json` should contain these scripts:
```json
{
  "scripts": {
    "start": "PORT=3001 react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### 4. SSL Certificate Setup
Copy SSL certificates to the client directory:
```bash
# Copy certificates from server or root directory
cp ../cert.pem ./
cp ../key.pem ./

# Or copy from server directory
cp ../server/cert.pem ./
cp ../server/key.pem ./

# Verify certificates exist
ls -la *.pem
```

### 5. Environment Configuration
Verify the `.env` file exists and contains:
```bash
cat .env
```

Expected content:
```env
# Client Environment Configuration
GENERATE_SOURCEMAP=false

# API Configuration - Use your domain/ngrok URL
REACT_APP_API_HOST=telnyx.solutions
REACT_APP_API_PORT=443
REACT_APP_HTTPS=true

# HTTPS Configuration for React Dev Server
HTTPS=true
SSL_CRT_FILE=cert.pem
SSL_KEY_FILE=key.pem

# Auto-open browser with ngrok URL
BROWSER=none
```

## Key Components Overview

### App Architecture
```
App.js
├── AuthContext (Authentication provider)
├── CallManagerContext (Call state management)
├── EnhancedModalContext (Modal management)
├── MainContent (Dashboard)
├── PhonePage (Call interface)
└── UniversalCallModal (Call modal)
```

### Core Components

#### 1. App.js
- Main application wrapper
- Routing setup
- Context providers
- Global layout

#### 2. AuthContext.jsx
- JWT token management
- User authentication state
- Login/logout functionality
- Token expiration handling

#### 3. CallManagerContext.jsx
- WebSocket connection management
- Call state management
- Queue call handling
- Event-driven updates

#### 4. PhonePage.jsx
- Main phone interface
- Dialer functionality
- Call queue display
- Agent dashboard

#### 5. UniversalCallModal.jsx
- Call modal interface
- Call controls (answer, hangup, hold)
- WebRTC call management
- Remote hangup detection

### API Integration

#### apiService.js
Centralized API client with:
- Automatic authentication headers
- 401 error handling and redirect
- Request/response interceptors
- Endpoint methods for all APIs

#### Key API Methods
```javascript
// Authentication
apiService.login(credentials)
apiService.register(userData)

// User management
apiService.getAgents()
apiService.updateProfile(data)

// Calls
apiService.acceptCall(callData)
apiService.hangupCall(callId)
apiService.getQueueData()

// Telnyx integration
apiService.getAgentsWithTag(tag)
```

## Starting the Client

### Development Mode
```bash
# Start development server with HTTPS
npm start

# This will start the server on https://localhost:3001
```

The development server will:
- Start on port 3001 with HTTPS
- Auto-reload on file changes
- Show build errors in browser
- Enable React DevTools

### Production Build
```bash
# Create production build
npm run build

# This creates a 'build' folder with optimized static files
```

### Serve Production Build
```bash
# Install serve globally
npm install -g serve

# Serve production build with HTTPS
serve -s build -l 3001 --ssl-cert cert.pem --ssl-key key.pem

# Or use a web server like nginx/apache
```

## Application Features

### Authentication Flow
1. User navigates to app
2. AuthContext checks for valid JWT token
3. If no token or expired, redirect to login
4. Login form calls `apiService.login()`
5. On success, token stored in localStorage
6. User redirected to main dashboard

### Call Management Flow
1. WebSocket connects to server
2. Server sends `NEW_CALL` event for incoming calls
3. CallManagerContext adds call to `incomingCalls` state
4. PhonePage displays call in queue table
5. User clicks "Accept" → calls `acceptQueueCall()`
6. Server processes acceptance → sends `CALL_ACCEPTED` event
7. CallManagerContext creates active call → opens UniversalCallModal
8. User can answer, hangup, hold, etc.

### Real-time Updates
The application uses WebSocket events for real-time updates:
- **NEW_CALL**: New incoming call
- **CALL_HANGUP**: Call ended
- **CALL_ACCEPTED**: Call accepted by agent
- **NEW_MESSAGE**: New SMS/message
- **AGENT_STATUS_UPDATED**: Agent availability changed

## Configuration Options

### Environment Variables
```env
# API Configuration
REACT_APP_API_HOST=your-domain.com     # Server hostname
REACT_APP_API_PORT=443                 # Server port
REACT_APP_HTTPS=true                   # Use HTTPS

# Development Server
HTTPS=true                             # Enable HTTPS for dev server
SSL_CRT_FILE=cert.pem                  # SSL certificate file
SSL_KEY_FILE=key.pem                   # SSL private key file
PORT=3001                              # Development server port

# Build Configuration
GENERATE_SOURCEMAP=false               # Disable source maps in production
BROWSER=none                           # Don't auto-open browser
```

### API Base URL Configuration
The app automatically determines the API URL:
```javascript
// In utils/apiUtils.js
export const getApiBaseUrl = () => {
  const protocol = getApiProtocol();
  return `${protocol}://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`;
};
```

## Testing the Client

### Development Testing
```bash
# Start development server
npm start

# Open browser to https://localhost:3001
# You should see the login page
```

### Build Testing
```bash
# Create production build
npm run build

# Check build size
du -sh build/

# Test production build locally
serve -s build -l 3001 --ssl-cert cert.pem --ssl-key key.pem
```

### Feature Testing
1. **Authentication**:
   - Navigate to login page
   - Enter valid credentials
   - Verify redirect to dashboard

2. **Call Queue**:
   - Check queue table loads
   - Verify real-time updates
   - Test call acceptance

3. **WebRTC Calling**:
   - Test outbound calls
   - Verify call modal opens
   - Test call controls

## Troubleshooting

### Common Issues

#### SSL Certificate Errors
```bash
# Verify certificates exist
ls -la *.pem

# Check certificate validity
openssl x509 -in cert.pem -text -noout | grep -A 2 "Validity"

# Regenerate if expired
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

#### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear React cache
rm -rf .cache

# Check for dependency conflicts
npm ls
```

#### WebSocket Connection Issues
```bash
# Test WebSocket connection manually
# In browser console:
const socket = io('https://localhost:3002');
socket.on('connect', () => console.log('Connected'));
```

#### API Connection Issues
```bash
# Test API connectivity
curl -k https://localhost:3002/api/users/agents

# Check CORS settings on server
# Verify server allows origin: https://localhost:3001
```

### Performance Issues

#### Large Bundle Size
```bash
# Analyze bundle size
npm install -g webpack-bundle-analyzer
npx webpack-bundle-analyzer build/static/js/*.js

# Code splitting (already implemented)
const LazyComponent = React.lazy(() => import('./Component'));
```

#### Slow Development Server
```bash
# Disable source maps for faster builds
echo "GENERATE_SOURCEMAP=false" >> .env

# Increase memory limit
export NODE_OPTIONS="--max_old_space_size=4096"
npm start
```

## Browser Compatibility

### Supported Browsers
- **Chrome**: 88+ (recommended for WebRTC)
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

### WebRTC Requirements
- Secure context (HTTPS) required
- Microphone permissions needed
- Modern WebRTC API support

### Testing Across Browsers
```bash
# Test in multiple browsers
open -a "Google Chrome" https://localhost:3001
open -a "Firefox" https://localhost:3001
open -a "Safari" https://localhost:3001
```

## Development Workflow

### Hot Reloading
- Changes to components automatically reload
- State is preserved where possible
- CSS changes apply immediately

### Debugging
- React DevTools for component inspection
- Browser DevTools for network/WebSocket
- Chrome WebRTC internals: `chrome://webrtc-internals/`

### Code Quality
```bash
# Run tests
npm test

# Lint code (if configured)
npm run lint

# Format code (if prettier configured)
npm run format
```

## Performance Optimization

### Code Splitting
Components are lazy-loaded where appropriate:
```javascript
const LazyComponent = React.lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>
```

### Caching
- API responses cached where appropriate
- Static assets cached by browser
- Service worker for offline capability (if configured)

### Bundle Optimization
```bash
# Production build optimizations
npm run build

# Minification, tree shaking, and compression applied automatically
```

## Next Steps

Once the client is running successfully:
1. Complete configuration in [04-configuration.md](./04-configuration.md)
2. Test integration with the server
3. Review [06-architecture.md](./06-architecture.md) for system understanding
4. Check [10-troubleshooting.md](./10-troubleshooting.md) for common issues

The client should now be accessible at `https://localhost:3001` with full functionality for call management, agent dashboard, and real-time communication.