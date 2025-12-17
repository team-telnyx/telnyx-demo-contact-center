# Cloudflare Worker Bindings Guide for Next.js Frontend

## Current Bindings

Your frontend Worker now has these bindings configured:

### ✅ D1 Database
```toml
[[d1_databases]]
binding = "DB"
database_name = "contact-center-db"
database_id = "8bb564a7-f70a-449c-b2da-492bebc08e9a"
```

**Use case**: Access the same database as your backend for server-side rendering, API routes, or middleware.

**How to use in Next.js**:
```typescript
// In a Next.js API route or Server Component
export const runtime = 'edge';

export async function GET(request: Request, { env }: { env: any }) {
  const db = env.DB;
  const users = await db.prepare('SELECT * FROM users').all();
  return Response.json(users);
}
```

## Additional Bindings You Can Add

### 1. KV Namespace (Key-Value Storage)
**Use case**: Fast, low-latency key-value storage for caching, session data, or feature flags.

```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

**Create a KV namespace**:
```bash
npx wrangler kv:namespace create "CACHE"
# Use the ID from the output in your wrangler.toml
```

**How to use**:
```typescript
// Cache API responses or user sessions
await env.CACHE.put('user:123', JSON.stringify(userData), {
  expirationTtl: 3600 // Expire after 1 hour
});

const cached = await env.CACHE.get('user:123');
```

### 2. R2 Bucket (Object Storage)
**Use case**: Store large files, images, documents, or call recordings.

```toml
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "contact-center-uploads"
```

**Create an R2 bucket**:
```bash
npx wrangler r2 bucket create contact-center-uploads
```

**How to use**:
```typescript
// Upload a file
await env.STORAGE.put('recordings/call-123.mp3', audioData, {
  httpMetadata: {
    contentType: 'audio/mpeg'
  }
});

// Download a file
const file = await env.STORAGE.get('recordings/call-123.mp3');
const audioData = await file.arrayBuffer();
```

### 3. Durable Objects
**Use case**: Real-time WebSocket connections, presence tracking, or stateful sessions.

```toml
[[durable_objects.bindings]]
name = "CALL_SESSIONS"
class_name = "CallSession"
script_name = "contact-center-frontend"
```

**How to use**:
```typescript
// Manage active call sessions with WebSocket connections
const id = env.CALL_SESSIONS.idFromName('call-123');
const stub = env.CALL_SESSIONS.get(id);
await stub.fetch(request);
```

### 4. Queue (Background Jobs)
**Use case**: Process tasks asynchronously, like sending emails or processing recordings.

```toml
[[queues.producers]]
binding = "TASKS"
queue = "contact-center-tasks"
```

**Create a queue**:
```bash
npx wrangler queues create contact-center-tasks
```

**How to use**:
```typescript
// Send a task to the queue
await env.TASKS.send({
  type: 'send_email',
  to: 'user@example.com',
  template: 'call_summary'
});
```

### 5. Secrets (Sensitive Data)
**Use case**: API keys, JWT secrets, encryption keys.

**Set secrets** (not in wrangler.toml - they're encrypted):
```bash
cd /Users/phillip.kujawa/SE-webrtc-contact_center_v2/client

# Set JWT secret for validating tokens in middleware
npx wrangler secret put JWT_SECRET

# Set session secret for Next.js session management
npx wrangler secret put SESSION_SECRET

# Set Telnyx API key if frontend needs it
npx wrangler secret put TELNYX_API_KEY
```

**How to use**:
```typescript
// In Next.js middleware or API routes
const token = request.headers.get('Authorization');
const decoded = jwt.verify(token, env.JWT_SECRET);
```

### 6. Service Bindings (Worker-to-Worker)
**Use case**: Call your backend Worker directly without going through HTTP.

```toml
[[services]]
binding = "BACKEND"
service = "contact-center-api"
```

**How to use**:
```typescript
// Call backend directly from frontend (faster than HTTP)
const response = await env.BACKEND.fetch(
  'https://internal/api/users',
  request
);
```

### 7. Vectorize (Vector Database)
**Use case**: AI/ML features, semantic search, embeddings.

```toml
[[vectorize]]
binding = "VECTORS"
index_name = "call-transcripts"
```

**How to use**:
```typescript
// Search call transcripts using embeddings
const results = await env.VECTORS.query([0.1, 0.2, ...], {
  topK: 10
});
```

### 8. AI Binding (Workers AI)
**Use case**: Run AI models at the edge (LLMs, image classification, etc.).

```toml
[ai]
binding = "AI"
```

**How to use**:
```typescript
// Run AI models at the edge
const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
  prompt: 'Summarize this call transcript...'
});
```

## Recommended Bindings for Your Contact Center

Based on your application, I recommend adding:

### Priority 1 (Essential):
✅ **D1 Database** - Already added
- Access user data, call logs, conversations

### Priority 2 (Highly Recommended):
**KV Namespace** - For caching
```bash
npx wrangler kv:namespace create "CACHE"
```
Add to wrangler.toml:
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "paste-id-here"
```

**Secrets** - For authentication
```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put SESSION_SECRET
```

### Priority 3 (Optional but Useful):
**R2 Bucket** - For call recordings
```bash
npx wrangler r2 bucket create contact-center-uploads
```

**Service Binding** - For faster backend communication
```toml
[[services]]
binding = "BACKEND"
service = "contact-center-api"
```

## Deploying with New Bindings

After adding bindings to `wrangler.toml`, redeploy:

```bash
cd /Users/phillip.kujawa/SE-webrtc-contact_center_v2/client
npm run deploy
```

Or with wrangler directly:
```bash
npx wrangler deploy
```

## Accessing Bindings in Next.js

### In API Routes:
```typescript
export const runtime = 'edge';

export async function GET(
  request: Request,
  { env }: { env: any }
) {
  // Access bindings via env
  const db = env.DB;
  const cache = env.CACHE;
  const storage = env.STORAGE;

  // Your logic here
}
```

### In Middleware:
```typescript
export const config = {
  runtime: 'edge',
};

export async function middleware(request: NextRequest) {
  // Access via process.env or getRequestContext()
  const { env } = await getRequestContext();

  // Validate JWT token
  const token = request.headers.get('Authorization');
  try {
    jwt.verify(token, env.JWT_SECRET);
  } catch {
    return NextResponse.redirect('/login');
  }
}
```

### In Server Components:
```typescript
export const runtime = 'edge';

async function getData(env: any) {
  const db = env.DB;
  return await db.prepare('SELECT * FROM calls').all();
}

export default async function Page() {
  const { env } = await getRequestContext();
  const data = await getData(env);

  return <div>{/* Render data */}</div>;
}
```

## Monitoring Bindings

View bindings in the Cloudflare Dashboard:
1. Go to https://dash.cloudflare.com
2. Select "Workers & Pages"
3. Click "contact-center-frontend"
4. Go to "Settings" → "Bindings"

Or check via CLI:
```bash
npx wrangler deployments list
```

## Important Notes

1. **Environment Variables vs Bindings**:
   - `[vars]` = Plain text, visible to anyone
   - Secrets = Encrypted, set via CLI
   - Bindings = References to resources (DB, KV, R2, etc.)

2. **NEXT_PUBLIC_* Variables**:
   - Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
   - Never put secrets in `NEXT_PUBLIC_*` variables

3. **Development vs Production**:
   - Use `[env.dev]` sections for different dev bindings
   - Example:
     ```toml
     [env.dev.vars]
     NEXT_PUBLIC_API_URL = "http://localhost:3000/api"
     ```

## Need Help?

- Cloudflare Bindings Docs: https://developers.cloudflare.com/workers/configuration/bindings/
- Next.js on Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
