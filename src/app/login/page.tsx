'use client';

import { useState } from 'react';
import { login, roleRoutes } from '@/lib/api';
import MD5 from 'crypto-js/md5';
import { BrandLogo } from '@/components/BrandLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const md5Password = MD5(password).toString();
      const { user } = await login(email, md5Password);
      window.location.href = roleRoutes[user.role];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(135deg, #062a1a 0%, #0b3d28 38%, #0f4d34 62%, #123a52 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(72,187,120,0.35), transparent 35%), radial-gradient(circle at 80% 10%, rgba(56,189,248,0.18), transparent 30%), radial-gradient(circle at 70% 80%, rgba(15,122,69,0.35), transparent 40%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-4 text-center">
          <div>
            <BrandLogo size={160} />
          </div>
          <h1 className="-mt-8 text-4xl font-bold tracking-tight text-white">GCHQ</h1>
          <p className="text-sm text-emerald-100/80 mt-4 font-medium">
            Green Corridor Headquarters
          </p>
        </div>

        <div className="rounded-3xl p-8 border border-white/15 bg-white/95 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-all font-medium placeholder:text-slate-400"
                placeholder="user@domain.pk"
                required
                autoComplete="username"
                maxLength={254}
                inputMode="email"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-600 transition-all font-medium placeholder:text-slate-400 pr-12"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  maxLength={128}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-sm text-red-700 bg-red-50 font-medium flex items-center gap-2 border border-red-100">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-2"
              style={{
                background: 'linear-gradient(180deg, #129a55, #0f7a45)',
                boxShadow: '0 10px 24px rgba(15, 122, 69, 0.35)',
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white/70" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Sign In to Command
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white/45 mt-6 tracking-wide">
          Authorized personnel only · Encrypted session
        </p>
      </div>
    </div>
  );
}
