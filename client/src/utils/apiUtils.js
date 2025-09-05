// API Utilities for protocol detection
export const getApiProtocol = () => {
  return (process.env.NODE_ENV === 'production' || process.env.REACT_APP_HTTPS === 'true') ? 'https' : 'http';
};

export const getApiBaseUrl = () => {
  const protocol = getApiProtocol();
  return `${protocol}://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`;
};

export const getWebSocketUrl = () => {
  const protocol = getApiProtocol() === 'https' ? 'wss' : 'ws';
  return `${protocol}://${process.env.REACT_APP_API_HOST}:${process.env.REACT_APP_API_PORT}`;
};