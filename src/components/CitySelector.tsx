'use client';

import { City } from '@/lib/api';

export function CitySelector({
  cities,
  cityId,
  onChange,
  className = '',
}: {
  cities: City[];
  cityId: string | null;
  onChange: (id: string) => void;
  className?: string;
}) {
  if (cities.length <= 1) {
    const city = cities[0];
    if (!city) return null;
    return (
      <span className={`text-sm font-medium text-on-surface-variant ${className}`}>
        {city.name} ({city.code})
      </span>
    );
  }

  return (
    <select
      value={cityId ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-outline-variant rounded px-3 py-1.5 text-sm bg-white focus:ring-2 focus:ring-primary focus:outline-none ${className}`}
    >
      <option value="" disabled>Select city</option>
      {cities.map((c) => (
        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
      ))}
    </select>
  );
}
