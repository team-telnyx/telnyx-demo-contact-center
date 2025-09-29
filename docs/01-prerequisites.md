# Prerequisites

This document outlines all the system requirements and dependencies needed to run the WebRTC Contact Center v2 application.

## System Requirements

### Operating System
- **macOS**: 10.14+ (tested on macOS Sonoma)
- **Linux**: Ubuntu 18.04+ or equivalent
- **Windows**: Windows 10+ with WSL2 recommended

### Hardware Requirements
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: At least 2GB free space
- **Network**: Stable internet connection for WebRTC functionality

## Required Software

### 1. Node.js and npm
```bash
# Install Node.js 18+ (LTS recommended)
# Check version
node --version  # Should be v18.0.0+
npm --version   # Should be v9.0.0+

# If not installed, download from:
# https://nodejs.org/
```

### 2. Git
```bash
# Check if Git is installed
git --version

# Install Git if needed:
# macOS: xcode-select --install
# Ubuntu: sudo apt-get install git
# Windows: https://git-scm.com/download/win
```

### 3. SSL Certificates (for HTTPS)
The application requires SSL certificates for HTTPS operation:

```bash
# Generate self-signed certificates (development only)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Or use mkcert for local development (recommended)
# Install mkcert first: https://github.com/FiloSottile/mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

### 4. Web Browser (Development)
- **Chrome**: Version 88+ (recommended for WebRTC debugging)
- **Firefox**: Version 85+
- **Safari**: Version 14+
- **Edge**: Version 88+

## External Service Requirements

### 1. Telnyx Account
You'll need a Telnyx account for WebRTC functionality:

1. Sign up at [telnyx.com](https://telnyx.com)
2. Create a WebRTC application
3. Get your API credentials:
   - API Key
   - WebRTC Connection ID
   - Phone numbers (if using queue features)

### 2. Ngrok or Similar (for external access)
For external access during development:

```bash
# Install ngrok
npm install -g ngrok

# Or download from https://ngrok.com/
```

## Environment Setup

### 1. Create Project Directory
```bash
mkdir webrtc-contact-center
cd webrtc-contact-center
```

### 2. Clone Repository
```bash
git clone <repository-url> .
# or extract from provided source files
```

### 3. Verify Prerequisites
Run this command to check your setup:

```bash
# Check Node.js and npm
node --version && npm --version

# Check Git
git --version

# Check SSL certificates exist
ls -la *.pem

# Check if ports are available
lsof -ti:3001,3000,443,80 || echo "Ports available"
```

## Development Tools (Optional but Recommended)

### Code Editor
- **VS Code**: With extensions:
  - ES7+ React/Redux/React-Native snippets
  - Prettier
  - ESLint
  - Material-UI Snippets

### Browser Extensions
- **React Developer Tools**
- **Redux DevTools** (if using Redux)
- **WebRTC Internals** (chrome://webrtc-internals/)

### Database Tools
- **DB Browser for SQLite**: For inspecting the SQLite database
- **Postman**: For API testing

## Network Configuration

### Firewall Settings
Ensure these ports are accessible:
- **3000**: React development server
- **3001**: Production React app (if using custom port)
- **3002** (or configured): Node.js server
- **443**: HTTPS (production)
- **80**: HTTP redirect (production)

### DNS Configuration (Production)
If deploying to a custom domain:
```bash
# Example DNS records
A     yourdomain.com        -> YOUR_SERVER_IP
CNAME api.yourdomain.com    -> yourdomain.com
CNAME ws.yourdomain.com     -> yourdomain.com
```

## Verification Checklist

Before proceeding to installation, verify you have:

- [ ] Node.js 18+ installed
- [ ] npm 9+ available
- [ ] Git available
- [ ] SSL certificates generated
- [ ] Telnyx account created
- [ ] API credentials obtained
- [ ] Required ports available
- [ ] Internet connection stable
- [ ] Modern web browser installed

## Next Steps

Once all prerequisites are met:
1. Continue to [02-server-setup.md](./02-server-setup.md)
2. Then follow [03-client-setup.md](./03-client-setup.md)
3. Complete with [04-configuration.md](./04-configuration.md)

## Troubleshooting Prerequisites

### Node.js Issues
```bash
# Clear npm cache
npm cache clean --force

# Update npm
npm install -g npm@latest

# Use Node Version Manager (if issues persist)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### SSL Certificate Issues
```bash
# Verify certificate validity
openssl x509 -in cert.pem -text -noout

# Generate new certificates if expired
rm *.pem
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

### Port Conflicts
```bash
# Find what's using a port
lsof -ti:3001

# Kill process using port
kill -9 $(lsof -ti:3001)

# Use alternative ports in configuration
```

## Support

If you encounter issues with prerequisites:
1. Check the [troubleshooting guide](./10-troubleshooting.md)
2. Verify system compatibility
3. Ensure all dependencies are correctly installed
4. Check network connectivity and firewall settings