# WebRTC Contact Center v2 - Documentation

This is a comprehensive WebRTC-based contact center application with real-time call management, queue handling, and agent dashboard capabilities.

## 📁 Project Structure

```
SE-webrtc-contact_center_v2/
├── client/          # React frontend application
├── server/          # Node.js Express backend
├── docs/           # Documentation (this folder)
├── package.json    # Root package.json for development scripts
└── README.md       # Main project readme
```

## 🚀 Quick Start

1. **Prerequisites Setup**: Follow [01-prerequisites.md](./01-prerequisites.md)
2. **Server Setup**: Follow [02-server-setup.md](./02-server-setup.md)
3. **Client Setup**: Follow [03-client-setup.md](./03-client-setup.md)
4. **Configuration**: Follow [04-configuration.md](./04-configuration.md)
5. **Deployment**: Follow [05-deployment.md](./05-deployment.md)

## 📚 Documentation Index

### Setup Guides
- [01-prerequisites.md](./01-prerequisites.md) - System requirements and dependencies
- [02-server-setup.md](./02-server-setup.md) - Backend server installation and configuration
- [03-client-setup.md](./03-client-setup.md) - Frontend React app setup
- [04-configuration.md](./04-configuration.md) - Environment configuration and API keys

### Architecture Documentation
- [06-architecture.md](./06-architecture.md) - System architecture overview
- [07-call-management.md](./07-call-management.md) - Call management system design
- [08-websocket-events.md](./08-websocket-events.md) - WebSocket event documentation
- [09-api-endpoints.md](./09-api-endpoints.md) - REST API documentation

### Deployment & Operations
- [05-deployment.md](./05-deployment.md) - Production deployment guide
- [10-troubleshooting.md](./10-troubleshooting.md) - Common issues and solutions
- [11-monitoring.md](./11-monitoring.md) - Monitoring and logging setup

### Development
- [12-development-workflow.md](./12-development-workflow.md) - Development best practices
- [13-testing.md](./13-testing.md) - Testing strategies and setup
- [14-contributing.md](./14-contributing.md) - How to contribute to the project

## 🎯 Key Features

### Call Management
- ✅ Real-time WebRTC calling
- ✅ Queue management with position tracking
- ✅ Call acceptance and routing
- ✅ Hold/unhold functionality
- ✅ Call transfer capabilities
- ✅ Remote hangup detection

### Agent Dashboard
- ✅ Live call queue display
- ✅ Agent availability status
- ✅ Call history tracking
- ✅ Performance metrics
- ✅ Real-time notifications

### Technical Features
- ✅ WebSocket-based real-time updates
- ✅ JWT authentication
- ✅ SQLite database storage
- ✅ Telnyx WebRTC integration
- ✅ Material-UI responsive design
- ✅ Event-driven architecture

## 🔧 Recent Improvements

- **Fixed Remote Hangup Detection**: Calls now properly close when remote party hangs up
- **Eliminated Polling**: Replaced polling with event-driven updates for better performance
- **Fixed Duplicate Calls**: Resolved issue where accepting calls created duplicate entries
- **Improved Error Handling**: Better network error handling and authentication flow
- **Code Cleanup**: Removed unused code and optimized bundle size

## 🆘 Need Help?

- Check [10-troubleshooting.md](./10-troubleshooting.md) for common issues
- Review the [architecture documentation](./06-architecture.md) to understand system design
- See [development workflow](./12-development-workflow.md) for development setup

## 📄 License

[Add your license information here]

## 🤝 Contributing

Please read [14-contributing.md](./14-contributing.md) for details on our code of conduct and the process for submitting pull requests.