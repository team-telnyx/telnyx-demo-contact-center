/**
 * Cloudflare Workers Adapter for Express
 * Uses the nodejs_compat flag and cloudflare:node bridge
 * to run Express.js directly on Workers (as of Sept 2025)
 *
 * Reference: https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/
 */

import { httpServerHandler } from 'cloudflare:node';

// Import the existing Express app
// We'll need to modify server.js to export the app
export default {
  async fetch(request, env, ctx) {
    // Make D1 database available to the Express app via request context
    // The Express routes can access it via req.env.DB
    return httpServerHandler(request, env, ctx);
  }
};
