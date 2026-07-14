'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopNav } from '@/components/ui';
import { api, City, CityOperationalConfig, fetchAllCities, cityQuery } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import {
  FormField,
  TextInput,
  SelectInput,
  ColorPicker,
  ShapePicker,
  InfoBox,
  GRID_STATUS_OPTIONS,
  SEVERITY_OPTIONS,
  TRIAGE_PRIORITY_OPTIONS,
  AMBULANCE_STATUS_OPTIONS,
  USER_ROLE_OPTIONS,
} from '@/components/admin/form-primitives';

type Entity = Record<string, unknown>;

interface RefData {
  cities: City[];
  providers: Entity[];
  hospitals: Entity[];
  sectors: Entity[];
  paramedics: Entity[];
}

const RESOURCES = [
  { key: 'cities', label: 'Cities', step: 1, hint: 'Start here — define operational cities first.' },
  { key: 'providers', label: 'Fleet Providers', step: 2, hint: 'Ambulance fleets (1122, Edhi, etc.) with map icon shape & color.' },
  { key: 'sectors', label: 'Sectors', step: 3, hint: 'Traffic zones within a city. Requires a city.' },
  { key: 'hospitals', label: 'Hospitals', step: 4, hint: 'ER destinations with GPS coordinates. Requires city + sector.' },
  { key: 'emergency-types', label: 'Emergency Types', step: 5, hint: 'Clinical categories with severity level.' },
  { key: 'triage-codes', label: 'Triage Codes', step: 6, hint: 'Priority codes shown on dashboards (Code Red, etc.).' },
  { key: 'users', label: 'Users', step: 7, hint: 'Staff accounts — paramedics become ambulance drivers.' },
  { key: 'ambulances', label: 'Ambulances', step: 8, hint: 'Register units, assign driver, connect GPS tracker.' },
];

const CITY_SCOPED = ['hospitals', 'sectors', 'ambulances'];

const DEFAULT_CITY_CONFIG: CityOperationalConfig = {
  maxConcurrentTransits: 50,
  latencySpeedThresholdKmh: 10,
  defaultBaselineEtaMinutes: 15,
  transitIdPrefix: '',
  enableSurgeProtocol: true,
  enableTransitRateKpi: true,
  privacyRedactPatientData: true,
  commandPriority: 1,
};

function cityOptions(cities: City[]) {
  return cities.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
}

function getCityConfig(form: Entity): CityOperationalConfig {
  const cfg = (form.operationalConfig as CityOperationalConfig) || {};
  return { ...DEFAULT_CITY_CONFIG, ...cfg };
}

export default function AdminPage() {
  const { ready } = useAuthGuard('admin');
  const { cityId: navCityId } = useCityContext();
  const [active, setActive] = useState('cities');
  const [items, setItems] = useState<Entity[]>([]);
  const [form, setForm] = useState<Entity>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [refs, setRefs] = useState<RefData>({ cities: [], providers: [], hospitals: [], sectors: [], paramedics: [] });

  const formCityId = (form.cityId as string) || navCityId || refs.cities[0]?.id || '';

  const loadRefs = useCallback(async () => {
    try {
      const cities = await fetchAllCities();
      const [providers, users] = await Promise.all([
        api<Entity[]>('/providers'),
        api<Entity[]>('/users'),
      ]);
      const scopedCity = formCityId || navCityId || cities[0]?.id;
      const [hospitals, sectors] = scopedCity
        ? await Promise.all([
            api<Entity[]>(`/hospitals${cityQuery(scopedCity)}`),
            api<Entity[]>(`/sectors${cityQuery(scopedCity)}`),
          ])
        : [[], []];
      setRefs({
        cities,
        providers,
        hospitals,
        sectors,
        paramedics: users.filter((u) => u.role === 'paramedic'),
      });
      return cities;
    } catch (err) {
      throw err;
    }
  }, [formCityId, navCityId]);

  const load = useCallback(async () => {
    const path = CITY_SCOPED.includes(active) && (formCityId || navCityId)
      ? `/${active}${cityQuery(formCityId || navCityId)}`
      : `/${active}`;
    const data = await api<Entity[]>(path);
    setItems(data);
  }, [active, formCityId, navCityId]);

  const refreshAll = useCallback(async () => {
    if (!ready) return;
    setLoadError('');
    try {
      await loadRefs();
      await load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load admin data');
      setItems([]);
    }
  }, [ready, loadRefs, load]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  function resetForm() {
    setForm({});
    setEditingId(null);
    setSaveError('');
  }

  function switchResource(key: string) {
    setActive(key);
    resetForm();
  }

  function startEdit(item: Entity) {
    setEditingId(item.id as string);
    const copy = { ...item };
    if (active === 'cities' && item.operationalConfig) {
      copy.operationalConfig = { ...(item.operationalConfig as object) };
    }
    setForm(copy);
    if (item.cityId) setForm((f) => ({ ...f, ...copy }));
  }

  function buildPayload(): Entity {
    switch (active) {
      case 'cities': {
        const cfg = getCityConfig(form);
        return {
          name: form.name,
          code: String(form.code || '').toUpperCase(),
          province: form.province || undefined,
          country: form.country || 'Pakistan',
          operationalConfig: {
            ...cfg,
            transitIdPrefix: cfg.transitIdPrefix || String(form.code || '').toUpperCase(),
          },
        };
      }
      case 'providers':
        return {
          name: form.name,
          code: String(form.code || '').toUpperCase(),
          shape: form.shape || 'circle',
          color: form.color || '#d93343',
          description: form.description || undefined,
        };
      case 'sectors':
        return {
          name: form.name,
          code: form.code,
          cityId: form.cityId || formCityId,
          color: form.color || '#0056b3',
          gridStatus: form.gridStatus || 'moderate',
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
        };
      case 'hospitals':
        return {
          name: form.name,
          cityId: form.cityId || formCityId,
          address: form.address || undefined,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
          sectorId: form.sectorId || undefined,
          bedCapacity: form.bedCapacity ? Number(form.bedCapacity) : undefined,
          erBays: form.erBays ? Number(form.erBays) : undefined,
        };
      case 'emergency-types':
        return {
          name: form.name,
          code: String(form.code || '').toUpperCase(),
          description: form.description || undefined,
          severityLevel: Number(form.severityLevel) || 3,
        };
      case 'triage-codes':
        return {
          name: form.name,
          code: String(form.code || '').toUpperCase(),
          color: form.color || '#ba1a1a',
          priority: Number(form.priority) || 1,
          description: form.description || undefined,
        };
      case 'users':
        return {
          name: form.name,
          email: form.email,
          ...(form.password ? { password: form.password } : {}),
          role: form.role || 'hospital',
          cityId: form.cityId || undefined,
          hospitalId: form.role === 'hospital' ? form.hospitalId || undefined : undefined,
          providerId: form.role === 'paramedic' ? form.providerId || undefined : undefined,
          sectorId: form.role === 'hq_1122' && !form.isCityOverseer ? form.sectorId || undefined : undefined,
          isCityOverseer: form.role === 'hq_1122' ? !!form.isCityOverseer : false,
        };
      case 'ambulances':
        return {
          unitNumber: form.unitNumber,
          cityId: form.cityId || formCityId,
          providerId: form.providerId,
          status: form.status || 'available',
          driverId: form.driverId || undefined,
          currentLat: form.currentLat ? Number(form.currentLat) : undefined,
          currentLng: form.currentLng ? Number(form.currentLng) : undefined,
        };
      default:
        return { ...form };
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    try {
      const payload = buildPayload();
      if (editingId) {
        await api(`/${active}/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        if (active === 'users' && !payload.password) {
          setSaveError('Password is required for new users.');
          return;
        }
        await api(`/${active}`, { method: 'POST', body: JSON.stringify(payload) });
      }
      resetForm();
      await refreshAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this record?')) return;
    try {
      await api(`/${active}/${id}`, { method: 'DELETE' });
      await refreshAll();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function loadDemoData() {
    try {
      setDemoMsg('Loading demo data...');
      const city = refs.cities.find((c) => c.id === formCityId) || refs.cities[0];
      const code = city?.code || 'LHE';
      const result = await api<{ message: string; transits: number }>(`/seed/demo?cityCode=${code}`, { method: 'POST' });
      setDemoMsg(`${result.message} (${result.transits} transits)`);
      await refreshAll();
    } catch (e) {
      setDemoMsg(e instanceof Error ? e.message : 'Failed to load demo data');
    }
  }

  const sectorsForCity = refs.sectors.filter((s) => s.cityId === (form.cityId || formCityId));
  const hospitalsForCity = refs.hospitals.filter((h) => h.cityId === (form.cityId || formCityId));
  const paramedicsForProvider = refs.paramedics.filter(
    (p) => !form.providerId || p.providerId === form.providerId,
  );

  const activeResource = RESOURCES.find((r) => r.key === active);
  const cityCfg = getCityConfig(form);

  if (!ready) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const columns = items[0]
    ? Object.keys(items[0]).filter((k) => !['password', 'createdAt', 'updatedAt', 'operationalConfig'].includes(k) && typeof items[0][k] !== 'object').slice(0, 7)
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-surface-container-low">
      <TopNav active="/admin" />
      <main className="pt-16 p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">System Administration</h1>
            <p className="text-sm text-on-surface-variant mt-1">Configure cities, fleets, hospitals, and user accounts.</p>
          </div>
          <button type="button" onClick={loadDemoData} className="px-4 py-2 rounded-lg text-sm font-medium bg-tertiary text-white hover:opacity-90 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">database</span>
            Load Demo Data
          </button>
        </div>
        {demoMsg && <p className="text-sm text-on-surface-variant mb-4">{demoMsg}</p>}
        {loadError && (
          <div className="mb-4 p-4 rounded-lg bg-error-container text-on-error-container text-sm flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <button type="button" onClick={refreshAll} className="shrink-0 px-3 py-1 rounded bg-error text-white text-xs font-bold">
              Retry
            </button>
          </div>
        )}

        <div className="flex gap-2 flex-wrap mb-6">
          {RESOURCES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => switchResource(r.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active === r.key ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container'}`}
            >
              <span className="text-[10px] opacity-70 mr-1">{r.step}.</span>
              {r.label}
            </button>
          ))}
        </div>

        {activeResource && (
          <p className="text-sm text-on-surface-variant mb-4 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2">
            <strong>Step {activeResource.step}:</strong> {activeResource.hint}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleSave} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="font-semibold text-lg">{editingId ? 'Edit' : 'Create'} {activeResource?.label}</h2>
            {saveError && <p className="text-sm text-error bg-error-container/30 rounded px-3 py-2">{saveError}</p>}

            {active === 'cities' && (
              <>
                <FormField label="City Name" required>
                  <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Karachi" required />
                </FormField>
                <FormField label="City Code" required hint="Short code used in transit IDs (e.g. KHI-0001).">
                  <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="KHI" required />
                </FormField>
                <FormField label="Province / Region">
                  <TextInput value={(form.province as string) || ''} onChange={(v) => setForm({ ...form, province: v })} placeholder="Sindh" />
                </FormField>
                <FormField
                  label="Max Concurrent Emergencies"
                  hint="Maximum active green corridors allowed in this city at once (default 50)."
                >
                  <TextInput
                    type="number"
                    value={cityCfg.maxConcurrentTransits}
                    onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, maxConcurrentTransits: Number(v) } })}
                  />
                </FormField>
                <FormField
                  label="Latency Alert Speed (km/h)"
                  hint="Safe City flags ambulances moving below this speed as a traffic breach (default 10 km/h)."
                >
                  <TextInput
                    type="number"
                    value={cityCfg.latencySpeedThresholdKmh}
                    onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, latencySpeedThresholdKmh: Number(v) } })}
                  />
                </FormField>
                <FormField label="Default ETA (minutes)" hint="Baseline ETA for new transits.">
                  <TextInput
                    type="number"
                    value={cityCfg.defaultBaselineEtaMinutes}
                    onChange={(v) => setForm({ ...form, operationalConfig: { ...cityCfg, defaultBaselineEtaMinutes: Number(v) } })}
                  />
                </FormField>
              </>
            )}

            {active === 'providers' && (
              <>
                <FormField label="Provider Name" required>
                  <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Rescue 1122" required />
                </FormField>
                <FormField label="Provider Code" required>
                  <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="1122" required />
                </FormField>
                <FormField label="Map Icon Shape" hint="Shape shown on HQ and Safe City live maps.">
                  <ShapePicker
                    value={(form.shape as string) || 'circle'}
                    color={(form.color as string) || '#d93343'}
                    onChange={(shape) => setForm({ ...form, shape })}
                  />
                </FormField>
                <FormField label="Fleet Color">
                  <ColorPicker value={(form.color as string) || '#d93343'} onChange={(color) => setForm({ ...form, color })} />
                </FormField>
                <FormField label="Description">
                  <TextInput value={(form.description as string) || ''} onChange={(v) => setForm({ ...form, description: v })} placeholder="Optional notes" />
                </FormField>
              </>
            )}

            {(active === 'sectors' || active === 'hospitals' || active === 'ambulances') && (
              <FormField label="City" required hint="All records must belong to a city. Create the city first.">
                <SelectInput
                  value={form.cityId as string || formCityId}
                  onChange={(v) => setForm({ ...form, cityId: v, sectorId: '', hospitalId: '' })}
                  options={cityOptions(refs.cities)}
                  required
                />
              </FormField>
            )}

            {active === 'sectors' && (
              <>
                <FormField label="Sector Name" required>
                  <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Mall Road" required />
                </FormField>
                <FormField label="Sector Code" required>
                  <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="A" required />
                </FormField>
                <FormField label="Traffic Grid Status" hint="Current traffic condition for this sector.">
                  <SelectInput
                    value={(form.gridStatus as string) || 'moderate'}
                    onChange={(v) => setForm({ ...form, gridStatus: v })}
                    options={GRID_STATUS_OPTIONS}
                  />
                </FormField>
                <FormField label="Sector Color (map overlay)">
                  <ColorPicker value={(form.color as string) || '#0056b3'} onChange={(color) => setForm({ ...form, color })} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Latitude">
                    <TextInput type="number" step="any" value={(form.latitude as number) ?? ''} onChange={(v) => setForm({ ...form, latitude: v })} placeholder="31.5497" />
                  </FormField>
                  <FormField label="Longitude">
                    <TextInput type="number" step="any" value={(form.longitude as number) ?? ''} onChange={(v) => setForm({ ...form, longitude: v })} placeholder="74.3436" />
                  </FormField>
                </div>
              </>
            )}

            {active === 'hospitals' && (
              <>
                <FormField label="Hospital Name" required>
                  <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Mayo Hospital" required />
                </FormField>
                <FormField label="Address">
                  <TextInput value={(form.address as string) || ''} onChange={(v) => setForm({ ...form, address: v })} placeholder="Hospital Road, Lahore" />
                </FormField>
                <FormField label="Sector" hint="Assign to a traffic sector within the selected city.">
                  <SelectInput
                    value={(form.sectorId as string) || ''}
                    onChange={(v) => setForm({ ...form, sectorId: v })}
                    options={sectorsForCity.map((s) => ({ value: s.id as string, label: `Sector ${s.code}: ${s.name}` }))}
                    placeholder="Select sector..."
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Latitude (GPS)" required hint="Hospital location for map routing.">
                    <TextInput type="number" step="any" value={(form.latitude as number) ?? ''} onChange={(v) => setForm({ ...form, latitude: v })} placeholder="31.5820" required />
                  </FormField>
                  <FormField label="Longitude (GPS)" required>
                    <TextInput type="number" step="any" value={(form.longitude as number) ?? ''} onChange={(v) => setForm({ ...form, longitude: v })} placeholder="74.3290" required />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Bed Capacity">
                    <TextInput type="number" value={(form.bedCapacity as number) ?? ''} onChange={(v) => setForm({ ...form, bedCapacity: v })} placeholder="500" />
                  </FormField>
                  <FormField label="ER Bays">
                    <TextInput type="number" value={(form.erBays as number) ?? ''} onChange={(v) => setForm({ ...form, erBays: v })} placeholder="12" />
                  </FormField>
                </div>
              </>
            )}

            {active === 'emergency-types' && (
              <>
                <FormField label="Emergency Type Name" required>
                  <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Trauma/Cardiac" required />
                </FormField>
                <FormField label="Code" required>
                  <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="TRAUMA" required />
                </FormField>
                <FormField label="Severity Level" hint="Used for dashboard prioritization and alerts.">
                  <SelectInput
                    value={(form.severityLevel as number) ?? 3}
                    onChange={(v) => setForm({ ...form, severityLevel: Number(v) })}
                    options={SEVERITY_OPTIONS}
                  />
                </FormField>
                <FormField label="Description">
                  <TextInput value={(form.description as string) || ''} onChange={(v) => setForm({ ...form, description: v })} placeholder="Optional clinical notes" />
                </FormField>
              </>
            )}

            {active === 'triage-codes' && (
              <>
                <FormField label="Triage Code Name" required>
                  <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} placeholder="Code Red" required />
                </FormField>
                <FormField label="Code" required>
                  <TextInput value={(form.code as string) || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="RED" required />
                </FormField>
                <FormField label="Priority Level" hint="1 = highest priority. Lower number = more urgent.">
                  <SelectInput
                    value={(form.priority as number) ?? 1}
                    onChange={(v) => setForm({ ...form, priority: Number(v) })}
                    options={TRIAGE_PRIORITY_OPTIONS}
                  />
                </FormField>
                <FormField label="Display Color">
                  <ColorPicker value={(form.color as string) || '#ba1a1a'} onChange={(color) => setForm({ ...form, color })} />
                </FormField>
              </>
            )}

            {active === 'users' && (
              <>
                <FormField label="Full Name" required>
                  <TextInput value={(form.name as string) || ''} onChange={(v) => setForm({ ...form, name: v })} required />
                </FormField>
                <FormField label="Email" required>
                  <TextInput value={(form.email as string) || ''} onChange={(v) => setForm({ ...form, email: v })} placeholder="user@gchq.pk" required />
                </FormField>
                <FormField label="Password" required={!editingId} hint={editingId ? 'Leave blank to keep current password.' : 'Minimum 6 characters.'}>
                  <TextInput type="password" value={(form.password as string) || ''} onChange={(v) => setForm({ ...form, password: v })} required={!editingId} />
                </FormField>
                <FormField label="Role" required>
                  <SelectInput
                    value={(form.role as string) || 'hospital'}
                    onChange={(v) => setForm({ ...form, role: v, hospitalId: '', providerId: '' })}
                    options={USER_ROLE_OPTIONS}
                  />
                </FormField>
                <FormField label="City" hint="Required for city-scoped roles. Leave empty for Admin/VVIP.">
                  <SelectInput
                    value={(form.cityId as string) || ''}
                    onChange={(v) => setForm({ ...form, cityId: v, hospitalId: '' })}
                    options={cityOptions(refs.cities)}
                    placeholder="Select city..."
                  />
                </FormField>
                {form.role === 'hospital' && (
                  <FormField label="Assigned Hospital" required>
                    <SelectInput
                      value={(form.hospitalId as string) || ''}
                      onChange={(v) => setForm({ ...form, hospitalId: v })}
                      options={hospitalsForCity.map((h) => ({ value: h.id as string, label: h.name as string }))}
                      placeholder="Select hospital..."
                      required
                    />
                  </FormField>
                )}
                {form.role === 'paramedic' && (
                  <FormField label="Fleet Provider" required hint="Links this driver to a fleet for ambulance assignment.">
                    <SelectInput
                      value={(form.providerId as string) || ''}
                      onChange={(v) => setForm({ ...form, providerId: v })}
                      options={refs.providers.map((p) => ({ value: p.id as string, label: p.name as string }))}
                      placeholder="Select provider..."
                      required
                    />
                  </FormField>
                )}
                {form.role === 'hq_1122' && (
                  <>
                    <FormField label="Role Type" hint="Overseer sees all sectors. CSR is assigned to one sector and claims corridors.">
                      <SelectInput
                        value={form.isCityOverseer ? 'overseer' : 'csr'}
                        onChange={(v) => setForm({ ...form, isCityOverseer: v === 'overseer', sectorId: v === 'overseer' ? '' : form.sectorId })}
                        options={[
                          { value: 'csr', label: 'Sector CSR (guides ambulances)' },
                          { value: 'overseer', label: 'City Overseer (watches only)' },
                        ]}
                      />
                    </FormField>
                    {!form.isCityOverseer && (
                      <FormField label="Assigned Sector" required>
                        <SelectInput
                          value={(form.sectorId as string) || ''}
                          onChange={(v) => setForm({ ...form, sectorId: v })}
                          options={sectorsForCity.map((s) => ({ value: s.id as string, label: `Sector ${s.code}: ${s.name}` }))}
                          placeholder="Select sector..."
                          required
                        />
                      </FormField>
                    )}
                  </>
                )}
              </>
            )}

            {active === 'ambulances' && (
              <>
                <InfoBox title="Ambulance & GPS Setup Flow">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a <strong>Paramedic</strong> user and assign their fleet provider.</li>
                    <li>Register the ambulance unit here with city + provider.</li>
                    <li>Assign the paramedic as <strong>Driver</strong> below.</li>
                    <li>GPS tracker sends location to:<br />
                      <code className="text-[10px] bg-surface-container-high px-1 rounded">PATCH /api/ambulances/&#123;id&#125;/gps</code><br />
                      Body: <code className="text-[10px]">{`{ "latitude": 31.55, "longitude": 74.34, "speed": 45 }`}</code>
                    </li>
                    <li>Driver logs in at <strong>/driver</strong> — system matches unit via driverId.</li>
                  </ol>
                </InfoBox>
                <FormField label="Unit Number" required>
                  <TextInput value={(form.unitNumber as string) || ''} onChange={(v) => setForm({ ...form, unitNumber: v })} placeholder="RESCUE-782" required />
                </FormField>
                <FormField label="Fleet Provider" required>
                  <SelectInput
                    value={(form.providerId as string) || ''}
                    onChange={(v) => setForm({ ...form, providerId: v, driverId: '' })}
                    options={refs.providers.map((p) => ({ value: p.id as string, label: `${p.name} (${p.code})` }))}
                    placeholder="Select provider..."
                    required
                  />
                </FormField>
                <FormField label="Assigned Driver (Paramedic)" hint="Links this unit to the mobile /driver app user.">
                  <SelectInput
                    value={(form.driverId as string) || ''}
                    onChange={(v) => setForm({ ...form, driverId: v })}
                    options={paramedicsForProvider.map((p) => ({ value: p.id as string, label: `${p.name} (${p.email})` }))}
                    placeholder="No driver assigned"
                  />
                </FormField>
                <FormField label="Status">
                  <SelectInput
                    value={(form.status as string) || 'available'}
                    onChange={(v) => setForm({ ...form, status: v })}
                    options={AMBULANCE_STATUS_OPTIONS}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Initial Latitude" hint="Last known GPS position.">
                    <TextInput type="number" step="any" value={(form.currentLat as number) ?? ''} onChange={(v) => setForm({ ...form, currentLat: v })} placeholder="31.5497" />
                  </FormField>
                  <FormField label="Initial Longitude">
                    <TextInput type="number" step="any" value={(form.currentLng as number) ?? ''} onChange={(v) => setForm({ ...form, currentLng: v })} placeholder="74.3436" />
                  </FormField>
                </div>
                {editingId && (
                  <InfoBox title="GPS Tracker API">
                    <p>Device ID (ambulance): <strong className="font-mono">{editingId}</strong></p>
                    <p className="mt-1">Endpoint: <code className="text-[10px]">PATCH {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/ambulances/{editingId}/gps</code></p>
                  </InfoBox>
                )}
              </>
            )}

            <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-lg font-bold text-sm hover:brightness-110">
              {editingId ? 'Update Record' : 'Create Record'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="w-full border border-outline-variant py-2 rounded-lg text-sm">
                Cancel Edit
              </button>
            )}
          </form>

          <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
              <span className="font-semibold text-sm">{items.length} record(s)</span>
              {CITY_SCOPED.includes(active) && (
                <span className="text-xs text-on-surface-variant">
                  Filtered by city: {refs.cities.find((c) => c.id === (formCityId || navCityId))?.name || 'All'}
                </span>
              )}
            </div>
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-container-low">
                  <tr className="text-left">
                    {columns.map((c) => <th key={c} className="px-4 py-3 capitalize text-xs font-bold text-on-surface-variant">{c.replace(/Id$/, '')}</th>)}
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {items.map((item) => (
                    <tr key={item.id as string} className="hover:bg-surface-container-low/50">
                      {columns.map((c) => <td key={c} className="px-4 py-3">{String(item[c] ?? '')}</td>)}
                      <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                        <button type="button" onClick={() => startEdit(item)} className="text-primary text-xs font-bold">Edit</button>
                        <button type="button" onClick={() => handleDelete(item.id as string)} className="text-error text-xs font-bold">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={columns.length + 1} className="px-4 py-12 text-center text-on-surface-variant">No records yet. Create one using the form.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
