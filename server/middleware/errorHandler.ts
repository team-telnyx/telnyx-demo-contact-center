import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

export default logger;

/**
 * Centralized error handler. Expects errors with { status, message } or falls back to 500.
 */
export function errorHandler(err: any, req: any, res: any, _next: any) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } }, message);
  } else {
    logger.warn({ err, req: { method: req.method, url: req.url } }, message);
  }

  const isDev = process.env.NODE_ENV !== 'production';

  res.status(status).json({
    error: status >= 500 && !isDev ? 'Internal server error' : message,
    ...(isDev && status >= 500 && { stack: err.stack }),
  });
}
