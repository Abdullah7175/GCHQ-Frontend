'use client';

import Link from 'next/link';
import { logout, getStoredUser } from '@/lib/api';
import { CitySelector } from '@/components/CitySelector';
import { useCityContext } from '@/lib/city-context';

const navItems = [
  { href: '/hq', label: '1122 HQ' },
  { href: '/safe-city', label: 'Safe City' },
  { href: '/hospital', label: 'Hospital ER' },
  { href: '/vvip', label: 'VVIP' },
];

export function TopNav({ active }: { active?: string }) {
  const user = getStoredUser();
  const isAdmin = user?.role === 'admin';
  const { cities, cityId, selectCity, canSwitchCity } = useCityContext();

  const linkClass = (href: string) =>
    active === href
      ? 'text-primary font-bold border-b-2 border-primary pb-1'
      : 'text-on-surface-variant font-medium hover:bg-surface-container-low px-3 py-1 rounded';

  return (
    <header className="flex justify-between items-center w-full px-6 h-16 bg-surface-container-lowest border-b border-outline-variant fixed top-0 z-50">
      <div className="flex items-center gap-6">
        {isAdmin ? (
          <Link href="/admin" className="text-2xl font-extrabold text-primary tracking-tighter hover:opacity-80">
            Safe City Lahore
          </Link>
        ) : (
          <span className="text-2xl font-extrabold text-primary tracking-tighter">Safe City Lahore</span>
        )}
        <nav className="hidden md:flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin" className={linkClass('/admin')}>
              Admin
            </Link>
          )}
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {isAdmin && (
          <Link
            href="/admin"
            className={`md:hidden flex items-center gap-1 text-sm px-3 py-1.5 rounded border ${
              active === '/admin'
                ? 'bg-primary text-white border-primary'
                : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Admin
          </Link>
        )}
        {canSwitchCity && cities.length > 0 && (
          <CitySelector cities={cities} cityId={cityId} onChange={selectCity} />
        )}
        <span className="text-sm text-on-surface-variant hidden sm:block">{user?.name}</span>
        <button
          onClick={() => { logout(); window.location.href = '/login'; }}
          className="text-sm text-on-surface-variant hover:text-error px-3 py-1 rounded hover:bg-surface-container-low"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  accent = 'primary',
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: 'primary' | 'tertiary' | 'error' | 'secondary';
}) {
  const borderColors = {
    primary: 'border-primary',
    tertiary: 'border-tertiary',
    error: 'border-error',
    secondary: 'border-secondary-container',
  };
  const textColors = {
    primary: 'text-primary',
    tertiary: 'text-tertiary',
    error: 'text-error',
    secondary: 'text-secondary-container',
  };

  return (
    <div className={`bg-surface-container-lowest p-5 border-l-4 ${borderColors[accent]} rounded shadow-sm`}>
      <p className="text-xs font-bold uppercase text-on-surface-variant mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-mono font-semibold ${textColors[accent]}`}>{value}</span>
        {suffix && <span className="text-sm text-on-surface-variant">{suffix}</span>}
      </div>
    </div>
  );
}

export function ProviderMarker({ shape, color, size = 12 }: { shape: string; color: string; size?: number }) {
  if (shape === 'triangle') {
    return (
      <div
        style={{ borderBottomColor: color, borderLeftWidth: size, borderRightWidth: size, borderBottomWidth: size * 1.6 }}
        className="w-0 h-0 border-l-transparent border-r-transparent"
      />
    );
  }
  if (shape === 'square') {
    return <div style={{ backgroundColor: color, width: size * 1.5, height: size * 1.5 }} />;
  }
  if (shape === 'diamond') {
    return <div style={{ backgroundColor: color, width: size * 1.2, height: size * 1.2 }} className="rotate-45" />;
  }
  if (shape === 'star') {
    return (
      <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 24 24">
        <polygon points="12,2 15,9 22,9 17,14 19,22 12,18 5,22 7,14 2,9 9,9" fill={color} />
      </svg>
    );
  }
  if (shape === 'hexagon') {
    return (
      <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 24 24">
        <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" fill={color} />
      </svg>
    );
  }
  if (shape === 'pentagon') {
    return (
      <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 24 24">
        <polygon points="12,2 21,9 17,21 7,21 3,9" fill={color} />
      </svg>
    );
  }
  if (shape === 'cross') {
    return (
      <svg width={size * 1.5} height={size * 1.5} viewBox="0 0 24 24">
        <rect x="9" y="3" width="6" height="18" fill={color} />
        <rect x="3" y="9" width="18" height="6" fill={color} />
      </svg>
    );
  }
  return <div style={{ backgroundColor: color, width: size, height: size }} className="rounded-full" />;
}
