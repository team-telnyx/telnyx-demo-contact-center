import Telnyx from 'telnyx';
import { env } from '../config/env.js';
import Settings from '../../models/Settings.js';

let cachedClient = null;
let cachedSettings = {};
let cachedAt = 0;
const CACHE_TTL = 60000; // 60 seconds

async function loadOrgSettings() {
  if (Date.now() - cachedAt < CACHE_TTL && cachedSettings.orgTelnyxApiKey) {
    return cachedSettings;
  }

  try {
    const rows = await Settings.findAll({
      where: { key: ['orgTelnyxApiKey', 'orgTelnyxPublicKey'] },
    });
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    cachedSettings = settings;
    cachedAt = Date.now();
    cachedClient = null;
    return settings;
  } catch {
    return cachedSettings;
  }
}

/**
 * Get a Telnyx SDK client using the org API key from the Settings table.
 */
export async function getOrgTelnyxClient() {
  const settings = await loadOrgSettings();
  const apiKey = settings.orgTelnyxApiKey;

  if (!apiKey) {
    throw new Error('No organization Telnyx API key configured. An admin must set it in Admin > Settings.');
  }

  if (cachedClient) return cachedClient;
  cachedClient = new Telnyx({ apiKey });
  return cachedClient;
}

/**
 * Get the webhook base URL from WEBHOOK_BASE_URL env var.
 */
export function getWebhookBaseUrl() {
  return env.WEBHOOK_BASE_URL;
}

/**
 * Invalidate the cache (e.g., after settings are updated).
 */
export function invalidateOrgCache() {
  cachedAt = 0;
  cachedClient = null;
  cachedSettings = {};
}
