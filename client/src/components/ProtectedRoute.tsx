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
    // Only redirect if auth is loaded and user is not logged in AND no token cookie exists
    // This prevents redirect loops when middleware has already validated the token
    if (!isLoading && !isLoggedIn && !hasTokenCookie()) {
      console.log('ProtectedRoute: User not authenticated, redirecting to login');
      // Use window.location for hard redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
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

  // If no token cookie and not logged in, don't render (redirect happening)
  if (!isLoggedIn && !hasTokenCookie()) {
    return null;
  }

  // Either logged in OR token cookie exists (middleware validated), render children
  return <>{children}</>;
}
