export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
  /** Fleet shapes, or 'hospital' for medical plus pin */
  shape?: string;
  sublabel?: string;
}

export interface MapRoute {
  id: string;
  positions: [number, number][];
  color?: string;
}

export const LAHORE_CENTER: [number, number] = [31.5497, 74.3436];
export const KARACHI_CENTER: [number, number] = [24.8607, 67.0011];
export const ISLAMABAD_CENTER: [number, number] = [33.6844, 73.0479];

/** Fallback map centers by city code when DB fields are empty */
export const CITY_MAP_DEFAULTS: Record<string, { center: [number, number]; zoom: number }> = {
  LHE: { center: LAHORE_CENTER, zoom: 12 },
  ISB: { center: ISLAMABAD_CENTER, zoom: 12 },
  KHI: { center: KARACHI_CENTER, zoom: 12 },
  RWP: { center: [33.5651, 73.0169], zoom: 12 },
  FSD: { center: [31.4504, 73.1350], zoom: 12 },
  PEW: { center: [34.0151, 71.5249], zoom: 12 },
  QTA: { center: [30.1798, 66.9750], zoom: 12 },
  MUL: { center: [30.1575, 71.5249], zoom: 12 },
};

export function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveCityMapView(city?: {
  code?: string;
  mapCenterLat?: number | string | null;
  mapCenterLng?: number | string | null;
  mapDefaultZoom?: number | null;
} | null): { center: [number, number]; zoom: number } {
  const lat = parseCoord(city?.mapCenterLat);
  const lng = parseCoord(city?.mapCenterLng);
  const zoom = city?.mapDefaultZoom != null && Number.isFinite(Number(city.mapDefaultZoom))
    ? Number(city.mapDefaultZoom)
    : 12;

  if (lat != null && lng != null) {
    return { center: [lat, lng], zoom };
  }

  const code = (city?.code || '').toUpperCase();
  if (code && CITY_MAP_DEFAULTS[code]) {
    return CITY_MAP_DEFAULTS[code];
  }

  return { center: LAHORE_CENTER, zoom: 12 };
}

export function fallbackPosition(index: number, center: [number, number] = LAHORE_CENTER): [number, number] {
  const angle = (index * 47) % 360;
  const rad = (angle * Math.PI) / 180;
  const offset = 0.02 + (index % 5) * 0.008;
  return [center[0] + Math.cos(rad) * offset, center[1] + Math.sin(rad) * offset];
}
