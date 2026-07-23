'use client';

import { logout, getStoredUser } from '@/lib/api';
import { CitySelector } from '@/components/CitySelector';
import { useCityContext } from '@/lib/city-context';
import { BrandLogo } from '@/components/BrandLogo';

// Each role maps to exactly ONE portal — no cross-portal navigation
const ROLE_PORTAL: Record<string, { label: string; icon: string; href: string }> = {
  admin:      { label: 'System Admin',    icon: 'settings',        href: '/admin' },
  hq_1122:    { label: 'HQ',              icon: 'hub',             href: '/hq' },
  safe_city:  { label: 'Safecity',        icon: 'traffic',         href: '/safe-city' },
  hospital:   { label: 'Hospital',        icon: 'local_hospital',  href: '/hospital' },
  paramedic:  { label: 'Driver',          icon: 'ambulance',       href: '/driver' },
  vvip:       { label: 'VVIP Command',    icon: 'shield_person',   href: '/vvip' },
};

export function TopNav({ active }: { active?: string }) {
  const user = getStoredUser();
  const { cities, cityId, selectCity, canSwitchCity } = useCityContext();
  const portal = user?.role ? ROLE_PORTAL[user.role] : null;
  const sectorLabel = (user?.role === 'safe_city' || user?.role === 'hq_1122') && user?.permittedSectorIds?.length
    ? `${user.permittedSectorIds.length} sectors`
    : user?.sector
      ? `Sector ${user.sector.code}`
      : null;

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
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <BrandLogo size={30} />
          <div className="flex items-center gap-2 min-w-0">
            <div>
              <span className="text-sm font-bold text-slate-900 tracking-tight block leading-none">GCHQ</span>
              <span className="text-[9px] text-slate-400 font-medium hidden sm:block">Green Corridor Headquarters</span>
            </div>
            {portal && (
              <>
                <span className="text-slate-300 font-light hidden xs:inline sm:inline">/</span>
                <span
                  className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-lg truncate max-w-[110px] sm:max-w-none"
                  style={{ background: 'linear-gradient(180deg,#e8f7ef,#d9f0e4)', color: '#0f7a45', border: '1px solid rgba(15,122,69,0.18)' }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}
                  >
                    {portal.icon}
                  </span>
                  <span className="truncate">{portal.label}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
            {sectorLabel && (
              <span className="text-[10px] font-semibold text-slate-500">{sectorLabel}</span>
            )}
            <span
              className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
              style={{ background: '#e8f7ef', color: '#0f7a45' }}
            >
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
          <button
            onClick={async () => { await logout(); window.location.href = '/login'; }}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 min-h-10 px-2.5 sm:px-3 py-1.5 rounded-xl transition-colors"
            style={{ border: '1px solid rgba(15,122,69,0.14)', background: '#fff' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>logout</span>
            <span className="hidden sm:inline">Sign out</span>
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
export function ProviderMarker({
  shape,
  color,
  size = 12,
  letter,
}: {
  shape: string;
  color: string;
  size?: number;
  letter?: string;
}) {
  const box = size * 1.5;
  const label = letter ? letter.toUpperCase().slice(0, 3) : '';
  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: Math.max(7, Math.round(box * 0.38)),
    lineHeight: 1,
    color: '#ffffff',
    textShadow: '0 1px 2px rgba(0,0,0,0.55)',
    pointerEvents: 'none',
  };

  let shapeNode: React.ReactNode;
  if (shape === 'triangle') {
    shapeNode = (
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          borderBottomColor: color,
          borderLeftWidth: box / 2,
          borderRightWidth: box / 2,
          borderBottomWidth: box,
        }}
        className="w-0 h-0 border-l-transparent border-r-transparent"
      />
    );
  } else if (shape === 'square') {
    shapeNode = <div style={{ backgroundColor: color, width: '100%', height: '100%' }} className="rounded-sm border-2 border-white box-border" />;
  } else if (shape === 'diamond') {
    shapeNode = (
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ backgroundColor: color, width: box * 0.72, height: box * 0.72 }} className="rotate-45 border-2 border-white box-border" />
      </div>
    );
  } else if (shape === 'star') {
    shapeNode = (
      <svg width={box} height={box} viewBox="0 0 24 24">
        <polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" fill={color} stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  } else if (shape === 'hexagon') {
    shapeNode = (
      <svg width={box} height={box} viewBox="0 0 24 24">
        <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill={color} stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  } else if (shape === 'pentagon') {
    shapeNode = (
      <svg width={box} height={box} viewBox="0 0 24 24">
        <polygon points="12,2 21,9 17,21 7,21 3,9" fill={color} stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    );
  } else if (shape === 'cross') {
    shapeNode = (
      <svg width={box} height={box} viewBox="0 0 24 24">
        <rect x="9" y="3" width="6" height="18" fill={color} stroke="#ffffff" strokeWidth="1" />
        <rect x="3" y="9" width="18" height="6" fill={color} stroke="#ffffff" strokeWidth="1" />
      </svg>
    );
  } else {
    shapeNode = <div style={{ backgroundColor: color, width: '100%', height: '100%' }} className="rounded-full border-2 border-white box-border" />;
  }

  return (
    <div className="relative shrink-0" style={{ width: box, height: box, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
      {shapeNode}
      {label ? <span style={labelStyle}>{label}</span> : null}
    </div>
  );
}
