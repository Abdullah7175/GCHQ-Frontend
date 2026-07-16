'use client';

import Link from 'next/link';
import { logout, getStoredUser } from '@/lib/api';
import { CitySelector } from '@/components/CitySelector';
import { useCityContext } from '@/lib/city-context';

// Each role maps to exactly ONE portal — no cross-portal navigation
const ROLE_PORTAL: Record<string, { label: string; icon: string; href: string }> = {
  admin:      { label: 'System Admin',    icon: 'settings',        href: '/admin' },
  hq_1122:    { label: '1122 HQ Ops',     icon: 'hub',             href: '/hq' },
  safe_city:  { label: 'Safe City Ctrl',  icon: 'traffic',         href: '/safe-city' },
  hospital:   { label: 'Hospital ER',     icon: 'local_hospital',  href: '/hospital' },
  paramedic:  { label: 'Paramedic App',   icon: 'ambulance',       href: '/driver' },
  vvip:       { label: 'VVIP Command',    icon: 'shield_person',   href: '/vvip' },
};

export function TopNav({ active }: { active?: string }) {
  const user = getStoredUser();
  const { cities, cityId, selectCity, canSwitchCity } = useCityContext();
  const portal = user?.role ? ROLE_PORTAL[user.role] : null;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div className="w-full max-w-screen-2xl mx-auto px-5 flex items-center justify-between gap-4">

        {/* Logo + current portal only */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#16a34a' }}
          >
            <span
              className="material-symbols-outlined text-white"
              style={{ fontSize: 17, fontVariationSettings: "'FILL' 1" }}
            >
              emergency
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 tracking-tight">Green Corridor</span>
            {portal && (
              <>
                <span className="text-gray-300 font-light">/</span>
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md"
                  style={{ background: '#f0fdf4', color: '#15803d' }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}
                  >
                    {portal.icon}
                  </span>
                  {portal.label}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {canSwitchCity && cities.length > 0 && user?.role !== 'admin' && (
            <CitySelector cities={cities} cityId={cityId} onChange={selectCity} />
          )}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#dcfce7' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 11, color: '#15803d', fontVariationSettings: "'FILL' 1" }}
              >
                person
              </span>
            </div>
            <span className="text-xs font-medium text-gray-700">{user?.name}</span>
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: '#f0fdf4', color: '#15803d' }}
            >
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
          <button
            onClick={() => { logout(); window.location.href = '/login'; }}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: '1px solid #e5e7eb', background: '#f9fafb' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>logout</span>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

/* ── StatCard ──────────────────────────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  suffix,
  accent = 'primary',
  icon,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: 'primary' | 'tertiary' | 'error' | 'secondary';
  icon?: string;
}) {
  const styles = {
    primary:   { bg: '#f0fdf4', text: '#15803d', icon_bg: '#dcfce7', border: '#bbf7d0' },
    tertiary:  { bg: '#eff6ff', text: '#1d4ed8', icon_bg: '#dbeafe', border: '#93c5fd' },
    error:     { bg: '#fef2f2', text: '#991b1b', icon_bg: '#fee2e2', border: '#fca5a5' },
    secondary: { bg: '#fffbeb', text: '#92400e', icon_bg: '#fef3c7', border: '#fcd34d' },
  };
  const s = styles[accent];

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: s.icon_bg }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, color: s.text, fontVariationSettings: "'FILL' 1" }}
            >
              {icon}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-black font-mono" style={{ color: s.text }}>{value}</span>
        {suffix && <span className="text-xs text-gray-400 font-medium">{suffix}</span>}
      </div>
      <div
        className="mt-3 h-0.5 rounded-full"
        style={{ background: s.border }}
      />
    </div>
  );
}

/* ── ProviderMarker ────────────────────────────────────────────────────────── */
export function ProviderMarker({ shape, color, size = 12 }: { shape: string; color: string; size?: number }) {
  if (shape === 'triangle') {
    return (
      <div
        style={{ borderBottomColor: color, borderLeftWidth: size, borderRightWidth: size, borderBottomWidth: size * 1.6 }}
        className="w-0 h-0 border-l-transparent border-r-transparent"
      />
    );
  }
  if (shape === 'square')  return <div style={{ backgroundColor: color, width: size * 1.5, height: size * 1.5 }} className="rounded-sm" />;
  if (shape === 'diamond') return <div style={{ backgroundColor: color, width: size * 1.2, height: size * 1.2 }} className="rotate-45" />;
  if (shape === 'star') return (
    <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 24 24">
      <polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" fill={color} />
    </svg>
  );
  if (shape === 'hexagon') return (
    <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 24 24">
      <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill={color} />
    </svg>
  );
  if (shape === 'cross') return (
    <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="18" fill={color} />
      <rect x="3" y="9" width="18" height="6" fill={color} />
    </svg>
  );
  return <div style={{ backgroundColor: color, width: size, height: size }} className="rounded-full" />;
}
