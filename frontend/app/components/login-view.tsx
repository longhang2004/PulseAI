'use client';

import React, { useState } from 'react';
import { Terminal, Shield, ArrowRight } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (token: string, user: { email: string }) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const targetEmail = email.trim() || 'developer@pulseai.dev';

    try {
      const response = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003') + '/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: targetEmail }),
        }
      );

      const json = await response.json();
      if (json.success && json.data?.token) {
        const token = json.data.token;
        const user = json.data.user;
        localStorage.setItem('pulseai_token', token);
        localStorage.setItem('pulseai_user', JSON.stringify(user));
        onLoginSuccess(token, user);
      } else {
        setError(json.error || 'Authentication failed. Please verify API Service status.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to reach backend API. Ensure api-service is running on port 3003.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center bg-[#070708] p-6 text-zinc-100">
      {/* Background Neon Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 backdrop-blur-xl shadow-2xl relative">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Logo */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
            PulseAI Platform
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Production Observability & AI Diagnosis Portal
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-900/30 bg-red-950/20 p-3.5 text-xs text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Work Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="e.g. developer@pulseai.dev"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 transition-all focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium py-3 text-sm transition-all duration-200 cursor-pointer shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Access Dashboard</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-zinc-600 uppercase tracking-widest border-t border-zinc-800/60 pt-6">
          <Terminal className="h-3 w-3" />
          <span>Secured via JWT Token</span>
        </div>
      </div>
    </div>
  );
}
