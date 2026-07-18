const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** Browser traffic goes through same-origin BFF so the backend URL/token stay off Network/localStorage. */
function browserApiBase(): string {
  return '/api/gchq';
}

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
  mapCenterLat?: number | null;
  mapCenterLng?: number | null;
  mapDefaultZoom?: number | null;
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

export function getSelectedCityId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('selectedCityId');
}

export function setSelectedCityId(cityId: string) {
  sessionStorage.setItem('selectedCityId', cityId);
}

export function cityQuery(cityId?: string | null): string {
  const id = cityId ?? getSelectedCityId();
  return id ? `?cityId=${id}` : '';
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = typeof window === 'undefined' ? BACKEND_URL : browserApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Network error';
    throw new Error(`Cannot reach API. (${message})`);
  }
  if (res.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      clearClientSession();
      window.location.href = '/login';
    }
    throw new Error('Session expired — please sign in again');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(err.message) ? err.message.join(', ') : (err.message || res.statusText);
    throw new Error(message || 'Request failed');
  }
  // DELETE / empty success bodies must not call res.json() — Nest returns 200 with no content
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function login(email: string, password: string) {
  // Same-origin endpoint — backend URL and JWT never appear in the browser Network panel as direct calls.
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await res.json().catch(() => ({ message: 'Login failed' }));
  if (!res.ok) {
    throw new Error(Array.isArray(data.message) ? data.message.join(', ') : (data.message || 'Invalid credentials'));
  }

  sessionStorage.setItem('user', JSON.stringify(data.user));
  // Migrate away from legacy localStorage token storage
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (data.user.cityId) {
    setSelectedCityId(data.user.cityId);
  }
  return data as { user: AuthUser; expiresIn?: string; tokenType?: string };
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
  } catch {
    // ignore network errors on logout
  }
  clearClientSession();
}

function clearClientSession() {
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('selectedCityId');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('selectedCityId');
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
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
