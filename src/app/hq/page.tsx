'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TopNav } from '@/components/ui';
import { api, cityQuery } from '@/lib/api';
import { useAuthGuard, useSocket, useLiveEta } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';

interface Transit {
  id: string;
  transitId: string;
  etaMinutes: number;
  status: string;
  claimedById?: string | null;
  claimedBy?: { id: string; name: string } | null;
  hospitalId?: string;
  sectorId?: string | null;
  currentLat?: number | string | null;
  currentLng?: number | string | null;
  originLat?: number | string | null;
  originLng?: number | string | null;
  ambulance: {
    unitNumber: string;
    providerId?: string;
    provider?: { id?: string; name?: string; code?: string; color?: string; shape?: string };
  };
  hospital: {
    id?: string;
    name: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
  emergencyType: { name: string };
  triageCode: { name: string; priority: number };
  sector?: { id: string; name: string; code: string } | null;
}

interface HqData {
  activeTransits: Transit[];
  unclaimedCorridors: Transit[];
  isCityOverseer: boolean;
  sectorId: string | null;
  stats: { activeEmergencies: number; greenCorridors: number; todayCompleted: number; unclaimed: number };
}

function EmergencyCard({
  transit,
}: {
  transit: Transit;
}) {
  const eta = useLiveEta(transit.etaMinutes);
  const isCritical = transit.triageCode.priority === 1;

  return (
    <Link
      href={`/hq/corridor/${transit.id}`}
      className={`block p-4 space-y-3 transition-all min-h-[190px] cursor-pointer group ${
        isCritical ? 'dash-card-critical animate-pulse' : 'dash-card'
      }`}
      title="Open live map & route for this corridor"
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className={`font-bold font-mono text-lg ${isCritical ? 'text-error' : 'text-slate-800'}`}>{transit.transitId}</h4>
          <p className="text-sm font-semibold text-slate-700">To: {transit.hospital.name}</p>
          {transit.sector && <p className="text-[11px] text-slate-500">Sector {transit.sector.code}: {transit.sector.name}</p>}
          {transit.ambulance.provider?.name && (
            <p className="text-[11px] text-slate-500">Fleet: {transit.ambulance.provider.name}</p>
          )}
        </div>
        <div className="text-right">
          <span className={`text-xl font-semibold ${isCritical ? 'text-error' : 'text-slate-800'}`}>{eta}</span>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">ETA</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCritical ? 'bg-error-container text-on-error-container' : 'pill-amber'}`}>
          {isCritical ? 'CRITICAL' : 'URGENT'}
        </span>
        <span className="px-2 py-0.5 bg-white/80 border border-outline-variant rounded text-[10px] font-mono">{transit.emergencyType.name}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>map</span>
          View route
        </span>
      </div>
    </Link>
  );
}

const selectClass = 'border border-outline-variant rounded-xl px-2.5 py-1.5 text-xs bg-white/90 focus:outline-none focus:border-primary min-w-[120px] shadow-sm';

export default function HqDashboard() {
  const { ready } = useAuthGuard('hq_1122');
  const { cityId, loading: cityLoading } = useCityContext();
  const [data, setData] = useState<HqData | null>(null);
  const [error, setError] = useState('');
  const [filterHospital, setFilterHospital] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [refHospitals, setRefHospitals] = useState<{ id: string; name: string }[]>([]);
  const [refSectors, setRefSectors] = useState<{ id: string; name: string; code: string }[]>([]);
  const [refProviders, setRefProviders] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!cityId || !ready) return;
    const q = cityQuery(cityId);
    Promise.all([
      api<{ id: string; name: string }[]>(`/hospitals${q}`).catch(() => []),
      api<{ id: string; name: string; code: string }[]>(`/sectors${q}`).catch(() => []),
      api<{ id: string; name: string }[]>(`/providers${q}`).catch(() => []),
    ]).then(([hospitals, sectors, providers]) => {
      setRefHospitals(Array.isArray(hospitals) ? hospitals : []);
      setRefSectors(Array.isArray(sectors) ? sectors : []);
      setRefProviders(Array.isArray(providers) ? providers : []);
    });
  }, [cityId, ready]);

  const load = useCallback(async () => {
    if (!cityId) return;
    try {
      setError('');
      const next = await api<HqData>(`/dashboard/hq${cityQuery(cityId)}`);
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [cityId]);

  useEffect(() => { if (ready && cityId) load(); }, [ready, cityId, load]);
  useSocket(load);

  const filterOptions = useMemo(() => {
    const hospitals = refHospitals.length
      ? refHospitals.map((h) => ({ value: h.id, label: h.name }))
      : [];
    const sectors = refSectors.length
      ? refSectors.map((s) => ({ value: s.id, label: `Sector ${s.code}: ${s.name}` }))
      : [];
    const providers = refProviders.length
      ? refProviders.map((p) => ({ value: p.id, label: p.name }))
      : [];

    // Fall back to labels from active trips if reference APIs empty
    if (!hospitals.length || !sectors.length || !providers.length) {
      for (const t of data?.activeTransits ?? []) {
        const hid = t.hospitalId || t.hospital.id;
        if (hid && !hospitals.some((h) => h.value === hid)) {
          hospitals.push({ value: hid, label: t.hospital.name });
        }
        if (t.sector?.id && !sectors.some((s) => s.value === t.sector!.id)) {
          sectors.push({ value: t.sector.id, label: `Sector ${t.sector.code}: ${t.sector.name}` });
        }
        const pid = t.ambulance.provider?.id || t.ambulance.providerId;
        if (pid && t.ambulance.provider?.name && !providers.some((p) => p.value === pid)) {
          providers.push({ value: pid, label: t.ambulance.provider.name });
        }
      }
    }

    return { hospitals, sectors, providers };
  }, [data?.activeTransits, refHospitals, refProviders, refSectors]);

  const filteredTransits = useMemo(() => {
    let list = data?.activeTransits ?? [];
    if (filterHospital) {
      list = list.filter((t) => (t.hospitalId || t.hospital.id) === filterHospital);
    }
    if (filterSector) {
      list = list.filter((t) => (t.sectorId || t.sector?.id) === filterSector);
    }
    if (filterProvider) {
      list = list.filter((t) => {
        const pid = t.ambulance.provider?.id || t.ambulance.providerId || t.ambulance.provider?.name;
        return pid === filterProvider;
      });
    }
    return list;
  }, [data?.activeTransits, filterHospital, filterSector, filterProvider]);

  if (!ready || cityLoading || (cityId && !data && !error)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  if (!cityId) {
    return <div className="min-h-screen flex items-center justify-center text-on-surface-variant">Select a city from the top navigation.</div>;
  }
  if (error && !data) {
    return <div className="min-h-screen flex items-center justify-center text-error">{error}</div>;
  }
  if (!data) return null;

  const isOverseer = !!data.isCityOverseer;
  const roleLabel = isOverseer ? 'City Overseer' : 'Sector CSR';
  const listForPanel = filteredTransits.filter((t) => t.status === 'pending' || t.status === 'en_route' || t.status === 'arrived');

  const hasFilters = !!(filterHospital || filterSector || filterProvider);

  return (
    <div className="min-h-screen ops-shell">
      <TopNav active="/hq" />
      <main className="pt-16 px-4 pb-6">
        <div className="py-4 flex flex-wrap items-center gap-2">
          <span className="section-kicker mr-1">Filter</span>
          <select
            className={selectClass}
            value={filterHospital}
            onChange={(e) => setFilterHospital(e.target.value)}
          >
            <option value="">All hospitals</option>
            {filterOptions.hospitals.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
          >
            <option value="">All sectors</option>
            {filterOptions.sectors.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
          >
            <option value="">All providers</option>
            {filterOptions.providers.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilterHospital(''); setFilterSector(''); setFilterProvider(''); }}
              className="text-xs text-primary font-bold px-2 py-1 hover:underline"
            >
              Clear filters
            </button>
          )}
          <span className="text-[11px] text-on-surface-variant">{roleLabel}</span>
        </div>

        {error && <p className="text-sm text-error pb-2">{error}</p>}

        <section className="dash-panel overflow-hidden">
          <div className="dash-panel-header px-5 py-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{isOverseer ? 'City Corridors' : 'Sector Corridors'}</h3>
              <p className="text-[11px] text-on-surface-variant">{listForPanel.length} ongoing corridors shown{hasFilters ? ' (filtered)' : ''}</p>
            </div>
            <span className="live-badge">LIVE</span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {listForPanel.map((t) => (
              <EmergencyCard key={t.id} transit={t} />
            ))}
            {listForPanel.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-8 col-span-full">
                No ongoing corridors match these filters
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
