'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('HomePage: useEffect - isLoading:', isLoading, 'isLoggedIn:', isLoggedIn);
    if (!isLoading && !isLoggedIn) {
      console.log('HomePage: Redirecting to login');
      router.push('/login');
    }
  }, [isLoggedIn, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null; // Will redirect
  }

  return <Dashboard />;
}
