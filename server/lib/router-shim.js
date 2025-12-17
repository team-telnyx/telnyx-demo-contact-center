/**
 * Minimal Express Router shim for Cloudflare Workers
 *
 * This provides just enough Express Router API to make our routes work
 * without importing the full Express package (which has incompatible dependencies)
 */

class RouterShim {
  constructor() {
    this.stack = [];
  }

  // Middleware registration
  use(...args) {
    // Handle middleware (no path) or path-based middleware
    let path = '/';
    let middleware = args[0];

    if (typeof args[0] === 'string') {
      path = args[0];
      middleware = args[1];
    }

    this.stack.push({
      route: null,
      handle: middleware,
      path: path
    });

    return this;
  }

  // HTTP method handlers
  get(path, ...handlers) {
    return this._addRoute('get', path, handlers);
  }

  post(path, ...handlers) {
    return this._addRoute('post', path, handlers);
  }

  put(path, ...handlers) {
    return this._addRoute('put', path, handlers);
  }

  delete(path, ...handlers) {
    return this._addRoute('delete', path, handlers);
  }

  patch(path, ...handlers) {
    return this._addRoute('patch', path, handlers);
  }

  options(path, ...handlers) {
    return this._addRoute('options', path, handlers);
  }

  _addRoute(method, path, handlers) {
    const route = {
      path: path,
      methods: {
        [method]: true
      },
      stack: handlers.map(handler => ({
        handle: handler
      }))
    };

    this.stack.push({
      route: route,
      handle: handlers[0],
      path: path
    });

    return this;
  }
}

// Create a shim for the express module
const expressShim = {
  Router: () => new RouterShim(),
  json: () => (req, res, next) => next(),
  urlencoded: () => (req, res, next) => next(),
  static: () => (req, res, next) => next()
};

export default expressShim;
export { RouterShim };
