'use client';

import { ProviderMarker } from '@/components/ui';

export const PROVIDER_SHAPES = [
  { value: 'circle', label: 'Circle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'star', label: 'Star' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'pentagon', label: 'Pentagon' },
  { value: 'cross', label: 'Cross' },
] as const;

export const FLEET_COLOR_PRESETS = [
  '#d93343', '#ba1a1a', '#f59e0b', '#2563eb', '#0056b3',
  '#16a34a', '#00663c', '#705575', '#7c3aed', '#0891b2',
  '#ea580c', '#64748b',
];

export const GRID_STATUS_OPTIONS = [
  { value: 'flowing', label: 'Flowing — traffic moving well' },
  { value: 'moderate', label: 'Moderate — some congestion' },
  { value: 'saturating', label: 'Saturating — heavy traffic' },
  { value: 'gridlocked', label: 'Gridlocked — standstill' },
];

export const SEVERITY_OPTIONS = [
  { value: 1, label: 'Emergency Alert (Critical)' },
  { value: 2, label: 'High (Urgent)' },
  { value: 3, label: 'Moderate' },
  { value: 4, label: 'Low' },
];

export const TRIAGE_PRIORITY_OPTIONS = [
  { value: 1, label: 'Priority 1 — Immediate (Code Red)' },
  { value: 2, label: 'Priority 2 — Urgent (Code Amber)' },
  { value: 3, label: 'Priority 3 — Standard (Code Green)' },
  { value: 4, label: 'Priority 4 — Non-urgent' },
];

export const AMBULANCE_STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'en_route', label: 'En Route' },
  { value: 'busy', label: 'Busy at Hospital' },
  { value: 'offline', label: 'Offline' },
];

export const USER_ROLE_OPTIONS = [
  { value: 'admin', label: 'System Admin' },
  { value: 'hq_1122', label: '1122 HQ Supervisor' },
  { value: 'safe_city', label: 'Safe City Controller' },
  { value: 'hospital', label: 'Hospital ER Staff' },
  { value: 'paramedic', label: 'Paramedic / Driver' },
  { value: 'vvip', label: 'VVIP Command' },
];

export function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold uppercase text-on-surface-variant">
        {label}{required && ' *'}
      </span>
      {children}
      {hint && <span className="text-[11px] text-on-surface-variant block">{hint}</span>}
    </label>
  );
}

const inputClass = 'w-full border border-outline-variant rounded-lg px-3 py-2 text-sm bg-white focus:border-primary focus:outline-none';

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
  step,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      step={step}
      placeholder={placeholder}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    />
  );
}

export function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <select
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function ColorPicker({
  value,
  onChange,
  label = 'Color',
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || '#d93343'}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-10 rounded border border-outline-variant cursor-pointer p-0.5 bg-white"
          title={label}
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#d93343"
          className={`${inputClass} flex-1 font-mono`}
        />
        <div className="w-8 h-8 rounded-full border-2 border-white shadow" style={{ backgroundColor: value || '#d93343' }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FLEET_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? 'border-primary ring-2 ring-primary/30' : 'border-white shadow'}`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

export function ShapePicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (shape: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PROVIDER_SHAPES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors ${
            value === s.value ? 'border-primary bg-primary-container/10' : 'border-outline-variant hover:bg-surface-container-low'
          }`}
        >
          <ProviderMarker shape={s.value} color={color || '#d93343'} size={14} />
          <span className="text-[10px] text-on-surface-variant">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

export function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 text-xs text-on-surface-variant space-y-1">
      <p className="font-bold text-primary uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}
