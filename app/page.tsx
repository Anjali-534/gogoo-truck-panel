'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';

export default function TruckLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/gogoo/panel-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panel: 'truck', email, password }),
      });

      const text = await res.text();
      let body: Record<string, string> = {};
      try { body = JSON.parse(text); } catch {}

      if (res.ok) {
        localStorage.setItem('truck_admin_token', body.token);
        localStorage.setItem('truck_admin_role', body.role);
        localStorage.setItem('truck_admin_email', body.email);
        toast.success('Welcome to Truck Panel!');
        setTimeout(() => router.push('/truck'), 500);
        return;
      }

      toast.error(body.error || 'Invalid credentials');
    } catch {
      toast.error('Connection failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0F1F33' }}>
      <Toaster position="top-right" />
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🚛</div>
          <h1 className="text-2xl font-bold text-white">gogoo</h1>
          <p className="text-sm mt-1 font-semibold" style={{ color: '#60A5FA' }}>Truck Operations Panel</p>
          <p className="text-xs mt-0.5" style={{ color: '#93C5FD' }}>gogoo Logistics</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{ backgroundColor: '#1E3A5F', borderColor: '#2D5A8E' }}>
          <h2 className="text-lg font-semibold text-white mb-6">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
                style={{ color: '#93C5FD' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="truck@bogie.in"
                className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none
                  transition-colors placeholder-blue-900"
                style={{ backgroundColor: '#0F1F33', border: '1px solid #2D5A8E' }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
                style={{ color: '#93C5FD' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-white text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: '#0F1F33', border: '1px solid #2D5A8E' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all
                disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#3B82F6' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In to Truck Panel'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: '#2D5A8E' }}>
            <p className="text-xs" style={{ color: '#4B6A8B' }}>Master admin credentials also work here</p>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#2D5A8E' }}>
          gogoo Truck Operations · Aggarwal Publicity and Marketing Pvt. Ltd.
        </p>
      </div>
    </div>
  );
}
