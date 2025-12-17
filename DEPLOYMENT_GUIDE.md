# Cloudflare Deployment Playbook

This single guide replaces the legacy `CLOUDFLARE_*.md`, `DEPLOYMENT_STATUS.md`, `DNS-SETUP-INSTRUCTIONS.md`, `FINAL_DEPLOYMENT_STEPS.md`, `MIGRATION_CHECKLIST.md`, and `PRISMA_SETUP.md` documents.

## 1. Architecture & Prerequisites

| Layer | Stack | Notes |
| ----- | ----- | ----- |
| Frontend | Next.js 15 on Cloudflare Pages | Uses `@cloudflare/next-on-pages` for the build. |
| Backend | Express app (per [Deploy an Express App](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/)) | WebSockets are handled via a Durable Object (`ContactCenterRoom`). |
| Database | Cloudflare D1 | Prisma (`@prisma/client` + `@prisma/adapter-d1`) is used everywhere. |
| Voice/SMS | Telnyx | All webhooks terminate at `/api/voice/webhook` and `/api/conversations/webhook`. |

**Required tooling**

- Cloudflare account with Workers Paid plan (WebSockets + Durable Objects).
- Telnyx account with messaging and voice webhooks pointing to the routes above.
- Wrangler CLI (`npm install -g wrangler`) and Cloudflare login (`wrangler login`).
- Node.js 20+ locally.

## 2. Database (Cloudflare D1)

1. Create the database (one-time):
   ```bash
   wrangler d1 create contact-center-db
   ```
2. Update `wrangler.toml` → `[[d1_databases]]` with the real `database_id`.
3. Apply schema:
   ```bash
   wrangler d1 execute contact-center-db --file=./migrations/0001_initial_schema.sql
   ```
4. (Optional) seed from the local SQLite snapshot:
   ```bash
   wrangler d1 execute contact-center-db --file=./migrations/seed_users.sql
   wrangler d1 execute contact-center-db --file=./migrations/seed_conversations.sql
   ```
5. Prisma usage:
   ```bash
   cd server
   npm install
   npm run prisma:generate
   npm run prisma:push   # for local SQLite dev
   ```

## 3. Backend Worker Deployment

```bash
cd server
npm install

# Set or update secrets
wrangler secret put SESSION_SECRET
wrangler secret put TELNYX_API_KEY
wrangler secret put JWT_SECRET
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ENCRYPTION_SECRET

# Deploy to Cloudflare Workers
wrangler deploy
```

The deployment publishes the Worker at `https://contactcenter.telnyx.solutions/api/*`.  Voice and SMS webhooks should already target:

- Voice: `https://contactcenter.telnyx.solutions/api/voice/webhook`
- SMS: `https://contactcenter.telnyx.solutions/api/conversations/webhook`

## 4. Frontend (Cloudflare Pages)

```bash
cd client
npm install
npm run pages:build
npm run pages:deploy
```

During the first deploy Wrangler will prompt for the Pages project name (use `contact-center-frontend`).  Future runs reuse the project automatically.

### Environment variables for the UI

Set in the Pages dashboard (or `client/wrangler.toml` if deploying via CLI):

- `NEXT_PUBLIC_API_URL = https://contactcenter.telnyx.solutions/api`
- `NEXT_PUBLIC_WS_URL = wss://contactcenter.telnyx.solutions/api/ws`

## 5. DNS & Custom Domains

1. In Cloudflare DNS for `telnyx.solutions`, create:
   - `CNAME contactcenter -> contactcenter.telnyx.solutions`
2. In Workers → **contact-center-api** → Domains & Routes add:
   - `contactcenter.telnyx.solutions/api/*`
3. In Pages → **contact-center-frontend** → Custom Domains add:
   - `contactcenter.telnyx.solutions`

## 6. Post-Deployment Checklist

- `curl https://contactcenter.telnyx.solutions/health` → `{ "status": "ok" }`
- Log in to the UI, confirm WebSockets connect and badges increment.
- Send inbound SMS → conversation appears in `/sms` without refreshing.
- Place inbound call → `/api/voice/webhook` enqueues, hold audio plays, queue dashboard updates.
- Outbound reply → rely on `message.finalized`; watch Cloudflare tail for `Broadcasted NEW_MESSAGE`.

### Useful Wrangler commands

```bash
# Tail worker logs (search for specific events)
wrangler tail contact-center-api --format json --search "NEW_MESSAGE"

# Remote DB access
wrangler d1 execute contact-center-db --remote --command "SELECT COUNT(*) FROM Messages;"
```

## 7. Maintenance & Rollbacks

- Re-deploy backend/frontend with the same commands; Workers keep prior versions (use `wrangler deployments list`).
- If a deployment fails, redeploy the last known good commit.
- For database rollbacks, reapply the migration SQL to a fresh D1 instance or restore from backup as required.

## 8. Reference Materials

- Telnyx Voice Webhooks: https://developers.telnyx.com/docs/api/v2/voice
- Telnyx Messaging Webhooks: https://developers.telnyx.com/docs/api/v2/messages
- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare Pages Docs: https://developers.cloudflare.com/pages/
- Prisma on Cloudflare D1: https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1

---

> This playbook supersedes the legacy deployment/migration markdown files. Remove any stale copies to avoid confusion.
