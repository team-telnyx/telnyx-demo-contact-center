'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '../../src/store/hooks';
import { login } from '../../src/features/auth/authSlice';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
// Use relative URLs (no API_BASE needed)

export default function GoogleSignIn({ onError }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const buttonRef = useRef(null);

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      const res = await fetch(`/api/users/google-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Google sign-in failed');
      }

      const data = await res.json();

      // Store token and set auth state
      localStorage.setItem('token', data.token);
      dispatch(login.fulfilled(data, '', {}));

      const loginRole = data.role || 'agent';
      router.push(loginRole === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      onError?.(err.message);
    }
  }, [dispatch, router, onError]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 400,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [handleCredentialResponse]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300 dark:border-gray-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-3 text-gray-400 dark:bg-gray-900 dark:text-gray-500">or</span>
        </div>
      </div>
      <div ref={buttonRef} className="flex justify-center" />
    </>
  );
}
