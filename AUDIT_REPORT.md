# Contact Center — Deep Audit Report

**Date:** 2026-05-11  
**Scope:** Full project audit post JS→TS/TSX migration + Go webhook-handler addition  
**Project root:** `/Users/abdullahbutt/.openclaw/workspace/contact-center/`

---

## Executive Summary

The project has been migrated from JS to TypeScript (server) and JSX to TSX (client), and a Go webhook-handler microservice has been added. The **client builds cleanly** (Next.js 15, `next build` succeeds). The **Go service builds and vets cleanly**. However, the **server TypeScript has 164 compile errors** — the migration is syntactically complete but type-safety is not achieved. Several dead files, inconsistencies between client/server types, and security concerns remain.

| Area | Status | Severity |
|------|--------|----------|
| Client build | ✅ Passes | — |
| Server TypeScript build | ❌ 164 errors | 🔴 Critical |
| Go webhook handler | ✅ Builds + vets clean | — |
| Dead/leftover files | ⚠️ 5 leftover .js, 1 dead module | 🟡 Medium |
| Type consistency | ⚠️ Multiple mismatches | 🟡 Medium |
| Security | ⚠️ Plaintext secrets in .env, weak seed passwords | 🔴 Critical |
| TypeScript strictness | ⚠️ strict: false, ~165 `any` types | 🟡 Medium |
| Unused dependencies | ⚠️ cookie-parser, @types/uuid unused | 🟢 Low |

---

## 1. File Structure Audit

### 1.1 Leftover .js/.jsx Files That Should Be .ts/.tsx

| File | Status | Action |
|------|--------|--------|
| `client/postcss.config.js` | ⚠️ Config file, acceptable as .js | Keep or rename to `.mjs` |
| `client/tailwind.config.js` | ⚠️ Uses `module.exports`, not ESM | Keep as-is (Tailwind convention) |
| `server/scripts/migrate.js` | 🔴 **Leftover from migration** — a `migrate.ts` exists | **DELETE** — dead duplicate |
| `server/scripts/seed.js` | 🔴 **Leftover from migration** — a `seed.ts` exists | **DELETE** — dead duplicate |
| `shared/constants.js` | 🔴 **Dead code** — not imported anywhere | **DELETE** |

### 1.2 Duplicate Files

- `server/scripts/migrate.js` duplicates `server/scripts/migrate.ts`
- `server/scripts/seed.js` duplicates `server/scripts/seed.ts`

### 1.3 Orphaned/Dead Files

- `shared/constants.js` — not imported by any `.ts`, `.tsx`, `.js`, or `.jsx` file in the project. Contains `AGENT_STATUSES`, `CALL_STATUSES`, `SOCKET_EVENTS`, `QUEUE_EVENTS`, etc. that were presumably used pre-migration but are now hardcoded inline in the TypeScript files.

### 1.4 Files in Wrong Directories

- No files found in obviously wrong directories. The `shared/` directory only contains the dead `constants.js`.

---

## 2. Import Audit

### 2.1 Server .js Extension Imports

All server `.ts` files use `from './X.js'` import pattern (e.g., `from './User.js'`, `from '../config/env.js'`). This works with `moduleResolution: "bundler"` but is **non-standard** and can confuse:
- IDE tooling that expects `.ts` extensions
- New developers who see `.js` in imports but `.ts` files on disk

**Recommendation:** This is a known TS + ESM convention and is technically correct, but document it or switch to extensionless imports.

### 2.2 Missing Module: `node-fetch`

**File:** `server/routes/recordings.ts:277`  
```typescript
const fetch = (await import('node-fetch')).default as any;
```
- `node-fetch` is **not listed** in `server/package.json` dependencies
- In Node 22 (the Dockerfile base), native `fetch` is available globally
- This will fail at runtime if `node-fetch` is not installed, or silently use native fetch if the dynamic import falls through

**Fix:** Replace with native `fetch()` (available in Node 18+) or add `node-fetch` to dependencies.

### 2.3 No Circular Dependencies Detected

The route → service → model dependency graph flows in one direction. No circular imports found.

### 2.4 Missing Exports

- `server/routes/debug.ts` exports `debugStore`, `pushWebhookEvent`, `pushEvent` — these are imported by `webhooks.ts` and `workflows.ts` ✓
- `server/services/socket.ts` exports many `emit*` functions — all used ✓
- No missing exports detected

---

## 3. Build Audit

### 3.1 Client Build (`next build`)

✅ **PASSES** — builds cleanly in ~3s. 23 static + dynamic routes generated.

### 3.2 Server TypeScript (`tsc --noEmit`)

❌ **164 errors** across 17 files. Full breakdown by file:

| File | Errors | Primary Issues |
|------|--------|----------------|
| `routes/forms.ts` | ~25 | `DecodedUser` missing `userId`, form update object missing `variables`/`version` |
| `routes/recordings.ts` | ~15 | Untyped Sequelize `where` clauses, `node-fetch` import |
| `routes/analytics.ts` | ~12 | Untyped query results, `{}` typed objects |
| `routes/wallboard.ts` | ~10 | `unknown` types from Sequelize queries |
| `routes/history.ts` | ~10 | `{}` typed where clauses |
| `routes/webhooks.ts` | ~3 | Arithmetic on potentially non-number types |
| `routes/ivr.ts` | ~2 | Missing `gatherResult` on inline type |
| `routes/voice.ts` | ~2 | `{}` typed where clauses |
| `routes/sms.ts` | ~1 | `unknown` type from request |
| `routes/workflows.ts` | ~6 | Missing properties on inline types, `DecodedUser.userId` |
| `routes/auth.ts` | ~3 | `JwtPayload` type mismatch, `sign` overload |
| `routes/chat.ts` | ~2 | Minor type issues |
| `server.ts` | ~6 | `Model<any, any>` missing specific properties |
| `services/call-analysis.ts` | ~6 | `unknown` from fetch responses |
| `services/llm.ts` | ~2 | `unknown` from fetch responses |
| `services/workflow-executor.ts` | ~1 | `unknown` type |
| `routes/agent-assist.ts` | — | Uses `any` extensively |

**Root Causes:**
1. **Sequelize model types not propagated** — Models return `Model<any, any>` instead of typed instances. The model definitions use `sequelize.define()` which returns untyped models.
2. **`DecodedUser` type incomplete** — Defined in `server/types/express.d.ts` with `id`, `username`, `role`, `displayName?`, `agentId?` but routes reference `req.user.userId` (should be `req.user.id`)
3. **Inline object literals** — Route handlers create objects with `{}` type annotation, then access properties on them
4. **`fetch` responses untyped** — HTTP responses from Telnyx API calls return `unknown`

### 3.3 Go Webhook Handler

✅ `go build ./...` — passes  
✅ `go vet ./...` — passes  
✅ `go mod tidy` — clean (only `go-redis/v9` dependency)

---

## 4. TypeScript Strictness Audit

### 4.1 Server `tsconfig.json` — All Safety Checks Disabled

```json
"strict": false,
"noImplicitAny": false,
"strictNullChecks": false,
"strictPropertyInitialization": false,
"noUnusedLocals": false,
"noUnusedParameters": false,
"noImplicitThis": false,
"useUnknownInCatchVariables": false
```

**Impact:** The server TypeScript is effectively "JavaScript with type annotations that are mostly ignored." Null pointer errors, unused variables, and implicit `any` types will not be caught at compile time.

### 4.2 Client `tsconfig.json`

```json
"strict": false,
"target": "ES2017"
```

Less critical since Next.js build passes, but `strict: false` means the client also lacks compile-time safety.

### 4.3 `any` Type Usage

Approximately **165 explicit `any` annotations** in server `.ts` files (excluding `Record<string, any>` which is somewhat acceptable, and `req: any`/`res: any`/`err: any` which are Express conventions).

**Worst offenders:**
- `server/services/socket.ts` — nearly every `emit*` function takes `callData: any`, `transcript: any`, etc.
- `server/routes/*.ts` — `models` parameter typed as `any`, Sequelize results untyped
- `server/server.ts` — `Model<any, any>` throughout

### 4.4 Missing Return Types

Most exported functions lack explicit return types. The route factory functions (`createXRouter(models: any)`) don't declare their return type.

---

## 5. Go Webhook Handler Audit

### 5.1 Build & Vet

✅ Compiles cleanly  
✅ `go vet` passes  

### 5.2 Go Module

- Module: `github.com/telnyx/contact-center/webhook-handler`
- Go version: `1.25.6`
- Single dependency: `github.com/redis/go-redis/v9 v9.19.0`
- `go.sum` has 22 lines — clean, no unused dependencies

### 5.3 Dockerfile

```dockerfile
FROM golang:1.23-alpine AS builder   # ← Note: Go 1.23 in Docker, but go.mod says 1.25.6
FROM alpine:3.20 AS runtime
EXPOSE 8090
ENTRYPOINT ["/webhook-handler"]
```

⚠️ **Version mismatch:** `go.mod` specifies `go 1.25.6` but the Dockerfile uses `golang:1.23-alpine`. Go 1.25 doesn't exist yet (as of early 2026, latest stable is ~1.23-1.24). The `go.mod` version may be a typo or forward-looking.

### 5.4 Integration with Node.js Server

- Go handler receives Telnyx webhooks on `:8090/webhooks/telnyx`
- Verifies Ed25519 signature
- Updates Redis call state
- Forwards validated events to Node.js at `http://app:3001/api/webhooks/telnyx/internal`
- Node.js authenticates the internal forward via `X-Internal-API-Key` header

✅ Integration wiring is correct in both `docker-compose.yml` and the route handlers.

⚠️ **`INTERNAL_API_KEY` defaults to empty** in docker-compose (`${INTERNAL_API_KEY:-}`), meaning the internal webhook endpoint has **no authentication** unless explicitly set.

### 5.5 Docker Compose

✅ Correct service topology  
✅ Health checks configured for all services  
✅ DB and Redis bound to `127.0.0.1` only  
⚠️ Go handler port `8090` is **exposed publicly** (not bound to `127.0.0.1`)

---

## 6. Consistency Audit

### 6.1 `DecodedUser` vs Route Usage — MISMATCH

**Defined type** (`server/types/express.d.ts`):
```typescript
interface DecodedUser {
  id: string;
  username: string;
  role: string;
  displayName?: string;
  agentId?: string;
}
```

**Routes using `req.user.userId`** (which doesn't exist on `DecodedUser`):
- `server/routes/forms.ts:634,654,663,729,797,836,841,862,867,886` — uses `req.user?.userId`
- `server/routes/workflows.ts:229` — uses `req.user?.userId`
- `server/routes/forms.ts:411,459` — falls back to `req.user?.userId || req.user?.id`

**Fix:** Either add `userId` to `DecodedUser` (probably should be `id` anyway) or change routes to use `req.user.id`.

### 6.2 Client vs Server Type Mismatches

| Type | Client | Server | Issue |
|------|--------|--------|-------|
| `User` | `email`, `name`, `avatar`, `status`, `extension` | `username`, `displayName`, `password`, no `email`, no `avatar` | Client User shape doesn't match server User model |
| `Contact` | `name`, `phone` | `phoneNumber`, `name` | Field name mismatch (`phone` vs `phoneNumber`) |
| `Queue` | `description`, `strategy`, `maxWait`, `priority` (all optional) | `name`, `strategy`, `maxWaitSeconds`, `slaTargetSeconds`, etc. | Client Queue is a subset; field names differ |
| `Recording` | `callId`, `agentId`, `url`, `transcription`, `sentiment` | `recordingUrl`, no `url`, no `transcription` | Different field names and shapes |
| `Workflow` | `triggerType`, `triggerConfig` | `trigger` (Record), `actions` (WorkflowAction[]) | Client uses `triggerType`/`triggerConfig`, server uses `trigger` object |
| `Task` | `title`, `assignedTo`, `status` (pending/in_progress/completed/cancelled) | `type`, `description`, `priority`, `completed` (boolean) | Completely different shapes — client Task is a TODO-style, server Task is a call-center task |

### 6.3 Socket.IO Events Consistency

Server emits these events (from `server/services/socket.ts`):
- `call:ringing`, `call:answered`, `call:ended` ✓
- `transcript:partial`, `transcript:final` ✓
- `caseNotes:ready` ✓
- `agent:status` ✓
- `agent:wrapup:start`, `agent:wrapup:end` ✓
- `chat:new`, `chat:message`, `chat:accepted`, `chat:closed` ✓
- `queue:update`, `queue:created`, `queue:updated`, `queue:deleted` ✓
- `wallboard:update` ✓
- `whisper:started`, `monitor:started`, `barge:started` ✓
- `transfer:started` ✓
- `agent_assist:suggestion` ✓
- `internal:chat:new`, `internal:chat:message`, `internal:presence` ✓
- `form:submitted`, `form:approved`, `form:rejected` ✓
- `workflow:executed` ✓

Client socket hooks are in `client/lib/socket.tsx` — the `on`/`emit` functions accept `any` event names, so there's no compile-time checking. **Recommendation:** Create a shared event type map.

### 6.4 Environment Variables

**Root `.env`** contains these secrets in plaintext:
- `JWT_SECRET=AlLfp7…3aqR`
- `ENCRYPTION_KEY=yyhqFB…Fc4=`
- `TELNYX_API_KEY=KEY019…KV2Q`
- `TELNYX_PUBLIC_KEY=J5Y7WK…/j0=`
- `TELNYX_APP_CONNECTION_ID=2750594579446105942`
- `TELNYX_SIP_CONNECTION_ID=2923727848361428498`
- `TELNYX_SIP_USERNAME=telnyxfawkner`

**Server `.env`** duplicates many of these with **different values**:
- Different `TELNYX_APP_CONNECTION_ID` (2957308074433447518 vs 2750594579446105942)
- Different `ENCRYPTION_KEY`
- Different `PUBLIC_URL` (different cloudflare tunnel)

**`server/config/env.ts`** references `TELNYX_SIP_PASSWORD` as required, but it's **not in either `.env` file**.

**`INTERNAL_API_KEY`** is used by the Go webhook handler integration but is **not defined in any `.env` file** — defaults to empty in docker-compose.

### 6.5 Duplicated Constants

The `shared/constants.js` file (dead code) defines constants like `AGENT_STATUSES`, `CALL_STATUSES`, etc. that are now hardcoded inline in the TypeScript server files. These string literals should ideally be shared constants with proper types.

---

## 7. Configuration Audit

### 7.1 `tsconfig.json` (Server)

- `strict: false` — all strictness checks disabled
- `exclude: ["./scripts"]` — scripts folder excluded from type checking, but `migrate.ts` and `seed.ts` are in that folder
- `allowJs: true` — allows `.js` files to be included, which permits the leftover `.js` files to pass

### 7.2 `tsconfig.json` (Client)

- `strict: false` — no strict checking
- `target: "ES2017"` — outdated; should be `ES2022` to match server
- `jsx: "preserve"` — correct for Next.js

### 7.3 `client/next.config.mjs`

- `output: 'standalone'` — correct for Docker deployment
- Rewrites `/api/:path*` to `http://localhost:3001` — correct for dev proxy
- ⚠️ Hardcoded `localhost:3001` — should use env var for production

### 7.4 `package.json` Dependencies

**Server — Unused dependencies:**
- `cookie-parser` — listed in `package.json` but never imported or used in any `.ts` file
- `ws` — dynamically imported in `server/services/deepgram.ts` but listed as a regular dependency (should be optional or peer)
- `@types/uuid` — in devDependencies but `uuid` is never imported anywhere

**Server — Potentially missing:**
- No `@types/node-fetch` — `node-fetch` is used in `recordings.ts` but not in dependencies at all

### 7.5 Dockerfile

⚠️ **CMD runs TypeScript directly:** `npx tsx server/server.ts`  
This means `tsx` (a devDependency) must be available in the production image. The Dockerfile does `pnpm install --frozen-lockfile --prod` which would exclude devDependencies, but `tsx` is in `server/devDependencies`. The `npx tsx` command might fail in production.

**Fix:** Either compile TypeScript to JS and run the compiled output, or move `tsx` to regular dependencies.

### 7.6 `pnpm-workspace.yaml`

```yaml
packages:
  - 'client'
  - 'server'
```

⚠️ Does not include `services/webhook-handler` — the Go service is managed separately, which is correct (different build toolchain).

---

## 8. Security Findings

### 8.1 🔴 Plaintext Secrets in `.env` Files (CRITICAL)

Both `.env` and `server/.env` contain plaintext secrets that are committed to the repository:
- `JWT_SECRET`, `ENCRYPTION_KEY`, `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`

**Fix:** Add `.env` to `.gitignore`, use `.env.example` with placeholder values, and use secrets management in production.

### 8.2 🔴 Weak Seed Passwords (CRITICAL)

`server/scripts/seed.ts` hardcodes:
- `admin1234` (admin password)
- `agent1234` (agent1 and agent2 passwords)

Even for demos, these are trivially guessable.

### 8.3 🔴 `INTERNAL_API_KEY` Defaults to Empty (CRITICAL)

In `docker-compose.yml`, `INTERNAL_API_KEY` defaults to empty string:
```yaml
INTERNAL_API_KEY: ${INTERNAL_API_KEY:-}
```
This means the Go webhook handler's internal forward to Node.js has **no authentication** unless the operator explicitly sets this variable.

### 8.4 ⚠️ Webhook Handler Port Exposed Publicly

`docker-compose.yml` exposes Go webhook handler on port `8090` to all interfaces:
```yaml
ports:
  - "8090:8090"
```
Should be `"127.0.0.1:8090:8090"` unless the webhook handler needs to be internet-reachable (Telnyx webhooks typically go through a tunnel/proxy).

### 8.5 ⚠️ Two `.env` Files with Conflicting Values

`server/.env` and root `.env` have different values for:
- `TELNYX_APP_CONNECTION_ID`
- `ENCRYPTION_KEY`
- `PUBLIC_URL`

If both are loaded, the behavior depends on which takes precedence (likely `server/.env` since `dotenv` loads from CWD).

---

## 9. Additional Findings

### 9.1 Sequelize `sync({ alter: true })` in Seed Script

`server/scripts/seed.ts:12` calls `sequelize.sync({ alter: true })` which modifies the database schema to match models. This is **dangerous in production** — it can drop columns. The migration script also does this. Production should use proper Sequelize migrations.

### 9.2 `debugStore` — Unbounded In-Memory Store

`server/routes/debug.ts` exports a `debugStore` with ring buffers (`webhookEvents: []`, `events: []`). These are capped at 200 entries each, which is reasonable, but they're in-process memory and will be lost on restart.

### 9.3 Go Version in `go.mod`

`go 1.25.6` doesn't exist as a stable Go release. This may cause issues with tooling. Should be `1.23` or `1.24` depending on what's available.

### 9.4 `client/types/api.ts` vs `server/types/models.ts`

The client-side type definitions in `client/types/api.ts` are completely separate from the server-side `server/types/models.ts`. They define similar concepts (User, Contact, Queue, etc.) but with **different field names and shapes** (detailed in §6.2). This means the client is either:
1. Ignoring the server response types and re-mapping somewhere
2. Using incorrect types that don't match actual API responses

---

## 10. Priority Fix List

### 🔴 Critical (Blocks Production)

1. **Fix 164 TypeScript errors** — Add proper types to Sequelize models, fix `DecodedUser.userId` → `id`, type HTTP responses
2. **Remove plaintext secrets from `.env`** — Add to `.gitignore`, use `.env.example`
3. **Set `INTERNAL_API_KEY` default** in docker-compose or require it
4. **Fix Dockerfile CMD** — Either compile TS to JS or move `tsx` to prod dependencies
5. **Delete leftover `.js` files** — `server/scripts/migrate.js`, `server/scripts/seed.js`, `shared/constants.js`

### 🟡 High (Should Fix Before Real Use)

6. **Fix `node-fetch` import** in `recordings.ts` — Use native `fetch()` or add dependency
7. **Fix Go version** in `go.mod` — `1.25.6` doesn't exist
8. **Align client/server types** — Create shared types package or generate from server
9. **Remove unused dependencies** — `cookie-parser`, `@types/uuid`
10. **Fix conflicting `.env` files** — Consolidate to a single `.env`
11. **Fix Go handler port exposure** — Bind to `127.0.0.1:8090`
12. **Add `TELNYX_SIP_PASSWORD`** to `.env` (required by env schema)

### 🟢 Medium (Technical Debt)

13. **Enable `strict: true`** in both `tsconfig.json` files (incrementally)
14. **Replace `any` types** with proper interfaces (especially in socket.ts emit functions)
15. **Remove `shared/` directory** (only contains dead `constants.js`)
16. **Document the `.js` import convention** in server code
17. **Create shared Socket.IO event type map**
18. **Use proper Sequelize migrations** instead of `sync({ alter: true })`
19. **Fix `client/tsconfig.json` target** — `ES2017` → `ES2022`
20. **Parameterize `next.config.mjs`** — Use env var for API proxy URL

---

*End of audit report.*
