// API Utilities for Next.js
export const getApiProtocol = (): string => {
  return (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_HTTPS === 'true') ? 'https' : 'http';
};

export const getApiBaseUrl = (): string => {
  const protocol = getApiProtocol();
  return `${protocol}://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}`;
};

// For Next.js API routes, we'll use HTTP endpoints instead of websockets
export const getApiUrl = (endpoint: string): string => {
  return `/api/${endpoint}`;
};