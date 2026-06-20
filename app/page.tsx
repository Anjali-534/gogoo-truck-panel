'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('truck_panel_token', data.token || data.access_token || '');
      router.push('/truck');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0F1F33' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="text-6xl mb-4">🚛</div>
          <h1 className="text-3xl font-bold text-white">gogoo</h1>
          <p className="text-sm mt-1 font-medium" style={{ color: '#60A5FA' }}>Truck Operations Panel</p>
          <p className="text-xs mt-0.5" style={{ color: '#93C5FD' }}>gogoo Logistics</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{ backgroundColor: '#1E3A5F', borderColor: '#2D5A8E' }}>
          <h2 className="text-xl font-semibold text-white mb-1">Sign in</h2>
          <p className="text-sm mb-6" style={{ color: '#93C5FD' }}>Access the logistics operations dashboard</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950 border border-red-800 text-red-400 text-sm">{error}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#93C5FD' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@gogoo.in"
                required
                className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors placeholder-blue-900"
                style={{ backgroundColor: '#0F1F33', border: '1px solid #2D5A8E' }}
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5" style={{ color: '#93C5FD' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: '#0F1F33', border: '1px solid #2D5A8E' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 mt-2"
              style={{ backgroundColor: '#3B82F6' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-center text-xs mt-6" style={{ color: '#4B6A8B' }}>
            gogoo Truck Operations — Admin Access
          </p>
        </div>
      </div>
    </div>
  );
}
