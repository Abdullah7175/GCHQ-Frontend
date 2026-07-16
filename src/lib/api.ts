const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export type UserRole = 'hospital' | 'safe_city' | 'hq_1122' | 'vvip' | 'paramedic' | 'admin';

export interface CityOperationalConfig {
  latencySpeedThresholdKmh: number;
  maxConcurrentTransits: number;
  defaultBaselineEtaMinutes: number;
  transitIdPrefix: string;
  enableSurgeProtocol: boolean;
  enableTransitRateKpi: boolean;
  privacyRedactPatientData: boolean;
  commandPriority: number;
}

export interface City {
  id: string;
  name: string;
  code: string;
  province?: string;
  country?: string;
  isActive: boolean;
  operationalConfig: CityOperationalConfig;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  cityId?: string;
  hospitalId?: string;
  providerId?: string;
  sectorId?: string;
  isCityOverseer?: boolean;
  hospital?: { id: string; name: string };
  sector?: { id: string; name: string; code: string };
  city?: City;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getSelectedCityId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('selectedCityId');
}

export function setSelectedCityId(cityId: string) {
  localStorage.setItem('selectedCityId', cityId);
}

export function cityQuery(cityId?: string | null): string {
  const id = cityId ?? getSelectedCityId();
  return id ? `?cityId=${id}` : '';
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (e: any) {
    console.error('Fetch error:', e);
    throw new Error(`Cannot reach API at ${API_URL}. Is the backend running on port 3001? (Error: ${e.message})`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(err.message) ? err.message.join(', ') : (err.message || res.statusText);
    throw new Error(message || 'Request failed');
  }
  return res.json();
}

export async function login(email: string, password: string) {
  const data = await api<{ user: AuthUser; accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('token', data.accessToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  if (data.user.cityId) {
    setSelectedCityId(data.user.cityId);
  }
  return data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('selectedCityId');
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export const roleRoutes: Record<UserRole, string> = {
  hospital: '/hospital',
  safe_city: '/safe-city',
  hq_1122: '/hq',
  vvip: '/vvip',
  paramedic: '/driver',
  admin: '/admin',
};

export async function fetchCities(): Promise<City[]> {
  return api<City[]>('/cities/active');
}

export async function fetchAllCities(): Promise<City[]> {
  return api<City[]>('/cities');
}
