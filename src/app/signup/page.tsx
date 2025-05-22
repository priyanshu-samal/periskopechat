'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import Link from 'next/link';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          name: name,
        }
      }
    });

    if (error) {
      console.error('Signup error:', error);
      setError(error.message);
    } else {
      setMessage('Verification email sent! Please check your inbox.');
      setEmail('');
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-white">
      <section className="px-8 py-6 mt-4 text-left bg-white shadow-lg rounded-lg border border-gray-200">
        <header>
          <h3 className="text-2xl font-bold text-center text-gray-800">Sign Up</h3>
        </header>
        <form onSubmit={handleSignUp}>
          <div className="mt-6">
            <div>
              <label className="block text-gray-700" htmlFor="email">Email</label>
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-green-600 text-black"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="mt-4">
              <label className="block text-gray-700" htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                placeholder="Name"
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-green-600 text-black"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="mt-4">
              <label className="block text-gray-700" htmlFor="password">Password</label>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-2 mt-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-green-600 text-black"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-baseline justify-center mt-6">
              <button
                type="submit"
                className="px-6 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-opacity-50"
                disabled={loading}
              >
                {loading ? 'Signing Up...' : 'Sign Up'}
              </button>
            </div>
          </div>
        </form>

        {error && <p className="mt-4 text-center text-red-500 text-sm">{error}</p>}
        {message && <p className="mt-4 text-center text-green-600 text-sm">{message}</p>}

         <div className="mt-4 text-center text-gray-600">
            <p>Already have an account? <Link href="/login" className="text-green-600 hover:underline focus:outline-none">Login</Link></p>
         </div>
      </section>
    </main>
  );
} 