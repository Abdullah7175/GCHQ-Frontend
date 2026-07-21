'use client';

import { ProviderMarker } from '@/components/ui';

export const PROVIDER_SHAPES = [
  { value: 'circle',   label: 'Circle' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'square',   label: 'Square' },
  { value: 'diamond',  label: 'Diamond' },
  { value: 'star',     label: 'Star' },
  { value: 'hexagon',  label: 'Hexagon' },
  { value: 'pentagon', label: 'Pentagon' },
  { value: 'cross',    label: 'Cross' },
] as const;

export const FLEET_COLOR_PRESETS = [
  '#d93343', '#ba1a1a', '#f59e0b', '#2563eb', '#0056b3',
  '#16a34a', '#00663c', '#705575', '#7c3aed', '#0891b2',
  '#ea580c', '#64748b',
];

export const GRID_STATUS_OPTIONS = [
  { value: 'flowing',    label: 'Flowing — traffic moving well' },
  { value: 'moderate',   label: 'Moderate — some congestion' },
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
  { value: 'en_route',  label: 'En Route' },
  { value: 'busy',      label: 'Busy at Hospital' },
  { value: 'offline',   label: 'Offline' },
];

export const USER_ROLE_OPTIONS = [
  { value: 'admin',      label: 'System Admin' },
  { value: 'hq_1122',   label: 'HQ' },
  { value: 'safe_city',  label: 'Safecity' },
  { value: 'hospital',   label: 'Hospital' },
  { value: 'paramedic',  label: 'Driver' },
  { value: 'vvip',       label: 'VVIP Command' },
];

export function FormField({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-gray-400 block leading-snug">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value, onChange, placeholder, type = 'text', required, step,
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
      className="neo-input"
      style={{ fontFamily: type === 'number' ? 'var(--font-jetbrains), monospace' : undefined }}
    />
  );
}

export function SelectInput({
  value, onChange, options, placeholder, required,
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
      className="neo-input cursor-pointer"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function ColorPicker({
  value, onChange, label = 'Color',
}: {
  value: string; onChange: (color: string) => void; label?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#d93343'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-xl cursor-pointer p-0.5 neo-inset border-0"
          title={label}
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#d93343"
          className="neo-input flex-1 font-mono text-xs"
        />
        <div className="w-8 h-8 rounded-full shrink-0"
          style={{ backgroundColor: value || '#d93343', boxShadow: '2px 2px 6px rgba(0,0,0,0.15)' }} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FLEET_COLOR_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${value === c ? 'ring-2 ring-green-600 ring-offset-1' : ''}`}
            style={{ backgroundColor: c, boxShadow: '1px 1px 4px rgba(0,0,0,0.2)' }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

export function ShapePicker({
  value, color, letter, onChange,
}: {
  value: string; color: string; letter?: string; onChange: (shape: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {PROVIDER_SHAPES.map((s) => (
        <button
          key={s.value}
          type="button"
          onClick={() => onChange(s.value)}
          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all ${
            value === s.value ? 'neo-inset' : 'neo-btn'
          }`}
        >
          <ProviderMarker shape={s.value} color={color || '#d93343'} size={14} letter={letter} />
          <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

export function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="neo-inset rounded-xl p-4 text-xs text-gray-600 space-y-1">
      <p className="font-bold text-green-700 uppercase tracking-widest text-[10px] flex items-center gap-1 mb-2">
        <span className="material-symbols-outlined text-[12px]">info</span>
        {title}
      </p>
      {children}
    </div>
  );
}
