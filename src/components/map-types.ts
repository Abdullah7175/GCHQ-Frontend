export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
  shape?: string;
  sublabel?: string;
}

export interface MapRoute {
  id: string;
  positions: [number, number][];
  color?: string;
}

export const LAHORE_CENTER: [number, number] = [31.5497, 74.3436];

export function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fallbackPosition(index: number, center: [number, number] = LAHORE_CENTER): [number, number] {
  const angle = (index * 47) % 360;
  const rad = (angle * Math.PI) / 180;
  const offset = 0.02 + (index % 5) * 0.008;
  return [center[0] + Math.cos(rad) * offset, center[1] + Math.sin(rad) * offset];
}
