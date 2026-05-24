import { z } from 'zod';

/**
 * Environment schema.
 *
 * Required for any demo:
 *   PORT, NODE_ENV, DATABASE_URL, JWT_SECRET, all TELNYX_* vars,
 *   ENCRYPTION_KEY, PUBLIC_URL
 *
 * Telnyx-powered features (enabled by default with TELNYX_API_KEY):
 *   - STT: Telnyx Call Control transcription (engine B / Whisper)
 *   - AI case notes: Telnyx AI Chat Completions
 *
 * Both use the existing TELNYX_API_KEY — no separate API keys needed.
 * Set TELNYX_STT_ENABLED=false or TELNYX_AI_ENABLED=false to disable.
 *
 * The server WILL boot and process calls without any optional features.
 */

interface EnvData {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  CORS_ORIGIN?: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  TELNYX_API_KEY: string;
  TELNYX_PUBLIC_KEY: string;
  TELNYX_APP_CONNECTION_ID: string;
  TELNYX_SIP_CONNECTION_ID: string;
  TELNYX_SIP_USERNAME: string;
  TELNYX_SIP_PASSWORD: string;
  TELNYX_FROM_NUMBER?: string;
  ENCRYPTION_KEY: string;
  PUBLIC_URL: string;
  COMPANY_NAME: string;
  TELNYX_STT_ENABLED: 'true' | 'false';
  TELNYX_STT_ENGINE?: string;
  TELNYX_STT_MODEL?: string;
  TELNYX_STT_LANGUAGE?: string;
  TELNYX_STT_TRACKS: 'inbound' | 'outbound' | 'both';
  TELNYX_AI_ENABLED: 'true' | 'false';
  TELNYX_AI_MODEL?: string;
  TELNYX_AUTO_ANALYZE_CALLS: 'true' | 'false';
  DEEPGRAM_API_KEY?: string;
  LLM_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  PEXELS_API_KEY?: string;
  FORMS_PUBLIC_BASE_URL?: string;
  // Computed feature flags
  STT_ENABLED: boolean;
  LLM_ENABLED: boolean;
}

const envSchema = z.object({
  // ── Core ──────────────────────────────────────────────────────────────
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // CORS: comma-separated allowed origins. '*' allows any origin (dev only).
  CORS_ORIGIN: z.string().optional(),

  // ── Database ──────────────────────────────────────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid postgres URL'),

  // ── Auth ──────────────────────────────────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // ── Telnyx (required) ─────────────────────────────────────────────────
  TELNYX_API_KEY: z.string().min(1, 'TELNYX_API_KEY is required'),
  TELNYX_PUBLIC_KEY: z.string().min(1, 'TELNYX_PUBLIC_KEY is required (webhook signature verification)'),
  TELNYX_APP_CONNECTION_ID: z.string().min(1, 'TELNYX_APP_CONNECTION_ID is required'),
  TELNYX_SIP_CONNECTION_ID: z.string().min(1, 'TELNYX_SIP_CONNECTION_ID is required'),
  TELNYX_SIP_USERNAME: z.string().min(1, 'TELNYX_SIP_USERNAME is required'),
  TELNYX_SIP_PASSWORD: z.string().min(1, 'TELNYX_SIP_PASSWORD is required'),

  // ── Encryption (required) ─────────────────────────────────────────────
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required (run: openssl rand -base64 32)'),

  // ── Tunnel / public URL (required for webhooks) ───────────────────────
  PUBLIC_URL: z.string().url('PUBLIC_URL must be a valid URL (e.g. https://xxxx.ngrok-free.app)'),

  // ── Branding ──────────────────────────────────────────────────────────
  COMPANY_NAME: z.string().default('Trilogy Care'),

  // ── Telnyx STT (optional overrides, enabled by default) ───────────────
  TELNYX_STT_ENABLED: z.enum(['true', 'false']).default('true'),
  TELNYX_STT_ENGINE: z.string().optional(),
  TELNYX_STT_MODEL: z.string().optional(),
  TELNYX_STT_LANGUAGE: z.string().optional(),
  TELNYX_STT_TRACKS: z.enum(['inbound', 'outbound', 'both']).default('both'),

  // ── Telnyx AI (optional overrides, enabled by default) ────────────────
  TELNYX_AI_ENABLED: z.enum(['true', 'false']).default('true'),
  TELNYX_AI_MODEL: z.string().optional(),

  // ── Auto-analyze calls after recording ───────────────────────────────
  TELNYX_AUTO_ANALYZE_CALLS: z.enum(['true', 'false']).default('false'),

  // ── Legacy env vars (ignored, kept for backward compat) ──────────────
  DEEPGRAM_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // ── Pexels (optional, for Form Builder image search) ──────────────────
  PEXELS_API_KEY: z.string().optional(),

  // ── Forms public base URL (optional, for public form links) ────────────
  FORMS_PUBLIC_BASE_URL: z.string().optional(),
});

let _env: EnvData | null = null;

/**
 * Parse and validate environment variables.
 * Exits with a clear error message on validation failure.
 * Idempotent — returns the same parsed object on repeated calls.
 */
export function loadEnv(): EnvData {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`\n❌ Environment validation failed:\n${issues}\n`);
    process.exit(1);
  }

  _env = result.data as EnvData;

  // ── Feature flag helpers ──────────────────────────────────────────────
  _env.STT_ENABLED = _env.TELNYX_STT_ENABLED === 'true' && Boolean(_env.TELNYX_API_KEY?.trim());
  _env.LLM_ENABLED = _env.TELNYX_AI_ENABLED === 'true' && Boolean(_env.TELNYX_API_KEY?.trim());

  // Log feature flags once at startup
  const flags = [
    `STT: ${_env.STT_ENABLED ? `✅ enabled (Telnyx Call Control, engine: ${_env.TELNYX_STT_ENGINE || 'Deepgram'}, model: ${_env.TELNYX_STT_MODEL || ((_env.TELNYX_STT_ENGINE === 'Telnyx' || _env.TELNYX_STT_ENGINE === 'B') ? 'openai/whisper-large-v3-turbo' : 'nova-3')})` : '⚠️  disabled (set TELNYX_STT_ENABLED=true)'}`,
    `AI case notes: ${_env.LLM_ENABLED ? `✅ enabled (Telnyx AI, model: ${_env.TELNYX_AI_MODEL || 'Qwen/Qwen3-235B-A22B'})` : '⚠️  disabled (set TELNYX_AI_ENABLED=true)'}`,
    `Pexels: ${_env.PEXELS_API_KEY ? '✅ enabled' : '⚠️  disabled (set PEXELS_API_KEY for form image search)'}`,
  ];
  console.info('[env] Feature flags:\n' + flags.map((f) => `  ${f}`).join('\n'));

  return _env;
}
