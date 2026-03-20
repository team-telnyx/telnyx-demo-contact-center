import { z } from 'zod';
import crypto from 'crypto';
import 'dotenv/config';

const envSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z.string().length(64, 'ENCRYPTION_KEY must be 64 hex characters (32 bytes)'),
  TELNYX_API: z.string().min(1, 'TELNYX_API key is required'),
  TELNYX_CONNECTION_ID: z.string().min(1, 'TELNYX_CONNECTION_ID is required'),
  TELNYX_VOICE_APP_ID: z.string().min(1, 'TELNYX_VOICE_APP_ID is required'),
  APP_HOST: z.string().min(1),
  APP_PORT: z.string().min(1),
  DB_HOST: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  CORS_ORIGINS: z.string().default('*').transform(s => s.split(',')),
  SESSION_SECRET: z.string().min(32).default(() => crypto.randomBytes(32).toString('hex')),
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('Environment validation failed:');
  console.error(error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n'));
  process.exit(1);
}

export { env };
