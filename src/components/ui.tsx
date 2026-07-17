'use client';

import { logout, getStoredUser } from '@/lib/api';
import { CitySelector } from '@/components/CitySelector';
import { useCityContext } from '@/lib/city-context';
import { BrandLogo } from '@/components/BrandLogo';

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
        background: 'rgba(255,255,255,0.92)',
        borderBottom: '1px solid rgba(15,122,69,0.12)',
        boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="w-full max-w-screen-2xl mx-auto px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <BrandLogo size={34} />
          <div className="flex items-center gap-2">
            <div>
              <span className="text-sm font-bold text-slate-900 tracking-tight block leading-none">GCHQ</span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:block">Green Corridor Headquarters</span>
            </div>
            {portal && (
              <>
                <span className="text-slate-300 font-light">/</span>
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
                  style={{ background: 'linear-gradient(180deg,#e8f7ef,#d9f0e4)', color: '#0f7a45', border: '1px solid rgba(15,122,69,0.18)' }}
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

        <div className="flex items-center gap-2">
          {canSwitchCity && cities.length > 0 && user?.role !== 'admin' && (
            <CitySelector cities={cities} cityId={cityId} onChange={selectCity} />
          )}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: '#f4faf6', border: '1px solid rgba(15,122,69,0.14)' }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#d9f0e4' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 11, color: '#0f7a45', fontVariationSettings: "'FILL' 1" }}
              >
                person
              </span>
            </div>
            <span className="text-xs font-medium text-slate-700">{user?.name}</span>
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: '#e8f7ef', color: '#0f7a45' }}
            >
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
          <button
            onClick={async () => { await logout(); window.location.href = '/login'; }}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-xl transition-colors"
            style={{ border: '1px solid rgba(15,122,69,0.14)', background: '#fff' }}
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
    primary:   { text: '#0f7a45', icon_bg: '#e8f7ef', border: '#86efac' },
    tertiary:  { text: '#1d4ed8', icon_bg: '#e8f0fe', border: '#93c5fd' },
    error:     { text: '#991b1b', icon_bg: '#fde8e8', border: '#fca5a5' },
    secondary: { text: '#92400e', icon_bg: '#fff4e0', border: '#fcd34d' },
  };
  const s = styles[accent];

  return (
    <div className="dash-card p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
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
        {suffix && <span className="text-xs text-slate-400 font-medium">{suffix}</span>}
      </div>
      <div className="mt-3 h-0.5 rounded-full" style={{ background: s.border }} />
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
