# Deployment Guide

This guide covers deploying the WebRTC Contact Center application to production environments, including cloud platforms, VPS, and containerized deployments.

## Deployment Overview

The application consists of:
- **Frontend**: React SPA that can be served statically
- **Backend**: Node.js Express server with WebSocket support
- **Database**: SQLite (file-based, no separate server needed)
- **SSL**: Required for WebRTC functionality

## Pre-Deployment Checklist

### Security Checklist
- [ ] Valid SSL certificates obtained
- [ ] JWT secret key generated (strong, unique)
- [ ] Database file permissions secured
- [ ] Environment variables configured
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting configured
- [ ] Security headers enabled
- [ ] Default credentials changed
- [ ] Telnyx webhooks secured

### Performance Checklist
- [ ] Frontend optimized build created
- [ ] Database indexes added
- [ ] Compression enabled
- [ ] Static asset caching configured
- [ ] Health check endpoints implemented
- [ ] Log rotation configured
- [ ] Monitoring setup prepared

## Production Environment Setup

### 1. Server Requirements

**Minimum Specifications:**
- **CPU**: 2 cores
- **RAM**: 2GB
- **Storage**: 20GB SSD
- **Network**: 100 Mbps
- **OS**: Ubuntu 20.04 LTS or similar

**Recommended Specifications:**
- **CPU**: 4+ cores
- **RAM**: 4GB+
- **Storage**: 50GB+ SSD
- **Network**: 1 Gbps
- **OS**: Ubuntu 22.04 LTS

### 2. System Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install build tools
sudo apt-get install -y build-essential

# Install process manager
sudo npm install -g pm2

# Install nginx (reverse proxy)
sudo apt-get install -y nginx

# Install SSL tools
sudo apt-get install -y certbot python3-certbot-nginx

# Install monitoring tools
sudo apt-get install -y htop iotop nethogs
```

## Deployment Methods

### Method 1: Traditional Server Deployment

#### 1.1 Server Setup

```bash
# Create application user
sudo useradd -m -s /bin/bash webapp
sudo mkdir -p /opt/contact-center
sudo chown webapp:webapp /opt/contact-center

# Switch to app user
sudo su - webapp

# Clone or upload application
cd /opt/contact-center
# Upload your application files here
```

#### 1.2 Environment Configuration

```bash
# Server environment
cat > /opt/contact-center/server/.env << EOF
NODE_ENV=production
PORT=3002

# Database
DB_PATH=/opt/contact-center/data/database.sqlite

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h

# Telnyx Configuration
TELNYX_API_KEY=your_actual_telnyx_api_key
TELNYX_APP_ID=your_telnyx_app_id
TELNYX_PHONE_NUMBER=+1234567890

# SSL Configuration
SSL_CERT_PATH=/opt/contact-center/ssl/cert.pem
SSL_KEY_PATH=/opt/contact-center/ssl/key.pem

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF

# Client environment
cat > /opt/contact-center/client/.env << EOF
GENERATE_SOURCEMAP=false
REACT_APP_API_HOST=yourdomain.com
REACT_APP_API_PORT=443
REACT_APP_HTTPS=true
EOF
```

#### 1.3 SSL Certificate Setup

```bash
# Create SSL directory
sudo mkdir -p /opt/contact-center/ssl
sudo chown webapp:webapp /opt/contact-center/ssl

# Option 1: Let's Encrypt (Recommended)
sudo certbot certonly --nginx -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /opt/contact-center/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /opt/contact-center/ssl/key.pem
sudo chown webapp:webapp /opt/contact-center/ssl/*.pem

# Option 2: Commercial SSL Certificate
# Upload your SSL certificate files to /opt/contact-center/ssl/
# Ensure correct permissions: chmod 644 cert.pem && chmod 600 key.pem
```

#### 1.4 Application Installation

```bash
# Install dependencies
cd /opt/contact-center/server
npm ci --only=production

cd /opt/contact-center/client
npm ci --only=production

# Build frontend
npm run build

# Create data directory
mkdir -p /opt/contact-center/data
```

#### 1.5 PM2 Process Management

```bash
# Create PM2 ecosystem file
cat > /opt/contact-center/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'contact-center-api',
    script: '/opt/contact-center/server/server.js',
    cwd: '/opt/contact-center/server',
    instances: 1,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: '/opt/contact-center/logs/api-error.log',
    out_file: '/opt/contact-center/logs/api-out.log',
    log_file: '/opt/contact-center/logs/api-combined.log',
    time: true,
    merge_logs: true
  }]
}
EOF

# Create logs directory
mkdir -p /opt/contact-center/logs

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the displayed instructions to run as root
```

#### 1.6 Nginx Configuration

```bash
# Create nginx configuration
sudo tee /etc/nginx/sites-available/contact-center << EOF
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /opt/contact-center/ssl/cert.pem;
    ssl_certificate_key /opt/contact-center/ssl/key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 10m;
    ssl_session_cache shared:SSL:10m;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Frontend (React app)
    location / {
        root /opt/contact-center/client/build;
        try_files \$uri \$uri/ /index.html;

        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API routes
    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/contact-center /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Method 2: Docker Deployment

#### 2.1 Create Dockerfiles

**Server Dockerfile:**
```dockerfile
# /server/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S nodejs
RUN adduser -S webapp -u 1001

WORKDIR /app

COPY --from=builder --chown=webapp:nodejs /app/node_modules ./node_modules
COPY --chown=webapp:nodejs . .

USER webapp

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]
```

**Client Dockerfile:**
```dockerfile
# /client/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
```

#### 2.2 Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: contact-center-api
    restart: unless-stopped
    ports:
      - "3002:3002"
    environment:
      NODE_ENV: production
      DB_PATH: /app/data/database.sqlite
      JWT_SECRET: ${JWT_SECRET}
      TELNYX_API_KEY: ${TELNYX_API_KEY}
      TELNYX_APP_ID: ${TELNYX_APP_ID}
    volumes:
      - ./data:/app/data
      - ./ssl:/app/ssl:ro
      - ./logs:/app/logs
    depends_on:
      - db-backup
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  web:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: contact-center-web
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3

  db-backup:
    image: alpine:latest
    container_name: contact-center-backup
    restart: unless-stopped
    volumes:
      - ./data:/data
      - ./backups:/backups
    command: >
      sh -c "
        while true; do
          sleep 21600;  # 6 hours
          cp /data/database.sqlite /backups/database_\$$(date +%Y%m%d_%H%M%S).sqlite;
          find /backups -name 'database_*.sqlite' -mtime +7 -delete;
        done
      "

volumes:
  data:
  logs:
  backups:

networks:
  default:
    name: contact-center
```

#### 2.3 Environment Configuration

```bash
# Create .env file for docker-compose
cat > .env << EOF
JWT_SECRET=$(openssl rand -base64 32)
TELNYX_API_KEY=your_actual_telnyx_api_key
TELNYX_APP_ID=your_telnyx_app_id
COMPOSE_PROJECT_NAME=contact-center
EOF

# Create required directories
mkdir -p data logs backups ssl

# Copy SSL certificates
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem

# Deploy
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### Method 3: Cloud Platform Deployment

#### 3.1 AWS Deployment

**Using Elastic Beanstalk:**

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
eb init contact-center

# Create environment
eb create production

# Configure environment variables
eb setenv NODE_ENV=production JWT_SECRET=your_secret TELNYX_API_KEY=your_key

# Deploy
eb deploy

# Configure HTTPS
# Add SSL certificate in EB console
# Configure load balancer for WebSocket support
```

**Using EC2 + RDS:**

```bash
# Launch EC2 instance
# Install dependencies (same as traditional method)
# Use RDS PostgreSQL instead of SQLite for scalability

# Security group configuration
# Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
# Allow WebSocket connections
```

#### 3.2 Google Cloud Platform

**Using App Engine:**

```yaml
# app.yaml
runtime: nodejs18

env_variables:
  NODE_ENV: production
  JWT_SECRET: your_secret
  TELNYX_API_KEY: your_key

automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6

handlers:
  - url: /.*
    script: auto
    secure: always
```

```bash
# Deploy
gcloud app deploy app.yaml
```

#### 3.3 DigitalOcean App Platform

```yaml
# .do/app.yaml
name: contact-center
services:
- name: api
  source_dir: server
  github:
    repo: your-username/contact-center
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  env:
  - key: NODE_ENV
    value: production
  - key: JWT_SECRET
    value: your_secret
  - key: TELNYX_API_KEY
    value: your_key

- name: web
  source_dir: client
  github:
    repo: your-username/contact-center
    branch: main
  run_command: npm run build && serve -s build
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
```

## Database Migration

### SQLite to PostgreSQL (for scaling)

```javascript
// migration script
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');

const migrateData = async () => {
  const sqliteDb = new sqlite3.Database('./database.sqlite');
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  // Create tables in PostgreSQL
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      "firstName" VARCHAR(255),
      "lastName" VARCHAR(255),
      role VARCHAR(50) DEFAULT 'agent',
      status BOOLEAN DEFAULT true,
      phone VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate users
  sqliteDb.all("SELECT * FROM users", async (err, rows) => {
    for (const row of rows) {
      await pgPool.query(
        'INSERT INTO users (username, email, password, "firstName", "lastName", role, status, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [row.username, row.email, row.password, row.firstName, row.lastName, row.role, row.status, row.phone]
      );
    }
  });

  // Repeat for other tables...
};
```

## Monitoring and Maintenance

### 1. Log Management

```bash
# Setup log rotation
sudo tee /etc/logrotate.d/contact-center << EOF
/opt/contact-center/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    postrotate
        pm2 reload contact-center-api
    endscript
}
EOF
```

### 2. Database Backup

```bash
# Create backup script
cat > /opt/contact-center/scripts/backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/opt/contact-center/backups"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup database
cp /opt/contact-center/data/database.sqlite "\$BACKUP_DIR/database_\$DATE.sqlite"

# Compress and upload to cloud storage (optional)
tar -czf "\$BACKUP_DIR/backup_\$DATE.tar.gz" -C /opt/contact-center data ssl

# Clean old backups
find \$BACKUP_DIR -name "*.sqlite" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
EOF

chmod +x /opt/contact-center/scripts/backup.sh

# Schedule backup
echo "0 */6 * * * /opt/contact-center/scripts/backup.sh" | crontab -
```

### 3. Health Monitoring

```javascript
// healthcheck.js
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.on('error', (err) => {
  process.exit(1);
});

req.end();
```

### 4. SSL Certificate Auto-renewal

```bash
# Add to crontab
echo "0 2 * * * certbot renew --quiet --post-hook 'systemctl reload nginx && pm2 reload all'" | crontab -
```

## Performance Optimization

### 1. Frontend Optimization

```bash
# Build with optimizations
cd client
GENERATE_SOURCEMAP=false npm run build

# Serve with compression
# Already handled by nginx configuration
```

### 2. Backend Optimization

```javascript
// server.js additions
const compression = require('compression');
const helmet = require('helmet');

app.use(compression());
app.use(helmet());

// Connection pooling for database
// Enable keep-alive
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});
```

### 3. Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_calls_agent_created ON calls(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Analyze query performance
EXPLAIN QUERY PLAN SELECT * FROM calls WHERE agent_id = 1 ORDER BY created_at DESC LIMIT 10;
```

## Security Hardening

### 1. Firewall Configuration

```bash
# UFW firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. System Hardening

```bash
# Update system regularly
sudo apt update && sudo apt upgrade -y

# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart ssh

# Setup fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 3. Application Security

```javascript
// Additional security middleware
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

## Deployment Verification

### Post-Deployment Checklist

- [ ] Application accessible via HTTPS
- [ ] SSL certificate valid and trusted
- [ ] API endpoints responding correctly
- [ ] WebSocket connections working
- [ ] WebRTC calls connecting
- [ ] Database operations functioning
- [ ] Authentication system working
- [ ] Error pages displaying correctly
- [ ] Performance metrics acceptable
- [ ] Monitoring alerts configured
- [ ] Backup system functional
- [ ] Log rotation working

### Testing Commands

```bash
# Test HTTPS
curl -I https://yourdomain.com

# Test API
curl -k https://yourdomain.com/api/health

# Test WebSocket
wscat -c wss://yourdomain.com/socket.io/

# Load testing
ab -n 100 -c 10 https://yourdomain.com/

# SSL testing
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

This deployment guide provides comprehensive instructions for getting your WebRTC Contact Center application running in production with proper security, monitoring, and maintenance procedures.