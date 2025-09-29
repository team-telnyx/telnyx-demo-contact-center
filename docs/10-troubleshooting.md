# Troubleshooting Guide

This guide covers common issues you might encounter with the WebRTC Contact Center application and their solutions.

## Quick Diagnostics

### System Health Check
```bash
# Run this script to check overall system health
#!/bin/bash
echo "=== WebRTC Contact Center Health Check ==="

# Check Node.js version
echo "Node.js version:"
node --version || echo "❌ Node.js not installed"

# Check npm version
echo "npm version:"
npm --version || echo "❌ npm not installed"

# Check if certificates exist
echo "SSL Certificates:"
ls -la *.pem 2>/dev/null || echo "❌ SSL certificates missing"

# Check if server is running
echo "Server status:"
curl -k -s https://localhost:3002/api/health >/dev/null && echo "✅ Server running" || echo "❌ Server not responding"

# Check if client is accessible
echo "Client status:"
curl -k -s https://localhost:3001 >/dev/null && echo "✅ Client accessible" || echo "❌ Client not accessible"

# Check database
echo "Database status:"
ls -la database.sqlite 2>/dev/null && echo "✅ Database file exists" || echo "❌ Database file missing"

# Check ports
echo "Port availability:"
lsof -ti:3001,3002 && echo "✅ Required ports in use" || echo "❌ Ports not in use"

echo "=== Health Check Complete ==="
```

## Common Issues and Solutions

### 1. Server Issues

#### Server Won't Start

**Symptoms:**
- Error: `EADDRINUSE: address already in use`
- Error: `ENOENT: no such file or directory, open 'cert.pem'`
- Error: `Cannot find module`

**Solutions:**

```bash
# Port already in use
lsof -ti:3002 | xargs kill -9
# Or use different port
PORT=3003 npm start

# SSL certificate missing
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Missing dependencies
cd server
npm install

# Permission issues
sudo chown -R $USER:$USER .
chmod 644 *.pem
```

#### Database Errors

**Symptoms:**
- `SQLITE_CANTOPEN: unable to open database file`
- `SQLITE_CORRUPT: database disk image is malformed`
- `no such table: users`

**Solutions:**

```bash
# Fix database permissions
chmod 644 database.sqlite
chown $USER:$USER database.sqlite

# Restore from backup
cp backup_*.sqlite database.sqlite

# Recreate database
rm database.sqlite
# Restart server to recreate tables

# Check database integrity
sqlite3 database.sqlite "PRAGMA integrity_check;"

# Repair corrupt database
sqlite3 database.sqlite ".dump" | sqlite3 database_new.sqlite
mv database_new.sqlite database.sqlite
```

#### Memory/Performance Issues

**Symptoms:**
- Server crashes with `JavaScript heap out of memory`
- Slow response times
- High CPU usage

**Solutions:**

```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 server.js

# Monitor memory usage
top -p $(pgrep node)
htop -p $(pgrep node)

# Check for memory leaks
node --inspect server.js
# Open chrome://inspect

# Add process monitoring
npm install -g pm2
pm2 start server.js --name contact-center --max-memory-restart 1G
```

### 2. Client Issues

#### Client Won't Load

**Symptoms:**
- White screen in browser
- `Failed to load resource` errors
- `net::ERR_CERT_INVALID`

**Solutions:**

```bash
# SSL certificate issues
# Accept self-signed certificate in browser
# Or regenerate certificate with correct CN
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"

# Clear browser cache
# Chrome: Ctrl+Shift+Del
# Firefox: Ctrl+Shift+Del
# Safari: Cmd+Option+E

# Check React build
cd client
npm run build
serve -s build

# Dependencies issues
rm -rf node_modules package-lock.json
npm install
```

#### API Connection Errors

**Symptoms:**
- `Network Error` in console
- `401 Unauthorized` errors
- `CORS policy` errors

**Solutions:**

```bash
# Check API endpoint configuration
grep -r "REACT_APP_API" client/.env

# Test API connectivity
curl -k https://localhost:3002/api/health

# Check CORS settings in server
# Ensure client domain is in CORS whitelist

# Clear localStorage
# In browser console:
localStorage.clear()
sessionStorage.clear()

# Check network tab in browser DevTools
# Verify request URLs and response codes
```

### 3. WebRTC Issues

#### Calls Not Connecting

**Symptoms:**
- Call modal opens but no audio
- `Failed to establish media connection`
- `ICE connection failed`

**Solutions:**

```bash
# Check browser permissions
# Allow microphone access in browser settings

# Test WebRTC in browser
# Go to chrome://webrtc-internals/
# Check for ICE connection failures

# Firewall/NAT issues
# Ensure UDP ports are open for WebRTC
# Configure STUN/TURN servers if behind NAT

# Check Telnyx credentials
curl -H "Authorization: Bearer $TELNYX_API_KEY" \
  https://api.telnyx.com/v2/connections

# Test microphone
# In browser console:
navigator.mediaDevices.getUserMedia({audio: true})
  .then(stream => console.log('Mic access OK'))
  .catch(err => console.error('Mic access failed:', err))
```

#### Remote Hangup Detection Not Working

**Symptoms:**
- Modal doesn't close when remote party hangs up
- Call state doesn't update after hangup

**Solutions:**

```bash
# Check WebSocket events
# In browser console:
const socket = io();
socket.on('CALL_HANGUP', (data) => console.log('Hangup event:', data));

# Verify WebSocket connection
socket.connected // should be true

# Check server WebSocket handling
# Look for CALL_HANGUP event broadcasts in server logs

# Restart WebSocket connection
socket.disconnect();
socket.connect();
```

### 4. Authentication Issues

#### Login Problems

**Symptoms:**
- `Invalid credentials` error
- Infinite login loop
- Token expired errors

**Solutions:**

```bash
# Check user exists in database
sqlite3 database.sqlite "SELECT * FROM users WHERE username='testuser';"

# Reset user password
sqlite3 database.sqlite "UPDATE users SET password='$2b$12$...' WHERE username='testuser';"

# Check JWT secret consistency
grep JWT_SECRET server/.env client/.env

# Clear stored tokens
# In browser console:
localStorage.removeItem('token')

# Verify JWT token
# In browser console:
const token = localStorage.getItem('token');
console.log(JSON.parse(atob(token.split('.')[1])));
```

#### Authorization Failures

**Symptoms:**
- `403 Forbidden` errors
- Missing API permissions
- Role-based access denied

**Solutions:**

```bash
# Check user role in database
sqlite3 database.sqlite "SELECT username, role FROM users;"

# Update user role
sqlite3 database.sqlite "UPDATE users SET role='admin' WHERE username='testuser';"

# Verify JWT payload includes role
# Check token in browser DevTools Application tab

# Test API with valid token
curl -k -H "Authorization: Bearer $TOKEN" \
  https://localhost:3002/api/users/profile
```

### 5. WebSocket Issues

#### Connection Problems

**Symptoms:**
- Real-time updates not working
- `WebSocket connection failed`
- Constant reconnection attempts

**Solutions:**

```bash
# Check WebSocket URL
# In browser console:
console.log(window.location.protocol === 'https:' ? 'wss:' : 'ws:' + '//localhost:3002');

# Test WebSocket connection manually
# In browser console:
const ws = new WebSocket('wss://localhost:3002');
ws.onopen = () => console.log('WS connected');
ws.onerror = (err) => console.error('WS error:', err);

# Check server WebSocket logs
# Should see connection/disconnection messages

# Firewall/proxy issues
# Ensure WebSocket upgrade is allowed
# Check nginx WebSocket proxy configuration
```

#### Event Broadcasting Issues

**Symptoms:**
- Events not reaching all clients
- Delayed event delivery
- Missing event data

**Solutions:**

```bash
# Check event emission in server logs
# Should see broadcast messages for each event

# Verify client event listeners
# In browser console:
socket.eventNames() // List all registered events

# Test event broadcasting
# In one browser:
socket.emit('test_event', {data: 'test'});
# In another browser:
socket.on('test_event', (data) => console.log('Received:', data));

# Check socket.io version compatibility
npm list socket.io
npm list socket.io-client
```

### 6. Telnyx Integration Issues

#### API Authentication

**Symptoms:**
- `401 Unauthorized` from Telnyx API
- `Invalid API key` errors
- Webhook delivery failures

**Solutions:**

```bash
# Test Telnyx API key
curl -H "Authorization: Bearer $TELNYX_API_KEY" \
  https://api.telnyx.com/v2/phone_numbers

# Check webhook configuration
curl -H "Authorization: Bearer $TELNYX_API_KEY" \
  https://api.telnyx.com/v2/connections

# Verify webhook URL accessibility
curl -X POST https://yourdomain.com/api/telnyx/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Check Telnyx dashboard for webhook errors
```

#### WebRTC SDK Issues

**Symptoms:**
- SDK initialization failures
- Connection timeouts
- Audio quality issues

**Solutions:**

```bash
# Check SDK version
npm list @telnyx/webrtc

# Update SDK
npm update @telnyx/webrtc

# Test SDK initialization
# In browser console:
import { TelnyxRTC } from '@telnyx/webrtc';
const client = new TelnyxRTC({
  api_token: 'your_token',
  connection_id: 'your_connection_id'
});

# Check browser compatibility
# Modern browsers with WebRTC support required

# Audio device issues
navigator.mediaDevices.enumerateDevices()
  .then(devices => console.log(devices.filter(d => d.kind === 'audioinput')));
```

## Performance Troubleshooting

### High Memory Usage

**Symptoms:**
- Gradual memory increase
- Eventual crashes
- Slow performance

**Diagnostics:**
```bash
# Monitor memory usage
while true; do
  ps aux | grep node | grep -v grep
  sleep 5
done

# Check for memory leaks
node --inspect --inspect-port=9229 server.js
# Open chrome://inspect and take heap snapshots

# Database connection leaks
sqlite3 database.sqlite "PRAGMA compile_options;" | grep THREADSAFE
```

**Solutions:**
```bash
# Implement connection pooling
# Add garbage collection hints
# Set memory limits
node --max-old-space-size=2048 server.js

# Use PM2 for automatic restarts
pm2 start server.js --max-memory-restart 1G
```

### High CPU Usage

**Symptoms:**
- Server unresponsive
- High system load
- Slow API responses

**Diagnostics:**
```bash
# Profile CPU usage
node --prof server.js
# Generate profile: node --prof-process isolate-*.log

# Check for infinite loops
# Use browser DevTools Performance tab

# Database query performance
sqlite3 database.sqlite "EXPLAIN QUERY PLAN SELECT * FROM calls WHERE agent_id = 1;"
```

**Solutions:**
```bash
# Add database indexes
sqlite3 database.sqlite "CREATE INDEX idx_calls_agent_id ON calls(agent_id);"

# Optimize queries
# Use LIMIT clauses
# Add WHERE conditions

# Implement caching
# Use Redis for session storage
# Cache API responses
```

## Environment-Specific Issues

### Development Environment

**Common Issues:**
- Hot reload not working
- SSL certificate warnings
- CORS errors during development

**Solutions:**
```bash
# React hot reload
echo "FAST_REFRESH=true" >> client/.env

# SSL certificate trust
# macOS: Add cert.pem to Keychain Access
# Linux: Add cert.pem to ca-certificates

# CORS in development
# Add localhost to server CORS whitelist
# Use --disable-web-security flag (Chrome, not recommended)
```

### Production Environment

**Common Issues:**
- SSL certificate expiration
- Database backup failures
- High traffic loads

**Solutions:**
```bash
# Certificate monitoring
echo "0 2 * * * certbot renew --quiet" | crontab -

# Database backups
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp database.sqlite "backups/database_$DATE.sqlite"
find backups/ -name "*.sqlite" -mtime +7 -delete

# Load balancing
# Use nginx upstream configuration
# Implement health checks
# Scale horizontally with multiple instances
```

## Monitoring and Alerting

### Log Analysis

**View Logs:**
```bash
# Server logs
tail -f server.log
grep ERROR server.log

# System logs
journalctl -u your-service-name -f

# PM2 logs
pm2 logs contact-center

# Database logs
sqlite3 database.sqlite ".log stderr" ".read your_query.sql"
```

**Log Patterns to Watch:**
- Authentication failures
- Database connection errors
- WebSocket disconnections
- API rate limiting
- SSL certificate errors

### Health Monitoring

**Create Health Check Script:**
```bash
#!/bin/bash
HEALTH_URL="https://localhost:3002/api/health"
WEBHOOK_URL="your_alert_webhook"

response=$(curl -k -s -w "%{http_code}" -o /dev/null "$HEALTH_URL")

if [ "$response" != "200" ]; then
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\": \"🚨 Contact Center Health Check Failed: HTTP $response\"}"
fi
```

**Set Up Monitoring:**
```bash
# Add to crontab
echo "*/5 * * * * /path/to/health-check.sh" | crontab -

# Or use systemd timer
sudo systemctl enable --now health-check.timer
```

## Emergency Procedures

### Service Recovery

**Quick Restart:**
```bash
# Stop services
pm2 stop all
# or
pkill -f node

# Restart services
cd server && npm start &
cd client && npm start &

# Or with PM2
pm2 restart all
```

**Database Recovery:**
```bash
# If database is corrupted
mv database.sqlite database.sqlite.bak
cp backup_latest.sqlite database.sqlite
# Restart server
```

**SSL Certificate Emergency:**
```bash
# Generate temporary self-signed cert
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 1 -nodes -subj "/CN=localhost"

# Or disable HTTPS temporarily (not recommended for production)
# Set REACT_APP_HTTPS=false in client/.env
# Remove HTTPS configuration in server.js
```

## Getting Help

### Debug Information to Collect

When reporting issues, include:

1. **System Information:**
   ```bash
   node --version
   npm --version
   uname -a
   ```

2. **Application Logs:**
   ```bash
   tail -100 server.log
   tail -100 error.log
   ```

3. **Browser Information:**
   - Browser version
   - Console errors (F12 → Console)
   - Network tab errors (F12 → Network)

4. **Configuration:**
   ```bash
   cat client/.env (remove secrets)
   cat server/.env (remove secrets)
   ```

5. **Database State:**
   ```bash
   sqlite3 database.sqlite "SELECT COUNT(*) FROM users;"
   sqlite3 database.sqlite "SELECT COUNT(*) FROM calls;"
   ```

### Support Channels

1. Check existing documentation
2. Search through application logs
3. Review [architecture documentation](./06-architecture.md)
4. Check GitHub issues (if applicable)
5. Contact system administrator

## Prevention

### Best Practices

1. **Regular Backups:**
   - Database backups every 6 hours
   - Configuration file backups
   - SSL certificate backups

2. **Monitoring:**
   - Set up health checks
   - Monitor disk space
   - Track memory/CPU usage
   - SSL certificate expiration alerts

3. **Updates:**
   - Regular dependency updates
   - Security patches
   - SSL certificate renewal
   - Database maintenance

4. **Testing:**
   - Test backups regularly
   - Validate SSL certificates
   - Check API endpoints
   - Verify WebRTC functionality

This troubleshooting guide should help you quickly identify and resolve most common issues with the WebRTC Contact Center application.