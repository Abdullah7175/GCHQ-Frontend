'use client';

import { useState } from 'react';
import { login, roleRoutes } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('hospital@services.pk');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { user } = await login(email, password);
      window.location.href = roleRoutes[user.role];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const demos = [
    { label: 'Hospital ER', email: 'hospital@services.pk' },
    { label: 'Safe City', email: 'safecity@psca.pk' },
    { label: 'HQ Overseer', email: 'hq@1122.pk' },
    { label: 'CSR Mall Rd', email: 'csr.mall@1122.pk' },
    { label: 'VVIP Command', email: 'vvip@gov.pk' },
    { label: 'Paramedic/Driver', email: 'driver@1122.pk' },
    { label: 'Admin', email: 'admin@gchq.pk' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-primary tracking-tight">Safe City Lahore</h1>
          <p className="text-on-surface-variant text-sm mt-1">Green Corridor Emergency System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-outline-variant rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              required
            />
          </div>
          {error && <p className="text-error text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary font-bold py-3 rounded hover:brightness-110 transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-outline-variant">
          <p className="text-xs font-bold uppercase text-on-surface-variant mb-3">Demo Accounts</p>
          <div className="grid grid-cols-2 gap-2">
            {demos.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => setEmail(d.email)}
                className="text-left text-xs px-3 py-2 border border-outline-variant rounded hover:bg-surface-container-low transition-colors"
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-on-surface-variant mt-3">Password: password123</p>
        </div>
      </div>
    </div>
  );
}
