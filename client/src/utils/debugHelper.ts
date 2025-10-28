// Debug helper for browser compatibility issues
export const debugAuth = (): void => {
  console.log('=== AUTH DEBUG ===');
  console.log('localStorage available:', typeof Storage !== 'undefined');
  console.log('Current URL:', window.location.href);
  console.log('User Agent:', navigator.userAgent);

  try {
    const token = localStorage.getItem('token');
    console.log('Token exists:', !!token);
    if (token) {
      console.log('Token length:', token.length);
    }
  } catch (error) {
    console.error('localStorage error:', error);
  }

  console.log('=== END AUTH DEBUG ===');
};