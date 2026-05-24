# Telnyx Contact Center — Deployment Guide

## Quick Start (Docker)

```bash
# 1. Clone and enter the repo
cd contact-center

# 2. Create your .env from the example
cp .env.production.example .env
nano .env  # Fill in all required values

# 3. Build and start
docker compose up -d

# 4. Check health
curl http://localhost:3001/health

# 5. Run database migrations (first time only)
docker compose exec app node server/scripts/migrate.js
```

## Deploy to EC2

### Prerequisites
- EC2 instance (t3.medium recommended) with Docker + Docker Compose
- Security group: open ports 80, 443 (and 3001 if no nginx)
- Domain pointing to the instance (for HTTPS/webhooks)

### Steps

```bash
# SSH into your EC2 instance
ssh ubuntu@your-instance

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# Clone the repo
git clone <your-repo-url> contact-center
cd contact-center

# Set up environment
cp .env.production.example .env
nano .env

# Build and run
docker compose up -d --build

# Run migrations
docker compose exec app node server/scripts/migrate.js
```

### HTTPS Setup (required for Telnyx webhooks)

**Option A: Let's Encrypt with nginx**
1. Uncomment the `nginx` service in `docker-compose.yml`
2. Install certbot: `sudo apt install certbot`
3. Get certs: `sudo certbot certonly --standalone -d yourdomain.com`
4. Copy certs to `./nginx/certs/`
5. `docker compose up -d`

**Option B: CloudFlare tunnel (easiest)**
1. `cloudflared tunnel login`
2. `cloudflared tunnel create cc`
3. Route `cc.yourdomain.com` → `http://localhost:3001`
4. Set `PUBLIC_URL=https://cc.yourdomain.com` in `.env`

**Option C: AWS ALB**
1. Create an ALB with HTTPS listener
2. Target group → port 3001 on your EC2 instance
3. Set `PUBLIC_URL=https://cc.yourdomain.com` in `.env`

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TELNYX_API_KEY` | ✅ | Telnyx API key |
| `TELNYX_PUBLIC_KEY` | ✅ | Ed25519 key for webhook verification |
| `TELNYX_APP_CONNECTION_ID` | ✅ | Voice App connection ID |
| `TELNYX_SIP_CONNECTION_ID` | ✅ | SIP Credential connection ID |
| `TELNYX_SIP_USERNAME` | ✅ | SIP username |
| `TELNYX_SIP_PASSWORD` | ✅ | SIP password |
| `JWT_SECRET` | ✅ | Min 32 chars (`openssl rand -base64 48`) |
| `ENCRYPTION_KEY` | ✅ | `openssl rand -base64 32` |
| `PUBLIC_URL` | ✅ | HTTPS URL reachable by Telnyx |
| `DB_PASSWORD` | ✅ | PostgreSQL password |
| `COMPANY_NAME` | ❌ | Display name (default: "Telnyx Contact Center") |

## Useful Commands

```bash
# View logs
docker compose logs -f app

# Restart after .env change
docker compose up -d --force-recreate

# Database shell
docker compose exec db psql -U cc -d contact_center

# Rebuild after code change
docker compose up -d --build
```
