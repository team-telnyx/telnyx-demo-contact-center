'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '../../../src/store/hooks';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { role, token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    if (token && role && role !== 'admin') {
      router.push('/dashboard');
    }
  }, [role, token, router]);

  if (!role) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-8 w-8 border-4 border-telnyx-green border-t-transparent rounded-full" />
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-red-500">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }

  return children;
}
