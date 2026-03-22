'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '../../../src/store/hooks';
import { login } from '../../../src/features/auth/authSlice';
import GoogleSignIn from '../../components/GoogleSignIn';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [googleError, setGoogleError] = useState('');
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await dispatch(login({ username, password })).unwrap();
      if (result.token) {
        const loginRole = result.role || 'agent';
        router.push(loginRole === 'admin' ? '/admin' : '/dashboard');
      }
    } catch (err) {
      // Error is handled by Redux state
    }
  };

  const displayError = error || googleError;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {displayError && (
        <div className="rounded-md border-2 border-red-400 bg-red-50 px-4 py-3 text-center text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {displayError}
        </div>
      )}

      <div>
        <label htmlFor="username" className="mb-1 block text-sm font-medium text-telnyx-green">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          placeholder="Enter your username"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-telnyx-green">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          placeholder="Enter your password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-telnyx-green px-4 py-2.5 font-semibold text-white transition-colors hover:bg-telnyx-green-light disabled:opacity-50"
      >
        {isLoading ? 'Signing in...' : 'Login'}
      </button>

      <GoogleSignIn onError={setGoogleError} />

      <Link
        href="/register"
        className="block w-full rounded-lg border border-telnyx-green px-4 py-2.5 text-center font-semibold text-telnyx-green transition-colors hover:bg-telnyx-green hover:text-white"
      >
        Register
      </Link>
    </form>
  );
}
