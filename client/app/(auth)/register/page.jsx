'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import GoogleSignIn from '../../components/GoogleSignIn';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    phoneNumber: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `https://${process.env.NEXT_PUBLIC_API_HOST}:${process.env.NEXT_PUBLIC_API_PORT}/api/users/register`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        }
      );

      if (!response.ok) {
        const data = await response.text();
        throw new Error(data || 'Registration failed');
      }

      router.push('/login');
    } catch (err) {
      setError('Registration failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fields = [
    { name: 'firstName', label: 'First Name', type: 'text' },
    { name: 'lastName', label: 'Last Name', type: 'text' },
    { name: 'username', label: 'Username', type: 'text' },
    { name: 'password', label: 'Password', type: 'password' },
    { name: 'phoneNumber', label: 'Phone Number', type: 'tel' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {fields.map(({ name, label, type }) => (
        <div key={name}>
          <label htmlFor={name} className="mb-1 block text-sm font-medium text-telnyx-green">
            {label}
          </label>
          <input
            id={name}
            name={name}
            type={type}
            value={formData[name]}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-telnyx-green focus:outline-none focus:ring-1 focus:ring-telnyx-green"
            placeholder={`Enter your ${label.toLowerCase()}`}
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-telnyx-green px-4 py-2.5 font-semibold text-white transition-colors hover:bg-telnyx-green-light disabled:opacity-50"
      >
        {isLoading ? 'Registering...' : 'Register'}
      </button>

      <GoogleSignIn onError={setError} />

      <p className="text-center text-sm text-gray-400">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-telnyx-green hover:text-telnyx-green-light">
          Login
        </Link>
      </p>
    </form>
  );
}
