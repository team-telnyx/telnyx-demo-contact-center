'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Helper to check if token cookie exists
function hasTokenCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('token='));
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if auth is loaded and user is not logged in
    if (!isLoading && !isLoggedIn) {
      // Check for token cookie as fallback
      const hasToken = hasTokenCookie();

      if (!hasToken) {
        console.log('ProtectedRoute: No authentication found, redirecting to login');
        // Use window.location for hard redirect to clear any cached state
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      } else {
        console.log('ProtectedRoute: Token cookie exists but AuthContext not loaded - waiting for auth sync');
      }
    }
  }, [isLoggedIn, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  // If not logged in and no token cookie, don't render (redirect happening)
  if (!isLoggedIn && !hasTokenCookie()) {
    console.log('ProtectedRoute: Blocking render - no authentication');
    return null;
  }

  // Render children if logged in OR token cookie exists (will sync on next render)
  return <>{children}</>;
}
