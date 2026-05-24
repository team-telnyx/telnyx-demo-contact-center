# ─── Telnyx Contact Center ─── Multi-stage Docker Build ───
# Single image: Next.js static export served by Express + Socket.IO

# ── Stage 1: Install dependencies ──────────────────────────────────────
FROM node:22-bookworm AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy workspace root + package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install everything (frozen lockfile for reproducibility)
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build Next.js client ──────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY client/ ./client/
COPY server/ ./server/

# Build the Next.js client (standalone output for smaller image)
RUN pnpm --filter client build

# ── Stage 3: Production image ─────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Production-only install (no devDependencies)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/client/package.json ./client/
COPY --from=builder /app/server/package.json ./server/

ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod

# Copy built client
COPY --from=builder /app/client/.next ./client/.next
COPY --from=builder /app/client/package.json ./client/

# Copy server source
COPY --from=builder /app/server ./server

# Non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 3001

# Health check — use node directly to avoid needing curl in the slim image
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || exit 1

CMD ["npx", "tsx", "server/server.ts"]
