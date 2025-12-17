/**
 * Cloudflare Worker entry that adapts our Router-shim based "Express" routes
 * to the Workers runtime.  This recreates enough of Express's req/res API to
 * keep the existing route modules working without depending on Node internals.
 */

import { ContactCenterRoom } from './durable-objects/ContactCenterRoom.js';
import { getPrismaClient, getPrismaClientLocal } from './lib/prisma.js';

import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import inboundVoiceRoutes from './routes/inboundVoiceRoutes.prisma.js';
import outboundVoiceRoutes from './routes/outboundVoiceRoutes.prisma.js';
import telnyxRoutes from './routes/telnyxRoutes.js';

if (typeof process === 'undefined') {
  globalThis.process = { env: {} };
}

const ROUTES = [
  { basePath: '/api/users', router: userRoutes },
  { basePath: '/api/conversations', router: conversationRoutes },
  { basePath: '/api/voice', router: inboundVoiceRoutes },
  { basePath: '/api/voice', router: outboundVoiceRoutes },
  { basePath: '/api/telnyx', router: telnyxRoutes },
];

const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'https://contactcenter.telnyx.solutions',
  'https://telnyx.solutions'
];

const ensureProcessEnv = (env) => {
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

const createPrismaClient = (env) => {
  if (env?.DB) {
    if (!env.__prismaClient) {
      env.__prismaClient = getPrismaClient(env.DB);
    }
    return env.__prismaClient;
  }
  if (!globalThis.__localPrismaClient) {
    globalThis.__localPrismaClient = getPrismaClientLocal();
  }
  return globalThis.__localPrismaClient;
};

const applyCors = (response, request) => {
  const origin = request.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.append('Vary', 'Origin');
  return response;
};

const normalizePath = (path) => {
  if (!path) return '/';
  let p = path.startsWith('/') ? path : `/${path}`;
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
};

const splitPath = (path) => (path === '/' ? [] : path.split('/').filter(Boolean).map(decodeURIComponent));

const matchRoute = (pattern, actualPath) => {
  const pat = normalizePath(pattern);
  const real = normalizePath(actualPath);
  if (pat === real) {
    return { matches: true, params: {} };
  }
  const patParts = splitPath(pat);
  const pathParts = splitPath(real);
  if (patParts.length !== pathParts.length) {
    return { matches: false, params: {} };
  }
  const params = {};
  for (let i = 0; i < patParts.length; i += 1) {
    const token = patParts[i];
    const value = pathParts[i];
    if (token.startsWith(':')) {
      params[token.substring(1)] = value;
    } else if (token !== value) {
      return { matches: false, params: {} };
    }
  }
  return { matches: true, params };
};

const parseBody = async (request) => {
  if (['GET', 'HEAD'].includes(request.method)) {
    return {};
  }
  const clone = request.clone();
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      return await clone.json();
    }
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await clone.text();
      return Object.fromEntries(new URLSearchParams(text).entries());
    }
    if (contentType.includes('text/plain')) {
      return await clone.text();
    }
  } catch (error) {
    console.error('Body parse error:', error);
  }
  return {};
};

const createResponse = () => {
  const headers = new Headers();
  let statusCode = 200;
  let resolved = false;
  let finalResponse;
  let resolveResponse;
  const encoder = new TextEncoder();
  let streamWriter = null;
  let streamReadable = null;

  const responsePromise = new Promise((resolve) => {
    resolveResponse = resolve;
  });

  const finalize = (body, overrideStatus) => {
    if (resolved) {
      return finalResponse;
    }
    const status = overrideStatus ?? statusCode;
    const response = body instanceof Response ? body : new Response(body, { status, headers });
    finalResponse = response;
    resolved = true;
    resolveResponse(response);
    return response;
  };

  const res = {
    status(code) {
      statusCode = Number(code) || 200;
      return res;
    },
    json(data) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      return finalize(JSON.stringify(data));
    },
    send(data) {
      if (data === undefined || data === null) {
        return finalize(null);
      }
      if (typeof data === 'object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
        return res.json(data);
      }
      return finalize(data);
    },
    sendStatus(code) {
      statusCode = Number(code) || 200;
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'text/plain');
      }
      return finalize(String(statusCode), statusCode);
    },
    setHeader(key, value) {
      headers.set(key, value);
      return res;
    },
    header(key, value) {
      if (value === undefined) {
        return headers.get(key);
      }
      headers.set(key, value);
      return res;
    },
    write(chunk) {
      if (!streamWriter) {
        const { readable, writable } = new TransformStream();
        streamReadable = readable;
        streamWriter = writable.getWriter();
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'text/event-stream');
        }
        finalize(new Response(streamReadable, { status: statusCode, headers }));
      }
      const payload = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
      streamWriter.write(payload);
      return res;
    },
    end(chunk) {
      if (chunk !== undefined) {
        res.write(chunk);
      }
      if (streamWriter) {
        streamWriter.close();
      }
      if (!resolved) {
        finalize(null);
      }
      return res;
    },
    get headersSent() {
      return resolved;
    },
    _finalize: finalize,
    _responsePromise: responsePromise
  };

  return res;
};

const createRequestResponse = async (request, env, ctx) => {
  const url = new URL(request.url);
  const prisma = createPrismaClient(env);
  const headers = Object.fromEntries(request.headers.entries());
  const body = await parseBody(request);

  const req = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    originalUrl: `${url.pathname}${url.search}`,
    path: url.pathname,
    baseUrl: '',
    query: Object.fromEntries(url.searchParams.entries()),
    params: {},
    headers,
    header(name) {
      return headers[name.toLowerCase()];
    },
    get(name) {
      return headers[name.toLowerCase()];
    },
    protocol: url.protocol.replace(':', ''),
    secure: url.protocol === 'https:',
    hostname: url.hostname,
    ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '',
    env,
    ctx,
    prisma,
    body,
    session: {},
    app: { get: () => null },
    on() {},
    param(name) {
      return req.params[name];
    }
  };

  const res = createResponse();
  req.res = res;
  res.req = req;
  globalThis.__WORKER_PRISMA__ = prisma;
  return { req, res };
};

const restoreRequest = (req, originalUrl, originalPath, originalBaseUrl, originalParams) => {
  req.url = originalUrl;
  req.path = originalPath;
  req.baseUrl = originalBaseUrl;
  req.params = { ...originalParams };
};

const runHandler = (handler, req, res) => new Promise((resolve, reject) => {
  let finished = false;
  const next = (err) => {
    if (finished) return;
    finished = true;
    if (err) reject(err);
    else resolve();
  };

  try {
    const result = handler(req, res, next);
    if (result && typeof result.then === 'function') {
      result.then(() => {
        if (!finished && handler.length < 3) {
          finished = true;
          resolve();
        }
      }).catch((error) => {
        if (!finished) {
          finished = true;
          reject(error);
        }
      });
    } else if (handler.length < 3) {
      finished = true;
      resolve();
    }
  } catch (error) {
    if (!finished) {
      finished = true;
      reject(error);
    }
  }
});

const handleRouter = async (req, res, router, basePath) => {
  const fullPath = normalizePath(req.path);
  const base = normalizePath(basePath);
  if (fullPath !== base && !fullPath.startsWith(`${base}/`)) {
    return null;
  }

  let subPath = fullPath.slice(base.length) || '/';
  subPath = normalizePath(subPath);

  const originalUrl = req.url;
  const originalPath = req.path;
  const originalBaseUrl = req.baseUrl || '';
  const originalParams = { ...req.params };

  req.baseUrl = originalBaseUrl + base;
  req.url = subPath;
  req.path = subPath;

  const stack = router.stack || [];

  for (const layer of stack) {
    if (!layer.route) {
      try {
        await runHandler(layer.handle, req, res);
      } catch (error) {
        console.error('Middleware error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
        restoreRequest(req, originalUrl, originalPath, originalBaseUrl, originalParams);
        return res._responsePromise;
      }
      if (res.headersSent) {
        restoreRequest(req, originalUrl, originalPath, originalBaseUrl, originalParams);
        return res._responsePromise;
      }
      continue;
    }

    const route = layer.route;
    const match = matchRoute(route.path, subPath);
    if (!match.matches) {
      continue;
    }

    const method = (req.method || 'get').toLowerCase();
    if (!route.methods || !route.methods[method]) {
      continue;
    }

    req.params = { ...originalParams, ...match.params };

    const handlers = route.stack || [];
    for (const handlerLayer of handlers) {
      try {
        await runHandler(handlerLayer.handle, req, res);
      } catch (error) {
        console.error('Route handler error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
        restoreRequest(req, originalUrl, originalPath, originalBaseUrl, originalParams);
        return res._responsePromise;
      }
      if (res.headersSent) {
        restoreRequest(req, originalUrl, originalPath, originalBaseUrl, originalParams);
        return res._responsePromise;
      }
    }

    restoreRequest(req, originalUrl, originalPath, originalBaseUrl, originalParams);
    if (!res.headersSent) {
      res._finalize(null);
    }
    return res._responsePromise;
  }

  restoreRequest(req, originalUrl, originalPath, originalBaseUrl, originalParams);
  return null;
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      if (url.pathname === '/api/ws') {
        if (!env?.CONTACT_CENTER_ROOM) {
          return new Response('Durable Object unavailable', { status: 500 });
        }
        const roomId = env.CONTACT_CENTER_ROOM.idFromName('contact-center-global');
        const stub = env.CONTACT_CENTER_ROOM.get(roomId);
        return stub.fetch(request);
      }
      return new Response('Not Found', { status: 404 });
    }

    if (request.method === 'OPTIONS') {
      return applyCors(new Response(null, { status: 204 }), request);
    }

    if (url.pathname === '/health') {
      const response = new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env?.NODE_ENV || 'production'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      return applyCors(response, request);
    }

    ensureProcessEnv(env);
    globalThis.__CLOUDFLARE_ENV__ = env;
    globalThis.__CLOUDFLARE_CTX__ = ctx;

    try {
      const { req, res } = await createRequestResponse(request, env, ctx);

      for (const { basePath, router } of ROUTES) {
        const handled = await handleRouter(req, res, router, basePath);
        if (handled) {
          const response = await handled;
          return applyCors(response, request);
        }
      }

      if (!res.headersSent) {
        res.status(404).json({ error: 'Not Found', path: req.path });
      }
      const finalResponse = await res._responsePromise;
      return applyCors(finalResponse, request);
    } catch (error) {
      console.error('Worker error:', error);
      const response = new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
      return applyCors(response, request);
    }
  }
};

export { ContactCenterRoom };
