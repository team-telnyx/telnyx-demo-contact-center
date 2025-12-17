// API Utilities for Next.js
export const getApiProtocol = (): string => {
  return (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_HTTPS === 'true') ? 'https' : 'http';
};

export const getApiBaseUrl = (): string => {
  // Use NEXT_PUBLIC_API_URL if available (for production/Workers),
  // otherwise construct from HOST/PORT (for local development)
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Remove /api suffix if it exists since callers will add it
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '');
  }

  const protocol = getApiProtocol();
  const port = process.env.NEXT_PUBLIC_API_PORT ? `:${process.env.NEXT_PUBLIC_API_PORT}` : '';
  const host = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
  return `${protocol}://${host}${port}`;
};

// For Next.js API routes, we'll use HTTP endpoints instead of websockets
export const getApiUrl = (endpoint: string): string => {
  return `/api/${endpoint}`;
};