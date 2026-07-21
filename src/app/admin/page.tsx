'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopNav, ProviderMarker } from '@/components/ui';
import { api, City, CityOperationalConfig, fetchAllCities, cityQuery } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import MD5 from 'crypto-js/md5';
import {
  FormField, TextInput, SelectInput, ColorPicker, ShapePicker, InfoBox,
  GRID_STATUS_OPTIONS, SEVERITY_OPTIONS, TRIAGE_PRIORITY_OPTIONS,
  AMBULANCE_STATUS_OPTIONS, USER_ROLE_OPTIONS,
} from '@/components/admin/form-primitives';
import { useAdminStore } from '@/lib/store/useAdminStore';
import { getAdminColumns } from '@/lib/admin-table-columns';

type Entity = Record<string, unknown>;

interface RefData {
  cities: City[];
  providers: Entity[];
  hospitals: Entity[];
  sectors: Entity[];
  paramedics: Entity[];
  emergencyTypes: Entity[];
  latencyRules: Entity[];
}

const RESOURCES = [
  { key: 'cities',          label: 'Cities',          icon: 'location_city',   hint: 'Define operational cities first' },
  { key: 'providers',       label: 'Fleet Providers', icon: 'corporate_fare',  hint: 'Ambulance fleets (1122, Edhi…)' },
  { key: 'sectors',         label: 'Sectors',         icon: 'grid_4x4',        hint: 'Traffic zones within a city' },
  { key: 'hospitals',       label: 'Hospitals',       icon: 'local_hospital',  hint: 'ER destinations with GPS coords' },
  { key: 'emergency-types', label: 'Emergency Types', icon: 'emergency',       hint: 'Clinical categories with severity' },
  { key: 'triage-codes',    label: 'Triage Codes',    icon: 'label',           hint: 'Priority codes (Code Red, etc.)' },
  { key: 'users',           label: 'Users',           icon: 'group',           hint: 'Staff accounts by role' },
  { key: 'ambulances',      label: 'Ambulances',      icon: 'ambulance',       hint: 'Register units & assign drivers' },
  { key: 'transits',        label: 'Cases',           icon: 'emergency_share', hint: 'All corridors — any status; delete to free drivers/units' },
  { key: 'audit-logs',      label: 'Audit Logs',      icon: 'policy',          hint: 'Who created, updated, or deleted records (logins, admin changes, transits)' },
  { key: 'latency-rules',   label: 'Latency Rules',   icon: 'timer',           hint: 'ETA & login breach thresholds — city/sector/role scoped' },
  { key: 'latency-recipients', label: 'Alert Contacts', icon: 'contact_phone', hint: 'SMS/WhatsApp recipients when a latency rule fires' },
  { key: 'latency-breaches', label: 'Latency Log',    icon: 'warning',         hint: 'Recorded ETA and user-presence breaches' },
  { key: 'messaging-providers', label: 'Messaging API', icon: 'sms',          hint: 'Encrypted SMS / WhatsApp API credentials for breach alerts' },
];

const READ_ONLY_RESOURCES = new Set(['transits', 'audit-logs', 'latency-breaches']);
const NO_DELETE_RESOURCES = new Set(['audit-logs', 'latency-breaches']);

const CITY_SCOPED = ['hospitals', 'sectors', 'ambulances', 'latency-rules'];

const DEFAULT_CITY_CONFIG: CityOperationalConfig = {
  maxConcurrentTransits: 50,
  latencySpeedThresholdKmh: 10,
  defaultBaselineEtaMinutes: 15,
  transitIdPrefix: '',
  enableSurgeProtocol: true,
  enableTransitRateKpi: true,
  privacyRedactPatientData: true,
  commandPriority: 1,
  geofenceAutoCompleteEnabled: false,
  geofenceAutoCompleteDelaySeconds: 10,
};

function cityOptions(cities: City[]) {
  return cities.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
}

function getCityConfig(form: Entity): CityOperationalConfig {
  return { ...DEFAULT_CITY_CONFIG, ...((form.operationalConfig as CityOperationalConfig) || {}) };
}

// Render a cell value intelligently
function CellValue({ col, value }: { col: string; value: unknown }) {
  if (value == null || value === '') {
    return <span className="text-gray-400">—</span>;
  }
  const str = String(value);
  if (col === 'color' && str.startsWith('#')) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded border border-gray-200 shrink-0" style={{ backgroundColor: str }} />
        <span className="font-mono text-[11px] text-gray-500">{str}</span>
      </div>
    );
  }
  if (col === 'status') {
    const map: Record<string, string> = {
      available: 'pill-green', en_route: 'pill-blue', busy: 'pill-amber', offline: 'pill-grey',
      pending: 'pill-amber', arrived: 'pill-green', completed: 'pill-grey', cancelled: 'pill-grey',
    };
    return <span className={`pill ${map[str] || 'pill-grey'}`}>{str.replace('_', ' ')}</span>;
  }
  if (col === 'role') {
    const map: Record<string, string> = { admin: 'pill-purple', hq_1122: 'pill-green', safe_city: 'pill-amber', hospital: 'pill-blue', paramedic: 'pill-red', vvip: 'pill-grey' };
    return <span className={`pill ${map[str] || 'pill-grey'}`}>{str.replace('_', ' ')}</span>;
  }
  if (col === 'priority' || col === 'severityLevel') {
    const colors = ['', 'pill-red', 'pill-amber', 'pill-green', 'pill-grey'];
    return <span className={`pill ${colors[Number(str)] || 'pill-grey'}`}>P{str}</span>;
  }
  if (col === 'code' || col === 'unitNumber') {
    return <span className="font-mono text-[11px] text-gray-500">{str}</span>;
  }
  return <span className="text-gray-800">{str.slice(0, 40)}{str.length > 40 ? '…' : ''}</span>;
}

export default function AdminPage() {
  const { ready } = useAuthGuard('admin');
  const { cityId: navCityId } = useCityContext();
  const {
    activeResource: active, items, form, editingId, formOpen, isFetching, refs, page, limit, total, totalPages,
    setActiveResource, setForm, setEditingId, setFormOpen, setPage, setLimit, setRefs, fetchItems, resetForm
  } = useAdminStore();

  const [saveError, setSaveError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [msgTestPhone, setMsgTestPhone] = useState('');
  const [msgTestMessage, setMsgTestMessage] = useState('[GCHQ] Test — your messaging API is configured correctly.');
  const [msgTestLoading, setMsgTestLoading] = useState(false);
  const [msgTestResult, setMsgTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const formCityId = (form.cityId as string) || navCityId || refs.cities[0]?.id || '';

  function asList(res: unknown): Entity[] {
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object' && Array.isArray((res as { data?: Entity[] }).data)) {
      return (res as { data: Entity[] }).data;
    }
    return [];
  }

  const loadRefs = useCallback(async () => {
    const cities = await fetchAllCities();
    const [providersRes, usersRes, hospitalsRes, sectorsRes, emergencyTypesRes, latencyRulesRes] = await Promise.all([
      api<unknown>('/providers'),
      api<unknown>('/users?page=1&limit=500'),
      api<unknown>('/hospitals'),
      api<unknown>('/sectors'),
      api<unknown>('/emergency-types'),
      api<unknown>('/latency-rules?page=1&limit=500'),
    ]);
    const providers = asList(providersRes);
    const users = asList(usersRes);
    const hospitals = asList(hospitalsRes);
    const sectors = asList(sectorsRes);
    const emergencyTypes = asList(emergencyTypesRes);
    const latencyRules = asList(latencyRulesRes);
    setRefs({
      cities,
      providers,
      hospitals,
      sectors,
      paramedics: users.filter((u) => u.role === 'paramedic'),
      emergencyTypes,
      latencyRules,
    } as RefData);
    return cities;
  }, [setRefs]);

  const refreshAll = useCallback(async () => {
    if (!ready) return;
    setLoadError('');
    try { 
      await loadRefs(); 
      await fetchItems(null, false); 
    }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Failed to load'); }
  }, [ready, loadRefs, fetchItems, active]);

  useEffect(() => { refreshAll(); }, [refreshAll, page]);

  function switchResource(key: string) {
    setActiveResource(key);
    setSaveError('');
    setMsgTestResult(null);
  }

  async function handleTestMessaging() {
    const phone = msgTestPhone.trim();
    if (!phone || !/^\+?\d+$/.test(phone)) {
      setMsgTestResult({ ok: false, text: 'Enter a valid phone (+ and digits only, e.g. +923001234567 or 03331234567).' });
      return;
    }
    const inlineUrl = String(form.apiUrl || '').trim();
    const inlineSecret = String(form.secretKey || '').trim();
    if (!editingId && (!inlineUrl || !inlineSecret)) {
      setMsgTestResult({ ok: false, text: 'Fill in API URL and secret key above to test before saving.' });
      return;
    }

    setMsgTestLoading(true);
    setMsgTestResult(null);
    try {
      const body: Record<string, string> = { phone, message: msgTestMessage.trim() || undefined! };
      if (editingId) body.providerId = editingId;
      if (inlineUrl) body.apiUrl = inlineUrl;
      if (inlineSecret) body.secretKey = inlineSecret;
      if (form.channel) body.channel = String(form.channel);
      if (form.authFieldName) body.authFieldName = String(form.authFieldName);

      const res = await api<{
        ok: boolean;
        error?: string;
        responseBody?: string;
        statusCode?: number;
        phoneUsed?: string;
      }>('/messaging-providers/test', { method: 'POST', body: JSON.stringify(body) });

      if (res.ok) {
        const detail = [res.responseBody?.slice(0, 240), res.statusCode ? `HTTP ${res.statusCode}` : ''].filter(Boolean).join(' · ');
        setMsgTestResult({
          ok: true,
          text: `Test message sent to ${res.phoneUsed ?? phone}.${detail ? ` ${detail}` : ''}`,
        });
      } else {
        setMsgTestResult({
          ok: false,
          text: [res.error, res.responseBody?.slice(0, 280)].filter(Boolean).join(' — ') || 'Provider rejected the test message',
        });
      }
    } catch (err) {
      setMsgTestResult({ ok: false, text: err instanceof Error ? err.message : 'Test request failed' });
    } finally {
      setMsgTestLoading(false);
    }
  }

  function startEdit(item: Entity) {
    setEditingId(item.id as string);
    const copy = { ...item };
    if (active === 'users' && (item.role === 'safe_city' || item.role === 'hq_1122') && !Array.isArray(item.permittedSectorIds) && item.sectorId) {
      copy.permittedSectorIds = [item.sectorId as string];
    }
    if (active === 'cities' && item.operationalConfig) copy.operationalConfig = { ...(item.operationalConfig as object) };
    if (active === 'hospitals' && Array.isArray(item.emergencyTypes)) {
      copy.emergencyTypeIds = (item.emergencyTypes as Entity[]).map((t) => t.id as string);
    }
    if (active === 'ambulances' && Array.isArray(item.assignedDrivers)) {
      copy.driverIds = (item.assignedDrivers as Entity[]).map((driver) => driver.id as string);
    }
    if (active === 'messaging-providers') {
      copy.apiUrl = '';
      copy.secretKey = '';
    }
    setForm(copy);
    setFormOpen(true);
  }

  function openNew() { setForm({}); setEditingId(null); setSaveError(''); setFormOpen(true); }

  function buildPayload(): Entity {
    switch (active) {
      case 'cities': {
        const cfg = getCityConfig(form);
        return {
          name: form.name,
          code: String(form.code || '').toUpperCase(),
          province: form.province || undefined,
          country: form.country || 'Pakistan',
          mapCenterLat: form.mapCenterLat !== '' && form.mapCenterLat != null ? Number(form.mapCenterLat) : undefined,
          mapCenterLng: form.mapCenterLng !== '' && form.mapCenterLng != null ? Number(form.mapCenterLng) : undefined,
          mapDefaultZoom: form.mapDefaultZoom != null && form.mapDefaultZoom !== '' ? Number(form.mapDefaultZoom) : 12,
          operationalConfig: { ...cfg, transitIdPrefix: cfg.transitIdPrefix || String(form.code || '').toUpperCase() },
        };
      }
      case 'providers':
        return {
          name: form.name,
          code: String(form.code || '').toUpperCase(),
          shape: form.shape || 'circle',
          color: form.color || '#d93343',
          markerLetter: String(form.markerLetter || '').toUpperCase().slice(0, 3) || undefined,
          description: form.description || undefined,
        };
      case 'sectors':
        return { name: form.name, code: form.code, cityId: form.cityId || formCityId, color: form.color || '#0056b3', gridStatus: form.gridStatus || 'moderate',
          latitude: form.latitude ? Number(form.latitude) : undefined, longitude: form.longitude ? Number(form.longitude) : undefined };
      case 'hospitals':
        return { name: form.name, cityId: form.cityId || formCityId, address: form.address || undefined,
          latitude: form.latitude ? Number(form.latitude) : undefined, longitude: form.longitude ? Number(form.longitude) : undefined,
          sectorId: form.sectorId || undefined,
          specialties: typeof form.specialties === 'string' ? (form.specialties as string).split(',').map((s) => s.trim()).filter(Boolean) : Array.isArray(form.specialties) ? form.specialties : undefined,
          emergencyTypeIds: Array.isArray(form.emergencyTypeIds) ? form.emergencyTypeIds : [] };
      case 'emergency-types':
        return { name: form.name, code: String(form.code || '').toUpperCase(), description: form.description || undefined, severityLevel: Number(form.severityLevel) || 3 };
      case 'triage-codes':
        return { name: form.name, code: String(form.code || '').toUpperCase(), color: form.color || '#ba1a1a', priority: Number(form.priority) || 1, description: form.description || undefined };
      case 'users': {
        const role = (form.role as string) || 'hospital';
        if (role === 'hospital' && !form.hospitalId) {
          // keep payload building; validation happens in handleSave
        }
        const opsRole = role === 'hq_1122' || role === 'safe_city' || role === 'vvip';
        return {
          name: form.name,
          email: form.email,
          ...(form.password ? { password: MD5(String(form.password)).toString() } : {}),
          role,
          cityId: form.cityId || undefined,
          hospitalId: role === 'hospital' ? form.hospitalId || undefined : undefined,
          providerId: role === 'paramedic' ? form.providerId || undefined : undefined,
          sectorId:
            role === 'safe_city' || role === 'hq_1122'
              ? ((form.permittedSectorIds as string[] | undefined)?.[0] || undefined)
              : opsRole
                ? form.sectorId || undefined
                : null,
          permittedSectorIds:
            role === 'safe_city' || role === 'hq_1122'
              ? Array.isArray(form.permittedSectorIds)
                ? form.permittedSectorIds
                : []
              : undefined,
          permittedProviderIds: opsRole ? form.permittedProviderIds || undefined : undefined,
          apiKey: form.apiKey || undefined,
        };
      }
      case 'ambulances':
        return { unitNumber: form.unitNumber, cityId: form.cityId || formCityId, providerId: form.providerId, status: form.status || 'available',
          driverIds: Array.isArray(form.driverIds) ? form.driverIds : [], currentLat: form.currentLat ? Number(form.currentLat) : undefined,
          currentLng: form.currentLng ? Number(form.currentLng) : undefined, gpsUrl: form.gpsUrl || undefined, gpsHeaders: form.gpsHeaders || undefined };
      case 'latency-rules':
        return {
          name: form.name,
          breachType: form.breachType || 'transit_eta',
          cityId: form.cityId || formCityId,
          sectorId: form.sectorId || null,
          targetRole: form.breachType === 'user_presence' ? form.targetRole || null : null,
          thresholdMinutes: Number(form.thresholdMinutes) || 6,
          isActive: form.isActive !== false,
        };
      case 'latency-recipients':
        return {
          ruleId: form.ruleId,
          name: form.name,
          phone: form.phone,
          channel: form.channel || 'both',
          notificationCount: Math.min(10, Math.max(1, Number(form.notificationCount) || 1)),
          notificationIntervalMinutes: Math.min(
            24 * 60,
            Math.max(1, Number(form.notificationIntervalMinutes) || 15),
          ),
          isActive: form.isActive !== false,
        };
      case 'messaging-providers':
        return {
          name: form.name,
          channel: form.channel || 'whatsapp',
          authFieldName: form.authFieldName || 'token',
          ...(form.apiUrl ? { apiUrl: form.apiUrl } : {}),
          ...(form.secretKey ? { secretKey: form.secretKey } : {}),
          isActive: form.isActive !== false,
        };
      default: return { ...form };
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaveError('');
    try {
      const payload = buildPayload();
      if (active === 'users' && payload.role === 'hospital' && !payload.hospitalId) {
        setSaveError('Please select an assigned hospital for Hospital ER Staff.');
        return;
      }
      if (active === 'users' && (payload.role === 'safe_city' || payload.role === 'hq_1122')) {
        if (!payload.cityId) {
          setSaveError(`City is required for ${payload.role === 'hq_1122' ? 'HQ' : 'Safecity'} user.`);
          return;
        }
        const scopedSectors = Array.isArray(payload.permittedSectorIds) ? payload.permittedSectorIds : [];
        if (scopedSectors.length === 0) {
          setSaveError('Select at least one sector.');
          return;
        }
      }
      if (active === 'latency-recipients' && !payload.ruleId) {
        setSaveError('Select a latency rule for this contact.');
        return;
      }
      if (active === 'latency-recipients' && payload.phone && !/^\+?\d+$/.test(String(payload.phone).trim())) {
        setSaveError('Phone may only contain + and digits (e.g. +923001234567 or 03331234567).');
        return;
      }
      if (active === 'messaging-providers') {
        if (!payload.name) {
          setSaveError('Provider name is required.');
          return;
        }
        if (!editingId && (!payload.apiUrl || !payload.secretKey)) {
          setSaveError('API URL and secret key are required for a new provider.');
          return;
        }
        if (payload.apiUrl && !/^https?:\/\/.+/i.test(String(payload.apiUrl).trim())) {
          setSaveError('API URL must start with http:// or https:// — not an email address.');
          return;
        }
      }
      if (editingId) await api(`/${active}/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else {
        if (active === 'users' && !payload.password) { setSaveError('Password is required for new users.'); return; }
        await api(`/${active}`, { method: 'POST', body: JSON.stringify(payload) });
      }
      resetForm(); await refreshAll();
    } catch (err) { setSaveError(err instanceof Error ? err.message : 'Save failed'); }
  }

  async function handleDelete(id: string) {
    const msg = active === 'transits'
      ? 'Delete this case? Related GPS history will be removed and the ambulance will be freed if it was assigned.'
      : active === 'hospitals'
        ? 'Delete this hospital? Assigned users will be unassigned. Active cases will be closed/removed; completed case history is kept.'
        : 'Delete this record?';
    if (!confirm(msg)) return;
    try {
      setLoadError('');
      await api(`/${active}/${id}`, { method: 'DELETE' });
      await refreshAll();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const sectorsForCity = refs.sectors.filter((s) => !form.cityId && !formCityId ? true : s.cityId === (form.cityId || formCityId));
  const sectorOptions = sectorsForCity.map((s) => ({
    value: s.id as string,
    label: `Sector ${s.code} — ${s.name as string}`,
  }));
  const hospitalsForCity = refs.hospitals.filter((h) => {
    const cid = (form.cityId as string) || formCityId;
    if (!cid) return true;
    return h.cityId === cid;
  });
  const hospitalOptions = (hospitalsForCity.length > 0 ? hospitalsForCity : refs.hospitals).map((h) => {
    const cityName = refs.cities.find((c) => c.id === h.cityId)?.name;
    return {
      value: h.id as string,
      label: cityName ? `${h.name as string} (${cityName})` : (h.name as string),
    };
  });
  const paramedicsForProvider = refs.paramedics.filter(
    (p) =>
      (!form.providerId || p.providerId === form.providerId) &&
      (!form.cityId || p.cityId === form.cityId),
  );
  const activeResource        = RESOURCES.find((r) => r.key === active);
  const cityCfg               = getCityConfig(form);

  const columns = getAdminColumns(active);

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f4f6f9' }}>
      <div className="bg-white rounded-xl p-8 flex items-center gap-3 shadow-sm border border-gray-100">
        <svg className="animate-spin h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <span className="text-sm font-medium text-gray-600">Authenticating…</span>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#f4f6f9' }}>
      <TopNav active="/admin" />

      {/* ── Shell below nav ── */}
      <div className="flex flex-1 min-h-0 pt-14">

        {/* ── Left sidebar ── */}
        <aside
          className="w-52 shrink-0 flex flex-col overflow-y-auto"
          style={{ background: '#ffffff', borderRight: '1px solid #e5e7eb' }}
        >
          <nav className="flex-1 p-2 pt-4 space-y-0.5">
            {RESOURCES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => switchResource(r.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-100 group ${
                  active === r.key
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{
                    fontSize: 15,
                    fontVariationSettings: "'FILL' 1",
                    color: active === r.key ? '#15803d' : '#9ca3af',
                  }}
                >
                  {r.icon}
                </span>
                <span className="text-xs font-semibold flex-1 truncate">{r.label}</span>
              </button>
            ))}
          </nav>

        </aside>

        {/* ── Main area ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── Toolbar ── */}
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}
          >
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 18, color: '#15803d', fontVariationSettings: "'FILL' 1" }}
              >
                {activeResource?.icon}
              </span>
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-tight">{activeResource?.label}</h1>
                <p className="text-[10px] text-gray-400">{activeResource?.hint}</p>
              </div>
              <div
                className="h-5 w-px mx-1"
                style={{ background: '#e5e7eb' }}
              />
              <span className="text-xs font-mono font-semibold text-gray-500">{items.length} rows</span>
              <span className="pill pill-blue text-[10px]">All cities</span>
            </div>

            <div className="flex items-center gap-2">
              {loadError && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-red-600 font-medium" style={{ background: '#fee2e2' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
                  {loadError}
                  <button type="button" onClick={refreshAll} className="underline ml-1">Retry</button>
                </div>
              )}
              <button type="button" onClick={refreshAll} className="btn-ghost text-xs px-3 py-2">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
              </button>
              {!READ_ONLY_RESOURCES.has(active) && (
                <button type="button" onClick={openNew} className="btn-primary text-xs px-4 py-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                  New {activeResource?.label}
                </button>
              )}
            </div>
          </div>

          {/* ── Content: table + optional slide-in form ── */}
          <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* Data grid and pagination stack vertically */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="flex-1 overflow-auto">
                <table className="data-grid">
                <thead>
                  <tr>
                    <th className="col-row-num">#</th>
                    {columns.map((col) => (
                      <th key={col.key}>{col.label}</th>
                    ))}
                    <th style={{ width: 110 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id as string} className="animate-fade-in">
                      <td className="col-row-num">{idx + 1}</td>
                      {columns.map((col) => (
                        <td key={col.key}>
                          <CellValue col={col.key} value={col.value(item, refs)} />
                        </td>
                      ))}
                      <td>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {active === 'hospitals' && (
                            <a
                              href={`/admin/hospital-geofence/${item.id as string}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Draw arrival geofence"
                              className="btn-ghost p-1.5 text-blue-700 border border-blue-200 inline-flex"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>map</span>
                            </a>
                          )}
                          {!READ_ONLY_RESOURCES.has(active) && (
                            <button type="button" onClick={() => startEdit(item)} className="btn-edit">Edit</button>
                          )}
                          {!NO_DELETE_RESOURCES.has(active) && (
                            <button type="button" onClick={() => handleDelete(item.id as string)} className="btn-danger-ghost">Del</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {isFetching && items.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 2}>
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                          <svg className="animate-spin h-8 w-8 text-green-600" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>
                          <p className="text-sm font-semibold text-gray-400">Loading {activeResource?.label}...</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!isFetching && items.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 2}>
                        <div className="flex flex-col items-center justify-center py-20 gap-3">
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{ background: '#f0fdf4', border: '1px solid #dcfce7' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#86efac' }}>table_rows</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-400">No {activeResource?.label} yet</p>
                          {!READ_ONLY_RESOURCES.has(active) && (
                            <button type="button" onClick={openNew} className="btn-primary text-xs px-4 py-2">
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                              Create first {activeResource?.label?.slice(0, -1)}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white shrink-0">
                  <span className="text-sm text-gray-500">
                    Showing page <span className="font-semibold text-gray-900">{page}</span> of <span className="font-semibold text-gray-900">{totalPages}</span> ({total} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 text-sm font-medium border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 text-sm font-medium border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Slide-in form panel */}
            {formOpen && (
              <div
                className="w-80 shrink-0 flex flex-col overflow-y-auto animate-fade-in"
                style={{ background: '#ffffff', borderLeft: '1px solid #e5e7eb' }}
              >
                {/* Form header */}
                <div
                  className="flex items-center justify-between px-5 py-4 shrink-0"
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">
                      {editingId ? 'Edit' : 'New'} {activeResource?.label}
                    </h2>
                    {editingId && (
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5">{editingId.slice(0, 20)}…</p>
                    )}
                  </div>
                  <button type="button" onClick={resetForm}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>

                {/* Form body */}
                <form onSubmit={handleSave} className="flex-1 flex flex-col">
                  <div className="flex-1 p-5 space-y-4 overflow-y-auto">
                    {saveError && (
                      <div className="px-3 py-2.5 rounded-lg text-xs text-red-700 font-medium flex items-center gap-2"
                        style={{ background: '#fee2e2' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>error</span>
                        {saveError}
                      </div>
                    )}

                    {/* ── CITIES ── */}
                    {active === 'cities' && (<>
                      <FormField label="City Name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Karachi" required />
                      </FormField>
                      <FormField label="City Code" required hint="Short code for transit IDs (e.g. KHI-0001)">
                        <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="KHI" required />
                      </FormField>
                      <FormField label="Province">
                        <TextInput value={(form.province as string) || ''} onChange={(v) => setForm({ ...form, province: v })} placeholder="Sindh" />
                      </FormField>
                      <FormField label="Map Center Latitude" hint="Safe City / HQ default map center">
                        <TextInput type="number" value={form.mapCenterLat != null ? String(form.mapCenterLat) : ''} onChange={(v) => setForm({ ...form, mapCenterLat: v })} placeholder="24.8607" />
                      </FormField>
                      <FormField label="Map Center Longitude">
                        <TextInput type="number" value={form.mapCenterLng != null ? String(form.mapCenterLng) : ''} onChange={(v) => setForm({ ...form, mapCenterLng: v })} placeholder="67.0011" />
                      </FormField>
                      <FormField label="Map Zoom" hint="Typical 11–14">
                        <TextInput type="number" value={form.mapDefaultZoom != null ? String(form.mapDefaultZoom) : '12'} onChange={(v) => setForm({ ...form, mapDefaultZoom: v })} />
                      </FormField>
                      <FormField label="Max Concurrent Corridors" hint="Active green corridors allowed at once">
                        <TextInput type="number" value={cityCfg.maxConcurrentTransits} onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, maxConcurrentTransits: Number(v) } })} />
                      </FormField>
                      <FormField label="Latency Alert Speed (km/h)" hint="Flags slow ambulances below this speed">
                        <TextInput type="number" value={cityCfg.latencySpeedThresholdKmh} onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, latencySpeedThresholdKmh: Number(v) } })} />
                      </FormField>
                      <FormField label="Default ETA (minutes)">
                        <TextInput type="number" value={cityCfg.defaultBaselineEtaMinutes} onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, defaultBaselineEtaMinutes: Number(v) } })} />
                      </FormField>
                      <FormField label="Auto-complete on geofence" hint="When ON, ambulances inside a saved hospital fence auto-complete after the delay below">
                        <SelectInput
                          value={cityCfg.geofenceAutoCompleteEnabled ? 'true' : 'false'}
                          onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, geofenceAutoCompleteEnabled: v === 'true' } })}
                          options={[{ value: 'false', label: 'OFF — driver completes manually' }, { value: 'true', label: 'ON — auto-complete in fence' }]}
                        />
                      </FormField>
                      <FormField label="Geofence delay (seconds)" hint="Ambulance must stay inside fence this long before auto-complete (default 10)">
                        <TextInput
                          type="number"
                          value={cityCfg.geofenceAutoCompleteDelaySeconds ?? 10}
                          onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, geofenceAutoCompleteDelaySeconds: Number(v) || 10 } })}
                        />
                      </FormField>
                    </>)}

                    {/* ── PROVIDERS ── */}
                    {active === 'providers' && (<>
                      <FormField label="Provider Name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Rescue 1122" required />
                      </FormField>
                      <FormField label="Code" required hint="Internal provider code (e.g. 1122, EDHI)">
                        <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="1122" required />
                      </FormField>
                      <FormField label="Map Marker Letter" required hint="Letter shown inside the map icon (e.g. R for Rescue, E for Edhi)">
                        <TextInput
                          value={(form.markerLetter as string) || ''}
                          onChange={(v) => setForm({ ...form, markerLetter: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) })}
                          placeholder="R"
                          required
                        />
                      </FormField>
                      <FormField label="Map Icon Shape">
                        <ShapePicker
                          value={(form.shape as string) || 'circle'}
                          color={(form.color as string) || '#d93343'}
                          letter={(form.markerLetter as string) || ''}
                          onChange={(shape) => setForm({ ...form, shape })}
                        />
                      </FormField>
                      <FormField label="Fleet Color">
                        <ColorPicker value={(form.color as string) || '#d93343'} onChange={(color) => setForm({ ...form, color })} />
                      </FormField>
                      <div className="neo-inset rounded-xl p-4 flex flex-col items-center gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Map marker preview</p>
                        <ProviderMarker
                          shape={(form.shape as string) || 'circle'}
                          color={(form.color as string) || '#d93343'}
                          size={28}
                          letter={(form.markerLetter as string) || '?'}
                        />
                      </div>
                    </>)}

                    {/* ── City selector for scoped resources ── */}
                    {(active === 'sectors' || active === 'hospitals' || active === 'ambulances' || active === 'latency-rules') && (
                      <FormField label="City" required>
                        <SelectInput value={form.cityId as string || formCityId} onChange={(v) => setForm({ ...form, cityId: v, sectorId: '', hospitalId: '', driverIds: [] })} options={cityOptions(refs.cities)} required />
                      </FormField>
                    )}

                    {/* ── SECTORS ── */}
                    {active === 'sectors' && (<>
                      <FormField label="Sector Name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Mall Road" required />
                      </FormField>
                      <FormField label="Code" required>
                        <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="A" required />
                      </FormField>
                      <FormField label="Traffic Grid Status">
                        <SelectInput value={(form.gridStatus as string) || 'moderate'} onChange={(v) => setForm({ ...form, gridStatus: v })} options={GRID_STATUS_OPTIONS} />
                      </FormField>
                      <FormField label="Map Color">
                        <ColorPicker value={(form.color as string) || '#0056b3'} onChange={(color) => setForm({ ...form, color })} />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Latitude">
                          <TextInput type="number" step="any" value={(form.latitude as number) ?? ''} onChange={(v) => setForm({ ...form, latitude: v })} placeholder="31.55" />
                        </FormField>
                        <FormField label="Longitude">
                          <TextInput type="number" step="any" value={(form.longitude as number) ?? ''} onChange={(v) => setForm({ ...form, longitude: v })} placeholder="74.34" />
                        </FormField>
                      </div>
                    </>)}

                    {/* ── HOSPITALS ── */}
                    {active === 'hospitals' && (<>
                      <FormField label="Hospital Name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Mayo Hospital" required />
                      </FormField>
                      <FormField label="Address">
                        <TextInput value={(form.address as string) || ''} onChange={(v) => setForm({ ...form, address: v })} placeholder="Hospital Road, Lahore" />
                      </FormField>
                      <FormField label="Sector">
                        <SelectInput value={(form.sectorId as string) || ''} onChange={(v) => setForm({ ...form, sectorId: v })}
                          options={sectorsForCity.map((s) => ({ value: s.id as string, label: `${s.code}: ${s.name}` }))} placeholder="Select sector…" />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Latitude" required>
                          <TextInput type="number" step="any" value={(form.latitude as number) ?? ''} onChange={(v) => setForm({ ...form, latitude: v })} placeholder="31.57045" required />
                        </FormField>
                        <FormField label="Longitude" required>
                          <TextInput type="number" step="any" value={(form.longitude as number) ?? ''} onChange={(v) => setForm({ ...form, longitude: v })} placeholder="74.30892" required />
                        </FormField>
                      </div>
                      <InfoBox title="GPS required">
                        Latitude and longitude are required so drivers can draw the shortest path to this hospital.
                      </InfoBox>
                      <FormField label="Specialties (comma-separated)">
                        <TextInput value={typeof form.specialties === 'string' ? form.specialties : Array.isArray(form.specialties) ? (form.specialties as string[]).join(', ') : ''}
                          onChange={(v) => setForm({ ...form, specialties: v })} placeholder="Neurosurgery, Burn Care" />
                      </FormField>
                      <FormField
                        label="Emergency Categories Catered"
                        hint={refs.emergencyTypes.length === 0
                          ? 'No emergency types found — create them in Emergency Types first'
                          : 'Tick every emergency category this hospital can handle'}
                      >
                        <div className="space-y-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-44 overflow-y-auto">
                          {refs.emergencyTypes.map((et) => {
                            const selected = (form.emergencyTypeIds as string[] || []).includes(et.id as string);
                            return (
                              <label key={et.id as string} className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                                  checked={selected}
                                  onChange={(e) => {
                                    const prev = (form.emergencyTypeIds as string[] || []);
                                    const next = e.target.checked
                                      ? [...prev, et.id as string]
                                      : prev.filter((id) => id !== et.id);
                                    setForm({ ...form, emergencyTypeIds: next });
                                  }}
                                />
                                {et.name as string}
                                <span className="text-[10px] font-mono text-slate-400">({et.code as string})</span>
                              </label>
                            );
                          })}
                          {refs.emergencyTypes.length === 0 && (
                            <p className="text-xs text-slate-400">No emergency types defined yet.</p>
                          )}
                        </div>
                      </FormField>
                    </>)}

                    {/* ── EMERGENCY TYPES ── */}
                    {active === 'emergency-types' && (<>
                      <FormField label="Name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Trauma/Cardiac" required />
                      </FormField>
                      <FormField label="Code" required>
                        <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="TRAUMA" required />
                      </FormField>
                      <FormField label="Severity Level">
                        <SelectInput value={(form.severityLevel as number) ?? 3} onChange={(v) => setForm({ ...form, severityLevel: Number(v) })} options={SEVERITY_OPTIONS} />
                      </FormField>
                      <FormField label="Description">
                        <TextInput value={(form.description as string) || ''} onChange={(v) => setForm({ ...form, description: v })} placeholder="Optional notes" />
                      </FormField>
                    </>)}

                    {/* ── TRIAGE CODES ── */}
                    {active === 'triage-codes' && (<>
                      <FormField label="Name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Code Red" required />
                      </FormField>
                      <FormField label="Code" required>
                        <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="RED" required />
                      </FormField>
                      <FormField label="Priority" hint="1 = most urgent">
                        <SelectInput value={(form.priority as number) ?? 1} onChange={(v) => setForm({ ...form, priority: Number(v) })} options={TRIAGE_PRIORITY_OPTIONS} />
                      </FormField>
                      <FormField label="Display Color">
                        <ColorPicker value={(form.color as string) || '#ba1a1a'} onChange={(color) => setForm({ ...form, color })} />
                      </FormField>
                    </>)}

                    {/* ── USERS ── */}
                    {active === 'users' && (<>
                      <FormField label="Full Name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} required />
                      </FormField>
                      <FormField label="Email" required>
                        <TextInput value={(form.email as string) || ''} onChange={(v) => setForm({ ...form, email: v })} placeholder="user@domain.pk" required />
                      </FormField>
                      <FormField label="Password" required={!editingId} hint={editingId ? 'Leave blank to keep current' : 'Min 6 characters'}>
                        <TextInput type="password" value={(form.password as string) || ''} onChange={(v) => setForm({ ...form, password: v })} required={!editingId} />
                      </FormField>
                      <FormField label="Role" required>
                        <SelectInput value={(form.role as string) || 'hospital'} onChange={(v) => setForm({ ...form, role: v, hospitalId: '', providerId: '', sectorId: '', permittedSectorIds: [] })} options={USER_ROLE_OPTIONS} />
                      </FormField>
                      <FormField label="City" hint="Required for Hospital / Paramedic / HQ / Safe City / VVIP">
                        <SelectInput value={(form.cityId as string) || ''} onChange={(v) => setForm({ ...form, cityId: v, hospitalId: '', sectorId: '', permittedSectorIds: [] })} options={cityOptions(refs.cities)} placeholder="Select city…" />
                      </FormField>
                      {((form.role as string) || 'hospital') === 'hospital' && (
                        <FormField
                          label="Assigned Hospital"
                          required
                          hint={
                            hospitalOptions.length === 0
                              ? 'No hospitals found — create a hospital for this city first'
                              : hospitalsForCity.length === 0
                                ? 'No hospitals in selected city — showing all hospitals'
                                : 'Hospital this ER user can access'
                          }
                        >
                          <SelectInput
                            value={(form.hospitalId as string) || ''}
                            onChange={(v) => setForm({ ...form, hospitalId: v })}
                            options={hospitalOptions}
                            placeholder="Select hospital…"
                            required
                          />
                        </FormField>
                      )}
                      {(form.role as string) === 'paramedic' && (
                        <FormField label="Fleet Provider" required>
                          <SelectInput value={(form.providerId as string) || ''} onChange={(v) => setForm({ ...form, providerId: v })}
                            options={refs.providers.map((p) => ({ value: p.id as string, label: p.name as string }))} placeholder="Select provider…" required />
                        </FormField>
                      )}
                      {((form.role as string) === 'safe_city' || (form.role as string) === 'hq_1122') && (
                        <FormField
                          label="Assigned Sectors"
                          required
                          hint={
                            (form.role as string) === 'hq_1122'
                              ? 'Select one or more sectors. HQ head users can be given all sectors in the city.'
                              : 'Select one or more sectors. Safecity head users can be given all sectors in the city.'
                          }
                        >
                          <div className="space-y-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-44 overflow-y-auto">
                            {sectorOptions.map((option) => {
                              const selected = ((form.permittedSectorIds as string[]) || []).includes(option.value);
                              return (
                                <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                                    checked={selected}
                                    onChange={(e) => {
                                      const prev = (form.permittedSectorIds as string[] || []);
                                      const next = e.target.checked
                                        ? [...prev, option.value]
                                        : prev.filter((id) => id !== option.value);
                                      setForm({ ...form, permittedSectorIds: next });
                                    }}
                                  />
                                  {option.label}
                                </label>
                              );
                            })}
                            {sectorOptions.length === 0 && (
                              <p className="text-xs text-slate-400">
                                {form.cityId ? 'No sectors in this city yet.' : 'Select a city first.'}
                              </p>
                            )}
                          </div>
                          {Array.isArray(form.permittedSectorIds) && form.permittedSectorIds.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {form.permittedSectorIds.map((id) => (
                                <p key={id} className="text-[10px] font-mono text-gray-400 break-all">
                                  Sector ID: {id}
                                </p>
                              ))}
                            </div>
                          )}
                        </FormField>
                      )}
                      {(form.role as string) === 'vvip' && (
                        <FormField
                          label="Assigned Sector"
                          required={false}
                          hint="Optional — restrict this user to one sector within the city"
                        >
                          <SelectInput
                            value={(form.sectorId as string) || ''}
                            onChange={(v) => setForm({ ...form, sectorId: v })}
                            options={sectorOptions}
                            placeholder={form.cityId ? (sectorOptions.length ? 'Select sector…' : 'No sectors in this city — create sectors first') : 'Select a city first'}
                          />
                          {(form.sectorId as string) && (
                            <p className="text-[10px] font-mono text-gray-400 mt-1 break-all">
                              Sector ID: {form.sectorId as string}
                            </p>
                          )}
                        </FormField>
                      )}
                      {((form.role as string) === 'hq_1122' || (form.role as string) === 'safe_city' || (form.role as string) === 'vvip') && (
                        <FormField label="Permitted Fleet Providers" hint="Leave empty to allow viewing ALL providers">
                          <div className="space-y-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {refs.providers.map((p) => {
                              const selected = (form.permittedProviderIds as string[] || []).includes(p.id as string);
                              return (
                                <label key={p.id as string} className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                                    checked={selected}
                                    onChange={(e) => {
                                      const prev = (form.permittedProviderIds as string[] || []);
                                      const next = e.target.checked
                                        ? [...prev, p.id as string]
                                        : prev.filter(id => id !== p.id);
                                      setForm({ ...form, permittedProviderIds: next });
                                    }}
                                  />
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color as string }} />
                                  {p.name as string}
                                </label>
                              );
                            })}
                          </div>
                        </FormField>
                      )}
                      <FormField label="API Access Key" hint="Optional key for machine auth">
                        <TextInput value={(form.apiKey as string) || ''} onChange={(v) => setForm({ ...form, apiKey: v })} placeholder="key_1122_hq_admin" />
                      </FormField>
                    </>)}

                    {/* ── AMBULANCES ── */}
                    {active === 'ambulances' && (<>
                      <InfoBox title="Setup Flow">
                        <ol className="list-decimal list-inside space-y-1 text-gray-500 text-[11px]">
                          <li>Create a <strong>Paramedic</strong> user with a fleet provider</li>
                          <li>Register the ambulance with city + provider</li>
                          <li>Assign up to three shift drivers below</li>
                          <li>The latest driver login automatically ends the previous shift session</li>
                          <li>GPS sends to <code className="bg-gray-100 px-1 rounded text-[10px]">PATCH /ambulances/{'{id}'}/gps</code></li>
                        </ol>
                      </InfoBox>
                      <FormField label="Unit Number" required>
                        <TextInput value={(form.unitNumber as string) || ''} onChange={(v) => setForm({ ...form, unitNumber: v })} placeholder="RESCUE-782" required />
                      </FormField>
                      <FormField label="Fleet Provider" required>
                        <SelectInput value={(form.providerId as string) || ''} onChange={(v) => setForm({ ...form, providerId: v, driverIds: [] })}
                          options={refs.providers.map((p) => ({ value: p.id as string, label: `${p.name} (${p.code})` }))} placeholder="Select provider…" required />
                      </FormField>
                      <FormField label="Shift Drivers (maximum 3)" hint="Only one assigned driver session can be active at a time">
                        <div className="space-y-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-44 overflow-y-auto">
                          {paramedicsForProvider.map((driver) => {
                            const selectedIds = (form.driverIds as string[]) || [];
                            const selected = selectedIds.includes(driver.id as string);
                            const atLimit = selectedIds.length >= 3 && !selected;
                            return (
                              <label key={driver.id as string} className="flex items-center gap-2 text-sm text-slate-700 font-medium cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                                  checked={selected}
                                  disabled={atLimit}
                                  onChange={() => {
                                    const next = selected
                                      ? selectedIds.filter((id) => id !== driver.id)
                                      : [...selectedIds, driver.id as string];
                                    setForm({ ...form, driverIds: next });
                                  }}
                                />
                                <span>{driver.name as string} ({driver.email as string})</span>
                              </label>
                            );
                          })}
                          {paramedicsForProvider.length === 0 && (
                            <p className="text-xs text-slate-500">No matching paramedic users found.</p>
                          )}
                        </div>
                      </FormField>
                      <FormField label="Status">
                        <SelectInput value={(form.status as string) || 'available'} onChange={(v) => setForm({ ...form, status: v })} options={AMBULANCE_STATUS_OPTIONS} />
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Init Latitude">
                          <TextInput type="number" step="any" value={(form.currentLat as number) ?? ''} onChange={(v) => setForm({ ...form, currentLat: v })} placeholder="31.55" />
                        </FormField>
                        <FormField label="Init Longitude">
                          <TextInput type="number" step="any" value={(form.currentLng as number) ?? ''} onChange={(v) => setForm({ ...form, currentLng: v })} placeholder="74.34" />
                        </FormField>
                      </div>
                      <FormField label="GPS Feed URL" hint="Optional external GPS device URL">
                        <TextInput value={(form.gpsUrl as string) || ''} onChange={(v) => setForm({ ...form, gpsUrl: v })} placeholder="http://192.168.1.100/gps.json" />
                      </FormField>
                      {editingId && (
                        <InfoBox title="GPS Tracker API">
                          <p className="text-[11px]">Device ID: <strong className="font-mono">{editingId.slice(0, 24)}</strong></p>
                          <p className="mt-1 text-[10px]">PATCH {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/ambulances/{editingId}/gps</p>
                        </InfoBox>
                      )}
                    </>)}

                    {active === 'latency-rules' && (<>
                      <InfoBox title="Latency breach rules">
                        <p className="text-[11px] text-gray-500">
                          <strong>Transit ETA:</strong> breach when ambulance arrives more than the threshold minutes after the promised ETA.
                          <br />
                          <strong>User presence:</strong> breach when Hospital / HQ / Safecity user has no dashboard heartbeat for longer than the threshold.
                        </p>
                      </InfoBox>
                      <FormField label="Rule name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Lahore ambulance ETA 6 min" required />
                      </FormField>
                      <FormField label="Breach type" required>
                        <SelectInput
                          value={(form.breachType as string) || 'transit_eta'}
                          onChange={(v) => setForm({ ...form, breachType: v, targetRole: v === 'user_presence' ? form.targetRole || 'hospital' : null })}
                          options={[
                            { value: 'transit_eta', label: 'Ambulance ETA overrun' },
                            { value: 'user_presence', label: 'User not logged in / disconnected' },
                          ]}
                          required
                        />
                      </FormField>
                      <FormField label="City" required>
                        <SelectInput value={form.cityId as string || formCityId} onChange={(v) => setForm({ ...form, cityId: v, sectorId: '' })} options={cityOptions(refs.cities)} required />
                      </FormField>
                      <FormField label="Sector (optional)" hint="Leave empty to apply to all sectors in the city">
                        <SelectInput
                          value={(form.sectorId as string) || ''}
                          onChange={(v) => setForm({ ...form, sectorId: v || null })}
                          options={[{ value: '', label: 'All sectors' }, ...refs.sectors.filter((s) => s.cityId === (form.cityId || formCityId)).map((s) => ({ value: s.id as string, label: s.name as string }))]}
                        />
                      </FormField>
                      {form.breachType === 'user_presence' && (
                        <FormField label="Monitored role" required>
                          <SelectInput
                            value={(form.targetRole as string) || 'hospital'}
                            onChange={(v) => setForm({ ...form, targetRole: v })}
                            options={[
                              { value: 'hospital', label: 'Hospital ER' },
                              { value: 'hq_1122', label: 'HQ' },
                              { value: 'safe_city', label: 'Safecity' },
                            ]}
                            required
                          />
                        </FormField>
                      )}
                      <FormField label="Threshold (minutes)" required hint="Transit: grace after promised ETA. User: max time without heartbeat/login.">
                        <TextInput type="number" value={form.thresholdMinutes != null ? String(form.thresholdMinutes) : '6'} onChange={(v) => setForm({ ...form, thresholdMinutes: v })} required />
                      </FormField>
                      <FormField label="Active">
                        <SelectInput value={form.isActive === false ? 'false' : 'true'} onChange={(v) => setForm({ ...form, isActive: v === 'true' })} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
                      </FormField>
                    </>)}

                    {active === 'latency-recipients' && (<>
                      <InfoBox title="Alert contacts">
                        <p className="text-[11px] text-gray-500">
                          Each contact gets SMS/WhatsApp when the linked rule fires. Set how many alerts to send and the gap between them.
                          Follow-ups for user-offline breaches are cancelled if the user comes back online.
                        </p>
                      </InfoBox>
                      <FormField label="Latency rule" required>
                        <SelectInput
                          value={(form.ruleId as string) || ''}
                          onChange={(v) => setForm({ ...form, ruleId: v })}
                          options={refs.latencyRules.map((r) => ({
                            value: r.id as string,
                            label: `${r.name as string} (${r.breachType === 'user_presence' ? 'User offline' : 'ETA'})`,
                          }))}
                          placeholder="Select rule…"
                          required
                        />
                      </FormField>
                      <FormField label="Contact name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Operations manager" required />
                      </FormField>
                      <FormField label="Mobile number" required hint="WhatsApp/SMS registered — + and digits only (+923… or 0333…)">
                        <TextInput
                          value={(form.phone as string) || ''}
                          onChange={(v) => {
                            const cleaned = v.replace(/[^\d+]/g, '');
                            setForm({ ...form, phone: cleaned });
                          }}
                          placeholder="+923001234567 or 03331234567"
                          required
                        />
                      </FormField>
                      <FormField label="Channel">
                        <SelectInput
                          value={(form.channel as string) || 'both'}
                          onChange={(v) => setForm({ ...form, channel: v })}
                          options={[
                            { value: 'both', label: 'SMS + WhatsApp' },
                            { value: 'sms', label: 'SMS only' },
                            { value: 'whatsapp', label: 'WhatsApp only' },
                          ]}
                        />
                      </FormField>
                      <FormField label="Number of alerts" required hint="1 = only the first breach alert. Higher = repeat reminders.">
                        <TextInput
                          type="number"
                          value={form.notificationCount != null ? String(form.notificationCount) : '1'}
                          onChange={(v) => setForm({ ...form, notificationCount: v })}
                          required
                        />
                      </FormField>
                      {(Number(form.notificationCount) || 1) > 1 && (
                        <FormField
                          label="Minutes between alerts"
                          required
                          hint="Wait this many minutes before the next SMS/WhatsApp (e.g. 15 = second alert after 15 min)"
                        >
                          <TextInput
                            type="number"
                            value={form.notificationIntervalMinutes != null ? String(form.notificationIntervalMinutes) : '15'}
                            onChange={(v) => setForm({ ...form, notificationIntervalMinutes: v })}
                            required
                          />
                        </FormField>
                      )}
                      <FormField label="Active">
                        <SelectInput value={form.isActive === false ? 'false' : 'true'} onChange={(v) => setForm({ ...form, isActive: v === 'true' })} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
                      </FormField>
                    </>)}

                    {active === 'messaging-providers' && (<>
                      <InfoBox title="Encrypted credentials">
                        <p className="text-[11px] text-gray-500">
                          API URL and secret key are stored encrypted in the database — never in <code className="text-[10px]">.env</code>.
                          Set <strong>CONFIG_ENCRYPTION_KEY</strong> on the server for production-grade encryption.
                          Only <strong>one active provider per channel</strong> (SMS or WhatsApp). SMS and WhatsApp can each have one active at the same time.
                        </p>
                      </InfoBox>
                      <FormField label="Provider name" required>
                        <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="BizIntel WhatsApp" required />
                      </FormField>
                      <FormField label="Channel" required>
                        <SelectInput
                          value={(form.channel as string) || 'whatsapp'}
                          onChange={(v) => setForm({ ...form, channel: v })}
                          options={[
                            { value: 'whatsapp', label: 'WhatsApp' },
                            { value: 'sms', label: 'SMS' },
                          ]}
                          required
                        />
                      </FormField>
                      <FormField label="API URL" required={!editingId} hint="Full http://… URL — not an email. Example: http://erp.bizintel.co:8005/api/send-json">
                        <TextInput value={(form.apiUrl as string) || ''} onChange={(v) => setForm({ ...form, apiUrl: v })} placeholder="http://host:port/api/send-json" required={!editingId} />
                      </FormField>
                      <FormField label="API token / secret key" required={!editingId} hint={editingId ? 'Leave blank to keep the existing encrypted key' : 'Value sent in JSON body (ESSPL/BizIntel field: token)'}>
                        <TextInput
                          type="password"
                          value={(form.secretKey as string) || ''}
                          onChange={(v) => setForm({ ...form, secretKey: v })}
                          placeholder={editingId ? '•••••• (unchanged)' : 'Enter token or secret key'}
                          required={!editingId}
                        />
                      </FormField>
                      <FormField label="Auth JSON field" hint="Name of the token field in POST body — ESSPL/BizIntel uses token">
                        <SelectInput
                          value={(form.authFieldName as string) || 'token'}
                          onChange={(v) => setForm({ ...form, authFieldName: v })}
                          options={[
                            { value: 'token', label: 'token (ESSPL / BizIntel)' },
                            { value: 'secret_key', label: 'secret_key' },
                            { value: 'secretkey', label: 'secretkey' },
                          ]}
                        />
                      </FormField>
                      <FormField label="Active" hint="Only one provider per channel can be active. Setting Yes deactivates other APIs on the same channel.">
                        <SelectInput value={form.isActive === false ? 'false' : 'true'} onChange={(v) => setForm({ ...form, isActive: v === 'true' })} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
                      </FormField>

                      <div className="mt-2 pt-4 border-t border-slate-200 space-y-3">
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Test API</p>
                        <p className="text-[11px] text-gray-500">
                          Sends a real message using the credentials above{editingId ? ' (saved values used when URL/key left blank)' : ''}. Does not save the provider.
                        </p>
                        <FormField label="Test phone" required hint="+ and digits only">
                          <TextInput
                            value={msgTestPhone}
                            onChange={(v) => {
                              setMsgTestPhone(v.replace(/[^\d+]/g, ''));
                              setMsgTestResult(null);
                            }}
                            placeholder="+923001234567 or 03331234567"
                          />
                        </FormField>
                        <FormField label="Test message">
                          <TextInput
                            value={msgTestMessage}
                            onChange={(v) => setMsgTestMessage(v)}
                            placeholder="Optional custom test text"
                          />
                        </FormField>
                        {msgTestResult && (
                          <div
                            className={`text-xs rounded-lg px-3 py-2 border ${
                              msgTestResult.ok
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-red-50 border-red-200 text-red-800'
                            }`}
                          >
                            {msgTestResult.text}
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={msgTestLoading}
                          onClick={() => void handleTestMessaging()}
                          className="btn-ghost w-full justify-center py-2.5 text-sm border border-slate-200 disabled:opacity-60"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                            {msgTestLoading ? 'hourglass_top' : 'send'}
                          </span>
                          {msgTestLoading ? 'Sending test…' : 'Send test message'}
                        </button>
                      </div>
                    </>)}
                  </div>

                  {/* Form footer */}
                  <div className="px-5 py-4 shrink-0 space-y-2" style={{ borderTop: '1px solid #f1f5f9' }}>
                    <button type="submit" className="btn-primary w-full justify-center py-2.5 text-sm">
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{editingId ? 'save' : 'add_circle'}</span>
                      {editingId ? 'Update Record' : 'Create Record'}
                    </button>
                    <button type="button" onClick={resetForm} className="btn-ghost w-full justify-center text-xs py-2">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
