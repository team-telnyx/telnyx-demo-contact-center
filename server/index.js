import { httpServerHandler } from 'cloudflare:node';
import app from './app.js';
import { ContactCenterRoom } from './durable-objects/ContactCenterRoom.js';

const ensureProcessEnv = (env) => {
  if (typeof process === 'undefined') {
    globalThis.process = { env: {} };
  }

  const setEnv = (key, value) => {
    if (!key) return;
    if (!process.env[key] && value !== undefined && value !== null) {
      process.env[key] = value;
    }
  };

  setEnv('SESSION_SECRET', env?.SESSION_SECRET);
  setEnv('TELNYX_API', env?.TELNYX_API_KEY || env?.TELNYX_API);
  setEnv('TELNYX_API_KEY', env?.TELNYX_API_KEY);
  setEnv('JWT_SECRET', env?.JWT_SECRET);
  setEnv('ANTHROPIC_API_KEY', env?.ANTHROPIC_API_KEY);
  setEnv('ENCRYPTION_SECRET', env?.ENCRYPTION_SECRET);
  setEnv('APP_HOST', env?.APP_HOST || 'contactcenter.telnyx.solutions');
  setEnv('APP_PORT', env?.APP_PORT || '443');
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      if (!env?.CONTACT_CENTER_ROOM) {
        return new Response('Durable Object unavailable', { status: 500 });
      }
      if (url.pathname === '/api/ws') {
        const roomId = env.CONTACT_CENTER_ROOM.idFromName('contact-center-global');
        const stub = env.CONTACT_CENTER_ROOM.get(roomId);
        return stub.fetch(request);
      }
      return new Response('Not Found', { status: 404 });
    }

    ensureProcessEnv(env);
    globalThis.__CLOUDFLARE_ENV__ = env;
    globalThis.__CLOUDFLARE_CTX__ = ctx;

    return httpServerHandler(app)(request, env, ctx);
  }
};

export { ContactCenterRoom };
