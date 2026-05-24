# Pre-Deployment Audit — Telnyx Contact Center

**Auditor:** subagent (read-only deep audit)
**Date:** 2026-05-07 (Australia/Melbourne)
**Repo path:** `/Users/abdullahbutt/.openclaw/workspace/contact-center`
**Target:** EC2 Ubuntu 24.04 / 3.8 GB RAM / 19 GB disk @ 54.253.82.252 (Sydney) → `abdullahfde.demotelnyx.com`
**Audit scope:** the whole stack (server + client + Docker + nginx + DEPLOY.md). No code changes were made — this is read-only.

---

## TL;DR

> **Verdict: ❌ NO-GO as-is.** There are at least four independent showstoppers that will either prevent the app from booting, prevent the UI from rendering, or hand a stranger your Telnyx account. The good news: the bones are largely fine — most blockers are localised and fixable in a few hours.

The five most important fixes are listed at the bottom of this doc. After those are in place I'd run through the `[HIGH]` items before pointing real money/numbers at the box.

---

## 1. Build & dependencies

### `[BLOCKER]` Production client build fails — `Headset is not defined`
- `pnpm --filter client build` exits 1 while prerendering `/`:
  ```
  ReferenceError: Headset is not defined
      at i (.next/server/app/page.js:2:9507)
  ```
- The `Headset` icon from `lucide-react` is **used** in two pages but never imported:
  - `client/app/page.jsx:77` — `<Headset className="w-5 h-5 text-white" ...>` with imports limited to `react` + `next/navigation`.
  - `client/app/(auth)/login/page.jsx:51, 78` — same problem.
- `client/app/(dashboard)/layout.jsx:21` imports `Headset` correctly, which is presumably why this slipped through during dev.
- Fix: add `import { Headset } from 'lucide-react';` to both pages above.
- Until this is fixed, **the Docker image build (Stage 2) will fail** because Stage 2 runs `pnpm --filter client build`. The deploy literally cannot complete.

### `[BLOCKER]` `lucide-react@^1.14.0` is a real version, but it's brand‑new and stylistically different
- `client/package.json` pins `lucide-react: ^1.14.0`. Locked to `1.14.0` in `pnpm-lock.yaml`. Confirmed installed.
- This works (it's the new majors), but it's worth flagging: most StackOverflow/AI snippets target `lucide-react@~0.4xx`. Future "missing icon" surprises are likely. If the team can pin to a version they've actually used in another shipped product, that'd be safer.

### `[HIGH]` Multiple lockfiles in the client
- Next.js prints:
  > Detected additional lockfiles: `client/package-lock.json`
- The repo is a **pnpm workspace** (`pnpm-workspace.yaml` lists `client` and `server`). The presence of `client/package-lock.json` means at some point someone ran `npm install` in `client/`. It's currently inert (pnpm wins, npm lockfile is stale), but it confuses Next.js workspace‑root detection and is dead weight. Delete it.

### `[INFO]` `pnpm install --frozen-lockfile` is clean
- Lockfile is up to date; no drift; resolves in ~300 ms.

### `[INFO]` `pnpm audit` — 1 moderate
- `postcss@8.4.31` (transitive via `next`) — `GHSA-qx2v-qp2m-jg93` (XSS via unescaped `</style>` in stringify output, CVE-2026-41305).
- Bundled into Next.js' build pipeline; does not affect your runtime. Mitigated when you bump Next.js to a version that has `postcss@>=8.5.10`. Not a blocker for the demo.

### `[LOW]` No lint, no typecheck, no test commands
- Root `package.json`, `client/package.json`, `server/package.json` have no `lint`, `lint:fix`, `test`, or `typecheck` scripts. No `.eslintrc`/`eslint.config`. JS only — no TypeScript.
- This is a workflow gap, not a deploy blocker. But it means the only quality gate is "did the build succeed" — which is exactly how the missing `Headset` import made it this far.

### `[INFO]` Server has no build step — that's correct (plain ESM Node)
- `server/package.json` `start` is `node server.js`. No transpile needed. ✅

---

## 2. Environment / config

### `[BLOCKER]` The repo is **not a git repo** — `git clone` deploy can't work
- `contact-center/` has no `.git`. The parent `.openclaw/workspace/` has `.git` with **zero commits**. So there is literally nothing to clone yet.
- `DEPLOY.md` and `README.md` both say:
  > `git clone <your-repo-url> contact-center`
- Decide an actual deploy path *before* booting EC2:
  - Push the project to a real remote and update `DEPLOY.md`, **or**
  - Add a `scp -r contact-center/ ubuntu@host:` step (and exclude `node_modules`, `.next`, `.env*`, `memory/`), **or**
  - `tar` the repo locally → upload → extract on the box.

### `[HIGH]` Two parallel env-var conventions and they disagree
- `.env.production.example` (root) defines: `TELNYX_*`, `JWT_SECRET`, `ENCRYPTION_KEY`, `PUBLIC_URL`, `DB_PASSWORD`, etc.
- `server/.env.example` defines roughly the same keys *plus* `DATABASE_URL`, `PORT`, `NODE_ENV`, the `TELNYX_STT_*` overrides, etc.
- `docker-compose.yml` reads only the **root** `.env` and constructs `DATABASE_URL` itself.
- Local dev uses **`server/.env`** (loaded by `dotenv/config` in `server.js`).
- That's fine, but `DEPLOY.md` only documents `.env.production.example`'s keys and not the optional STT/AI overrides. A reader copying `.env.production.example` won't know how to override `TELNYX_STT_ENGINE` etc. on EC2 (they'd have to know the docker-compose `environment:` block).

### `[HIGH]` `.env.production.example` `JWT_EXPIRES_IN` and `STT/AI` knobs are missing from compose
- `docker-compose.yml` passes `JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-24h}` (✅) and `TELNYX_STT_ENABLED`, `TELNYX_AI_ENABLED` (✅), but **not** `TELNYX_STT_ENGINE`, `TELNYX_STT_MODEL`, `TELNYX_STT_LANGUAGE`, `TELNYX_STT_TRACKS`, `TELNYX_AI_MODEL`. So if you set them in `.env`, they'll silently be ignored inside the container. Add them to the compose `environment:` block.

### `[HIGH]` `COMPANY_NAME` defaults disagree
- `server/config/env.js` Zod default: `'Trilogy Care'` (line ~36).
- `.env.production.example`, `docker-compose.yml`, README: `'Telnyx Contact Center'`.
- Seed script names the demo IVR `"Trilogy Care Main IVR"`.
- Pick one. If this is a Telnyx-branded demo, change the Zod default to `'Telnyx Contact Center'` so the UI doesn't say "Welcome to Trilogy Care" if `.env` is missing.

### `[MEDIUM]` Default seed credentials are shipped publicly
- `seed.js` creates `admin/admin1234`, `agent1/agent1234`, `agent2/agent1234`. These are also documented in the README.
- For an internet-facing demo box (`abdullahfde.demotelnyx.com`), randomise these or print one-time random passwords on first seed.
- Combined with the open `/api/auth/register` (see § 3), this is meaningful.

### `[INFO]` `.env*` correctly excluded from Docker context via `.dockerignore`
- `.env`, `.env.*` excluded; `.env.production.example` is whitelisted; `node_modules`, `.next`, `.git`, `memory`, `demo-agent`, `*.log`, `.DS_Store` all excluded. ✅
- `.gitignore` excludes `.env`, `node_modules`, `dist`, `*.log`. ✅
- No real secrets are sitting in tracked files (and there are no commits anyway).

### `[INFO]` `loadEnv()` validation is solid
- Uses `zod.safeParse` with a clear error block on missing/invalid env. JWT_SECRET min 32 chars enforced. `PUBLIC_URL`/`DATABASE_URL` validated as URLs. Good.

---

## 3. Security

### `[BLOCKER]` Telnyx webhook signature verification is **not enforced** and the implementation is broken
Two independent problems:

1. **It isn't even called.** `server/server.js:104` mounts the webhook router with no `verifyTelnyxSignature(...)` middleware:
   ```js
   app.use('/api/webhooks', webhookLimiter, createWebhookRouter(models));
   ```
   So *anyone on the internet* who can reach `https://abdullahfde.demotelnyx.com/api/webhooks` can fabricate `call.initiated`/`call.answered`/`call.transcription`/`call.hangup` events. They can:
   - Trigger your IVR engine, which dials out via Call Control (you pay).
   - Insert fake calls/transcripts/case notes into your DB.
   - Cause `findOrCreate`/`update` storms by replaying.

2. **Even if it were called, the implementation in `middleware/verifyTelnyxSignature.js` is wrong.**
   - Telnyx signs with **Ed25519**. The code uses `crypto.createVerify(null)` and asks for `{ key, type: 'pkcs1', format: 'pem' }`. Node's `createVerify` is for hash-then-verify (RSA/ECDSA). Ed25519 must use `crypto.verify(null, message, publicKey, signature)` directly with a key created via `crypto.createPublicKey({key: rawBytes, format: 'der', type: 'spki'})` (or by feeding Telnyx's PEM). With this code path, every legitimate Telnyx webhook would 401 if it were enforced.
   - It re-stringifies `req.body` with `JSON.stringify`. The HMAC must be computed over the **raw bytes** Telnyx sent, not over a re-encoded JSON form (key order, whitespace, unicode escapes — anything different breaks the signature). The `app.use('/api/webhooks', express.raw(...))` block at `server.js:77` does capture raw bytes but then *replaces `req.body` with the parsed JSON* before any signature middleware could see it.

Fix outline: capture raw bytes (e.g. `req.rawBody`), use `crypto.verify(null, Buffer.concat([Buffer.from(timestamp), Buffer.from('|'), req.rawBody]), pubKey, Buffer.from(signature, 'base64'))` with the Telnyx Ed25519 key. Mount the middleware on the webhook router.

### `[BLOCKER]` `/api/auth/register` is open to the public and accepts `role: "admin"`
- `routes/auth.js` mounts `register` under `app.use('/api/auth', authLimiter, ...)` — no `authMiddleware`. The Zod schema accepts `role: z.enum(['admin','agent','supervisor']).default('agent')` but **doesn't strip** non-default values from the body, so anyone can:
  ```
  curl -XPOST https://abdullahfde.demotelnyx.com/api/auth/register \
    -d '{"username":"pwn","password":"hunter22!","displayName":"x","role":"admin"}'
  ```
  → instant admin token.
- Two fixes (do both):
  - Either drop `role` from the registration schema and force `'agent'` server-side, or guard `register` behind `authMiddleware` + admin role check.
  - Disable `register` entirely in production unless explicitly enabled (it's not needed for a fixed demo seed).

### `[BLOCKER]` `/api/voice/sip-config` returns the master Telnyx API key & SIP password to *any* authenticated user
- `routes/voice.js:331-345`:
  ```js
  res.json({
    sipUsername: env.TELNYX_SIP_USERNAME,
    sipPassword: env.TELNYX_SIP_PASSWORD,
    sipConnectionId: env.TELNYX_SIP_CONNECTION_ID,
    telnyxApiKey: env.TELNYX_API_KEY,
    appConnectionId: env.TELNYX_APP_CONNECTION_ID,
  });
  ```
- Combined with the open `register` endpoint, **any internet stranger** can self-register, hit this endpoint and walk away with the Telnyx API key. They can then port your numbers, drain your balance, and message-spam from your account.
- The route comment even says it's intentional ("safe to share creds across agents"). It is not safe — at minimum the API key must never leave the server. The Telnyx WebRTC client only needs short-lived **on-demand credentials** or **JWTs** issued by your backend (see Telnyx WebRTC docs); it does *not* need your Bearer API key.
- Fix: stop returning `telnyxApiKey`. If WebRTC token issuance is needed, mint a per-session token via Telnyx and return only that.

### `[HIGH]` CORS in production is `false`, but Socket.IO and Express must be co-hosted (see § 7) — and the wiring is broken
- `server.js:71-74` and `services/socket.js:18-21` both set `origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : false` — i.e. only same-origin in production. That's correct *if* the Next.js client is served from the same origin. As § 7 explains, it currently isn't served at all.

### `[HIGH]` Helmet is on, but no CSP and `crossOriginResourcePolicy`/HSTS aren't tuned
- `app.use(helmet())` defaults are reasonable. There's no Content-Security-Policy beyond the helmet defaults; for the kind of inline icons / Tailwind / `@telnyx/webrtc` traffic this app uses, you'll likely want to either configure CSP explicitly or rely on `helmet`'s defaults. nginx adds X-Frame, X-Content-Type, XSS, HSTS — good. But nginx **only** adds these to the HTTPS server block; if anything ever bypasses nginx (direct hit on `:3001`), helmet's defaults are what's left.

### `[HIGH]` `PATCH /api/agents/:id` lets any authenticated user mutate any agent
- No role check, no `req.user.id === agent.userId` check. An attacker who registered (see above) can flip every agent to "offline" or push themselves to priority 1.
- Fix: require admin role *or* `agent.userId === req.user.id`.

### `[HIGH]` Socket.IO `socket.on('call:answer'/'call:hangup')` accepts arbitrary `callControlId` from the client
- `services/socket.js:79-115` answers/hangs up any call control id submitted, with no check that the requesting socket's user is the assigned agent (or even any agent). A malicious authenticated client can hang up another agent's calls.
- Fix: look the call up, ensure `call.agentId === <socket-user's agentId>` (or the user has supervisor/admin role).

### `[MEDIUM]` Socket.IO broadcasts everything to everyone
- `emitTranscriptPartial`, `emitTranscriptFinal`, `emitCallEnded`, `emitCaseNotesReady`, `emitAgentStatusUpdate`, `emitCallRoutedToAgent`, `emitQueueUpdate` all use `io.emit(...)`. Every connected user — including anyone who registered — sees every other agent's live transcripts and case notes.
- For a single-tenant single-team demo this is acceptable. For a real product it's a disclosure issue. Pull these emits into rooms (`io.to('supervisors').emit(...)`, `io.to('user:<id>').emit(...)`).

### `[MEDIUM]` `req.user` JWT contains `role` from the original login, not from the DB
- If an admin downgrades or deactivates a user, their existing token still says `role: 'admin'`. JWT TTL is 24 h (`JWT_EXPIRES_IN`). Fine for a demo, but if you later add real RBAC, swap to short-lived access tokens or DB-loaded role-on-each-request.

### `[LOW]` Rate limiting is present but uniform across IPs
- `auth: 20/15min`, `webhook: 500/min`, `api: 200/min`. With `trust proxy: 1` (correct for a single fronting proxy), per-IP limits work. Login rate limit is moderate — combined with bcrypt(12) it's enough.
- Consider a tighter `auth` cap for `/register`.

### `[LOW]` `helmet`'s CSP for inline scripts/styles
- Tailwind generated CSS is fine, but `framer-motion` injects style attrs. Helmet defaults block inline style only with explicit CSP — the default helmet CSP is `default-src 'self'` etc. If anything breaks visually post-deploy, the CSP block will be the first place to look.

### `[LOW]` No CSRF protection on cookie-less APIs
- The app uses `Authorization: Bearer <jwt>` from `localStorage`, not cookies. CSRF is therefore not an issue. But — `cookie-parser` is in `package.json` unused, and there's a stray `credentials: true` in CORS. Tidy when convenient.

### `[INFO]` Sequelize ORM only — no raw SQL
- All queries use the model API, `Op`, `fn`, `col`. `raw: true` only changes the return shape, not the query construction. No SQL injection surface I can see.

### `[INFO]` Passwords properly hashed (bcrypt cost 12), AES-256-GCM for stored Telnyx creds (`utils/crypto.js`)
- Crypto is correct: random IV, GCM auth tag, base64 envelope. Note that `User` model has `telnyxApiKeyEncrypted`/`sipPasswordEncrypted` fields but the per-user encrypted creds are **not used yet** — `voice.js` reads from env. Fine, just dead code surface for now.

---

## 4. Database

### `[HIGH]` `sequelize.sync({ alter: true })` is the only "migration" tool
- `server/scripts/migrate.js` and dev startup both call `sequelize.sync({ alter: true })`. There are no real migrations.
- `alter: true` will compare the model definitions to the live schema and emit ALTER TABLE statements. In Sequelize this is widely known to be unsafe in production:
  - It can DROP+ADD columns when types change (data loss).
  - It can fail mid-way and leave the schema in an inconsistent state.
  - It does not handle ENUM additions cleanly on Postgres.
- For a one-shot demo where the schema is stable and you accept the risk: it'll probably work the first time. But there is no backup or rollback story.
- Recommended: lock down to `sequelize.sync()` (no alter) for the very first run, and freeze the schema. Or adopt `umzug` / sequelize-cli migrations before iterating in prod.

### `[MEDIUM]` Foreign keys are declared but no explicit indexes
- Models declare `references: { model: 'X', key: 'id' }` on FKs. Postgres does **not** auto-index FK columns. Lookups by `Call.agentId`, `Call.parentCallId`, `Call.callControlId`, `CallRecord.callId`, `Transcript.callId`, `CaseNote.callId`, `Task.caseNoteId`, etc. will table-scan once you have >a few thousand rows. For a demo it's fine; if it grows, add indexes via Sequelize `indexes` option.
- `Call.callControlId` *is* `unique: true` → index. Good.
- `User.username` unique → index. Good.

### `[MEDIUM]` `User` is `paranoid: true` (soft-delete) but no other model is
- That's a choice, just be aware: bcrypt hashes for "deleted" users persist in `deletedAt IS NOT NULL` rows.

### `[LOW]` In-memory state lost on restart
- `services/acd.js` keeps `queues`, `callQueue`, `agentAssignments` in process memory. Same for `services/transcription.js` (`activeTranscriptions`) and `routes/webhooks.js` (`callStates`). If the container restarts mid-call, all of that vaporises and orphaned calls in `Call` rows will sit `status: 'ringing'/'active'` forever.
- For a demo: live with it. For prod: persist queue state to Postgres or Redis.

### `[LOW]` No backup/restore story for the `pgdata` named volume
- `docker-compose.yml` uses a named volume `pgdata`. No `pg_dump` cron, no documented backup. For a demo this is OK. For anything real, run `pg_dumpall` nightly to S3.

---

## 5. Real-time / voice stability

### `[BLOCKER]` Socket.IO path mismatch — the client will never connect in any environment
- Server (`services/socket.js`): `new Server(httpServer, { cors: ... })` → uses **default** path `/socket.io/`.
- Client (`client/lib/socket.js:23`): `io({ path: '/api/socket.io', auth: { token }, transports: ['websocket','polling'] })` — overrides to `/api/socket.io`.
- nginx (`nginx/nginx.conf`): proxies `/socket.io/` to upstream — i.e. only the *server's* path. Client's `/api/socket.io` requests will hit the catch-all `location /` and Express will 404 (no handler).
- Result: zero real-time events in dev or prod. Live transcription, call routing notifications, supervisor whisper events, queue updates — all silently broken.
- Fix: pick a path. If you want `/api/socket.io`, set it on **both** the server (`new Server(httpServer, { path: '/api/socket.io', cors: ... })`) and adjust nginx. If you want default `/socket.io`, drop the `path` option from the client.

### `[BLOCKER]` Express never serves the Next.js client
- `server.js` mounts only `/health`, `/api/webhooks`, `/api/auth`, `/api/agents`, `/api/ivr`, `/api/history`, `/api/voice`, `/api/analytics`, `/api/numbers`, `api/features`. There is **no** static handler, **no** Next.js custom server, **no** `next` import anywhere in `server/`. The Dockerfile copies `client/.next` and `client/package.json` into the runner image but the entrypoint is `node server/server.js`, which never starts Next.js.
- Result: a request to `https://abdullahfde.demotelnyx.com/` returns 404. The login page, dashboard, IVR builder, softphone — none of it is reachable. The README's architecture diagram is aspirational, not implemented.
- nginx routes `/_next/static/`, `/api/`, `/socket.io/`, and `/` all to `app:3001` — but `app:3001` only knows `/api/*` and `/health`.
- Fixes (pick one):
  1. **Standalone output is already configured** (`client/next.config.mjs: output: 'standalone'`). Use it: rework `Dockerfile` to copy `client/.next/standalone` and `client/.next/static` into the runner, run *two* processes (Next.js on 3000, Express on 3001) behind nginx; or
  2. Mount Next.js inside Express via `next({ dev: false })` + `app.all('*', handle)`, and start Next.js from `server.js`; or
  3. Serve the client from a separate container and add it to `docker-compose.yml`.
- Whatever the choice, **the current Dockerfile + server combo cannot serve the UI**. This is the single biggest hole in the deployment story.

### `[HIGH]` Telnyx call transcription failure on Deepgram disconnect — no fallback
- The handler at `routes/webhooks.js:189-213` starts transcription via Telnyx Call Control. Telnyx itself manages the Deepgram WebSocket internally; if Deepgram disconnects mid-call, Telnyx may stop sending `call.transcription` events. Code never retries / restarts — final transcript will simply be partial.
- For demo purposes, fine. Add a `transcription.failed` handler if Telnyx surfaces one; otherwise, accept the gap.

### `[HIGH]` Graceful shutdown is incomplete
- `server.js:174-181`:
  ```js
  async function shutdown(signal) {
    closeAllTranscriptions();
    server.close();
    await sequelize.close();
    process.exit(0);
  }
  ```
- `closeAllTranscriptions()` only clears the in-memory map; it does **not** call `telnyxService.stopTranscription(id)` for in-flight calls. Telnyx will keep streaming audio + billing for up to the call's duration if the box dies mid-shutdown.
- `server.close()` is awaited synchronously (no `await`) — it returns immediately and never lets the existing requests finish. Use `await new Promise(r => server.close(r))` and add a 10–30 s timeout that calls `process.exit(1)` if connections won't drain.
- `io.close()` is never called; Socket.IO clients won't receive a clean disconnect.
- No attempt to release queued calls (`acd` queues hold `callIds` only).

### `[MEDIUM]` Call state map (`callStates`) only deleted on `call.hangup`
- `routes/webhooks.js:281` deletes the state on hangup. If `call.hangup` is missed (Telnyx flake, missed webhook, signature failure once we enforce them), the entry leaks until process restart. Fine for a demo (low volume), worth a TTL eviction in prod.

### `[MEDIUM]` `setImmediate(generateAndSaveCaseNotes)` — uncaught throws kill the process
- The function itself is wrapped in `try/catch` and resolves a Promise. But because it's invoked via `setImmediate(() => fn(...))` (not awaited), if `setImmediate` somehow lost the rejection (e.g., a synchronous throw inside `setImmediate`), there'd be no `unhandledRejection` handler to catch it.
- Code inspection: looks safe — every async path is wrapped. Just mentioning since there are no `process.on('unhandledRejection'/'uncaughtException')` handlers anywhere.

### `[INFO]` `_models` injected into `acd.js` and `socket.js` — order matters
- `acd.initAcd(models)` is called before `socket.setModels(models)` (server.js:60-65). ACD's `enqueueCall` checks `if (_models)` before routing, so a webhook-driven call could in theory enqueue before acd is ready, but `initAcd` runs at boot before listening. Safe.

---

## 6. Error handling

### `[HIGH]` No `process.on('unhandledRejection' | 'uncaughtException')`
- A throw in any unawaited async branch will crash the Node process. `docker compose` will restart it (`restart: unless-stopped`), but the in-memory state for live calls is gone.
- Add at minimum:
  ```js
  process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
  process.on('uncaughtException',  (err) => { logger.fatal({ err }, 'uncaughtException'); process.exit(1); });
  ```

### `[MEDIUM]` Webhook handler returns 200 immediately — good. But no retry/idempotency layer
- `routes/webhooks.js:36` `res.sendStatus(200)` is sent before processing. ✅ Telnyx won't retry-storm.
- However, if the same `eventId` arrives twice (e.g., Telnyx retries before our 200 lands), the handler will happily process it twice — creating duplicate `Call` rows on `call.initiated` (failing on the `callControlId` unique constraint, then 500-ing the entire flow), or duplicate `Transcript`s.
- Fix: dedupe by `eventId` using a small Set with TTL or a `processed_webhooks(eventId)` table. Important for production reliability; survivable for a single-room demo.

### `[MEDIUM]` Many handlers swallow errors with `.catch(() => {})`
- `acd.js`, `voice.js`, `webhooks.js` all do this for "best effort" Telnyx calls. Fine for hangup propagation, but it makes flaky calls invisible. At minimum add a debug log inside the catch.

### `[LOW]` `errorHandler` always sends `res.status(500).json({ error: message })`
- Good. But the message comes from `err.message`, which can leak internal info. For prod, hide messages on 5xx and emit a request id.

---

## 7. Deployment

### `[BLOCKER]` Dockerfile multi-stage but the runner image is incomplete
- Stage 3 copies `client/.next` (the Next.js build output dir) and `client/package.json`, then runs `pnpm install --frozen-lockfile --prod`. Effects:
  - Install pulls Next.js into the runner — that's tens of MB of unused code, plus its postcss/swc/etc. (Next.js is in client `dependencies`, fine.)
  - But **nothing in the image actually runs Next.js**. The CMD is `node server/server.js`. So the entire `client/.next` copy and the `next` install in Stage 3 is dead weight (~200 MB) that never gets executed.
- Either (a) actually start Next.js (see § 5 fixes), or (b) remove `client/` from the runner image entirely if you intend to serve the UI from somewhere else.
- Final image size — without measuring, expect ~700 MB+ on `node:22-bookworm-slim`. On a 19 GB EC2 disk that's fine, but in CI/registry traffic it adds up.

### `[HIGH]` `docker-compose.yml` is missing a few prod hardening defaults
- `db` exposes `5432:5432` to the host — comment says "remove in production", but it's not removed. With Ubuntu's UFW disabled this is a real risk (anyone reaching the EC2 IP on 5432 hits Postgres directly with `cc/<DB_PASSWORD>`). Either bind to `127.0.0.1:5432:5432` or remove the mapping entirely.
- No `mem_limit` / `memswap_limit` on `app`. On 3.8 GB RAM, set something like `mem_limit: 1.5g` so Postgres + system + Node can coexist without OOMkiller surprises.
- No `logging:` driver caps. Default `json-file` driver writes unbounded log files. On a 19 GB disk this can fill fast under load. Add:
  ```yaml
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
  ```
- nginx service is **commented out**. DEPLOY.md says "uncomment the nginx service" but there's no glue script to symlink certs into `./nginx/certs`. Document the certbot flow concretely or add the snippet.

### `[HIGH]` `Dockerfile` `HEALTHCHECK` uses `curl`, but `node:22-bookworm-slim` doesn't ship `curl`
- The slim Debian image strips most utilities. The `HEALTHCHECK CMD curl -f http://localhost:3001/health || exit 1` will fail with `curl: not found` on every run, marking the container "unhealthy" even when it is healthy.
- Either install `curl` in the runner stage (`apt-get install -y curl && rm -rf /var/lib/apt/lists/*`) or use a Node-only healthcheck (`node -e "fetch('http://localhost:3001/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"`).

### `[HIGH]` nginx config — missing WebSocket & long-poll timeouts; rate limiting may break Telnyx
- `proxy_read_timeout`, `proxy_send_timeout`, `proxy_connect_timeout` are not set anywhere. nginx's defaults are 60 s. For the **`/socket.io/`** location this is too short — Socket.IO long-poll fallback and idle WebSocket calls will get killed mid-call. Set `proxy_read_timeout 86400s; proxy_send_timeout 86400s;` on the `/socket.io/` block.
- `limit_req zone=api ... max=200/min, zone=webhook ... 120/min` — Telnyx can burst > 120/min easily on a busy call (each call generates ~10 events). Either widen the burst (`burst=200 nodelay`) or remove the rate limit on `/api/webhooks/` and rely on signature verification + app-level caps.
- `upstream app { server app:3001; }` — fine, but no `keepalive`. Add `keepalive 32;` and `proxy_http_version 1.1; proxy_set_header Connection "";` on the API/socket blocks for noticeable latency wins.
- nginx rate-limit zones (`api: 30r/m`, `webhook: 120r/m`) directly contradict the in-app limits (`api: 200/min`, `webhook: 500/min`). You'll hit nginx first, well before the app limits matter. Pick one source of truth.

### `[HIGH]` `DEPLOY.md` references commands and files that don't exist
- `docker compose exec app node server/scripts/migrate.js` — works.
- `docker compose exec app pnpm --filter server db:seed` (in README) — fails. The runner image strips `devDependencies` and uses `pnpm` for install only; `pnpm --filter server` works because `pnpm` is in the image (corepack), but the `seed.js` script imports `bcryptjs` (in deps) — should work. Worth testing once on the box.
- DEPLOY.md says "open ports 80, 443 (and 3001 if no nginx)" — but the nginx service is commented out by default. Either flip it on, or DEPLOY.md should default to "open 3001 directly, no TLS" + a fat warning that Telnyx requires HTTPS for webhooks.

### `[MEDIUM]` PM2 / systemd not used — Docker only
- That's fine. `restart: unless-stopped` covers crash recovery. Just be aware that a runaway memory leak will get OOM-killed and restart-loop without alerting anyone.

### `[MEDIUM]` Memory budget on 3.8 GB
- Postgres 16 default settings on a 4 GB box is fine (~256 MB working set unless you tune `shared_buffers`).
- Node app: a single Node process at idle uses ~80 MB; with 100 concurrent Socket.IO clients + active call state, expect ~200–400 MB. A V8 default heap size of ~1.5 GB on a 3.8 GB box is comfortable; you don't need `--max-old-space-size` unless you observe RSS climbing.
- The Docker build itself (Stage 2 `pnpm --filter client build`) is the real memory hog: Next.js builds easily peak at 2–3 GB. **Doing `docker compose up -d --build` directly on the EC2 box is risky.** Recommend building locally / in CI and pushing the image, or use `--build` only on a beefier box.

### `[INFO]` Image is built for `node:22-bookworm`, runs as non-root `appuser`
- Good. Non-root, slim base, Stage 1 isolates dev deps. Just make `appuser` exist *before* the chown to avoid any flaky uid mapping (it does).

---

## 8. Observability

### `[LOW]` `/health` exists, returns feature flags. Good.
- Returns 200 + `{ status: 'ok', timestamp, features }`. No DB ping, no upstream Telnyx check. Good enough for a load-balancer healthcheck; not enough for a real "is everything OK" probe. Consider extending with `await sequelize.authenticate()` (cached for 5 s) and a feature-flag echo.

### `[LOW]` Logging is structured (pino) but unrotated
- pino → stdout → docker logs. Without the compose `logging:` cap (see § 7) this fills disk. Add the cap.
- No request-id correlation. A failed call is hard to trace because the `eventId` chain isn't propagated to subsequent logs (e.g., `acd.attemptRoute` logs no eventId).
- Consider `pino-http` middleware for per-request log lines with auto request-ids.

### `[LOW]` No metrics endpoint
- For a demo, `/health` is enough. If anyone runs Prometheus, expose `/metrics` via `prom-client`.

### `[LOW]` Debugging a failed call in prod
- With current logging you have:
  - pino logs with `callControlId` for most events.
  - DB rows for `Call`, `CallRecord`, `Transcript`, `CaseNote`, `Task`.
  - Telnyx portal logs.
- Missing: end-to-end trace stitching events for a single call into one feed. A simple `grep callControlId=<id>` in `docker compose logs app` will get you 80% of the way.

---

## 9. Blockers — must fix before deploy

These are the things that will definitely break the demo as it stands.

| # | Severity | What | Where |
|---|----------|------|-------|
| 1 | BLOCKER | Production client build fails: missing `Headset` import | `client/app/page.jsx:77`, `client/app/(auth)/login/page.jsx:51,78` |
| 2 | BLOCKER | Express never serves the Next.js client (UI is unreachable) | `server/server.js` (no static / Next.js handler), `Dockerfile` |
| 3 | BLOCKER | Telnyx webhook signature is **not enforced** *and* the implementation is wrong (Ed25519 with `createVerify`) | `server/server.js:104`, `server/middleware/verifyTelnyxSignature.js` |
| 4 | BLOCKER | `/api/auth/register` open to the world and accepts `role:"admin"` | `server/routes/auth.js:45-77` |
| 5 | BLOCKER | `/api/voice/sip-config` returns the master Telnyx API key & SIP password to any logged-in user | `server/routes/voice.js:331-345` |
| 6 | BLOCKER | Socket.IO path mismatch: server `/socket.io`, client `/api/socket.io`, nginx proxies `/socket.io` only — real-time is dead in dev *and* prod | `server/services/socket.js:13`, `client/lib/socket.js:23`, `nginx/nginx.conf` |
| 7 | BLOCKER | The repo isn't a git repo — `git clone` deploy path doesn't exist | `contact-center/` has no `.git` |
| 8 | BLOCKER | Dockerfile `HEALTHCHECK` uses `curl` but `node:22-bookworm-slim` has no `curl` — container will always be marked unhealthy | `Dockerfile` last block |

---

## 10. High-priority fixes (do before letting anyone touch the demo)

1. Drop `5432:5432` from `docker-compose.yml` (or bind to 127.0.0.1) so Postgres isn't internet-reachable.
2. Fix nginx WebSocket timeouts (`proxy_read_timeout 86400s`) on `/socket.io/`.
3. Reconcile rate limits between nginx and the app — pick one place.
4. `PATCH /api/agents/:id` and `socket.on('call:answer'/'hangup')` need ownership/role checks.
5. Add `process.on('unhandledRejection'/'uncaughtException')` handlers.
6. Fix graceful shutdown: actually `await server.close()`, call `telnyxService.stopTranscription` for active calls, close `io`.
7. Decide on `sequelize.sync({ alter: true })` vs real migrations — at minimum, take a `pg_dump` before each deploy.
8. Ship a `docker-compose.override.prod.yml` (or fold into the main file) with: `mem_limit`, `logging:` size caps, no host port for `db`, the nginx service uncommented and pointed at a TLS cert path.
9. Tidy the lockfile mess: delete `client/package-lock.json`.
10. Reconcile env conventions: one `.env` schema, one example file. Document all the `TELNYX_STT_*`/`TELNYX_AI_*` knobs in `DEPLOY.md` and add them to `docker-compose.yml`.
11. Remove dead `cookie-parser` dep, dead `deepgram.js` (Telnyx-side STT made it redundant), unused `literal` import.
12. Default IVR seed flow ships with `published: false` — every inbound call hits the "system being set up" fallback. Either flip default to `true`, or make sure operators are told to publish in the UI before the demo.

---

## 11. Nice-to-haves (not blockers)

- ESLint + Prettier + `tsc --noEmit` (with JSDoc types) wired into a `pnpm check` script. Catches the `Headset` class of bug at PR time.
- Convert in-memory queue/transcription state to Postgres or Redis so rolling restarts don't drop calls.
- Per-room Socket.IO emits (privacy: agent A shouldn't see agent B's transcripts).
- Replace `lucide-react@1.x` with whatever the team has shipped before, or pin a known-good version.
- Add `pino-http` for request-scoped logs with request ids.
- A `/metrics` endpoint with Prometheus `prom-client` (pairs nicely with EC2 + cloudwatch agent if needed).
- `eventId`-based webhook dedupe (Postgres unique constraint on a `processed_webhooks` table or a `seen_event_ids` LRU).
- Healthcheck pings DB.
- `pg_dump` cron in compose (`docker compose exec db pg_dumpall ...` nightly).
- Pre-flight script that hits Telnyx with the configured API key + connection IDs and prints what it found, before booting (saves "why is my IVR silent" debugging time).

---

## Verdict — Go / No-Go

**❌ NO-GO** as the code stands.

Reasons:
- The client image won't build (`Headset` import).
- Even if it built, Express doesn't serve the UI — the deployed box would respond to `/api/*` and `/health` only.
- Even if the UI were served, Socket.IO is wired to a path no one routes — no live transcription / call routing / case-note delivery.
- Even if all of that worked, the public webhook + `register` + `sip-config` endpoints together hand a passerby admin access and your Telnyx API key.

**Top 5 things to fix before deploy** — the absolute minimum:

1. **Add the missing `Headset` imports** in `client/app/page.jsx` and `client/app/(auth)/login/page.jsx`. Re-run `pnpm --filter client build` and confirm it exits 0.
2. **Make the server actually serve the client.** The cleanest path given the existing `next.config.mjs: output: 'standalone'`: rework the Dockerfile to copy `client/.next/standalone` + `client/.next/static` + `client/public`, expose port 3000 for Next.js inside the same container (or split it into a `web` service), and update nginx to proxy `/_next/static/`, `/socket.io/`, and `/` to the right ports. (Or mount Next.js inside Express with `next({dev:false}).getRequestHandler()`.)
3. **Lock down the public attack surface.** In one PR: (a) gate `/api/auth/register` behind admin-only or remove it; force `role: 'agent'` server-side regardless of body; (b) stop returning `telnyxApiKey` and `sipPassword` from `/api/voice/sip-config` — return only what the WebRTC client needs (a Telnyx-issued token); (c) implement Telnyx Ed25519 webhook signature verification correctly (use `crypto.verify(null, rawBody, key, sig)` with the raw body bytes, not `JSON.stringify(req.body)`) and **mount it on the webhook router**.
4. **Fix Socket.IO end-to-end.** Pick one path (`/socket.io` or `/api/socket.io`) and align the server's `Server({ path })` option, the client's `io({ path })` call, and the nginx `location` block. Set nginx `proxy_read_timeout 86400s` on that block.
5. **Make the Dockerfile/HEALTHCHECK actually pass and the compose file actually safe**: install `curl` in the runner stage (or use a Node healthcheck), drop the host-bound `5432:5432` from `db`, add `logging: max-size/max-file` and `mem_limit` to `app`, and uncomment + parameterise the nginx service with documented cert paths. Also: **either** initialise `contact-center/` as its own git repo and push it, **or** rewrite DEPLOY.md to reflect a `scp`/`rsync` deploy.

After those five, do another pass on the `[HIGH]` items (webhook idempotency, ownership checks on `/api/agents/:id` and Socket.IO call ops, graceful shutdown, sync→migrations) before showing this to a paying customer.
