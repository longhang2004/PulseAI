'use client';

import React, { useState, useEffect } from 'react';
import LoginView from './components/login-view';
import DashboardView from './components/dashboard-view';
import { disconnectSocket } from './lib/socket';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read from localStorage on mount
    const savedToken = localStorage.getItem('pulseai_token');
    const savedUser = localStorage.getItem('pulseai_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem('pulseai_token');
        localStorage.removeItem('pulseai_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (newToken: string, newUser: { email: string }) => {
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('pulseai_token');
    localStorage.removeItem('pulseai_user');
    disconnectSocket();
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#070708] text-zinc-500 font-sans">
        <div className="h-6 w-6 rounded-full border-2 border-zinc-800 border-t-cyan-400 animate-spin mb-3"></div>
        <span className="text-xs uppercase tracking-widest font-semibold">PulseAI Booting...</span>
      </div>
    );
  }

  if (!token || !user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <DashboardView 
      token={token} 
      user={user} 
      onLogout={handleLogout} 
    />
  );
}
