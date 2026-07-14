'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopNav, StatCard } from '@/components/ui';
import { api, cityQuery, getStoredUser } from '@/lib/api';
import { useAuthGuard, useSocket, useLiveEta } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { OsmMap } from '@/components/OsmMap';
import { MapMarker, MapRoute, parseCoord, fallbackPosition, LAHORE_CENTER } from '@/components/map-types';
import { buildDemoRoute } from '@/lib/demo-route';

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
  onClaim,
  claiming,
  isOverseer,
  myId,
  busyGuiding,
  selected,
  onSelect,
}: {
  transit: Transit;
  onClaim: (id: string) => void;
  claiming: string | null;
  isOverseer: boolean;
  myId?: string;
  busyGuiding: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const eta = useLiveEta(transit.etaMinutes);
  const isCritical = transit.triageCode.priority === 1;
  const mine = transit.claimedById === myId;

  return (
    <div
      onClick={onSelect}
      className={`bg-surface-container-low border-l-4 rounded p-4 space-y-3 cursor-pointer transition-all ${
        isCritical ? 'border-l-error' : 'border-l-tertiary'
      } ${mine ? 'ring-2 ring-primary' : ''} ${selected ? 'ring-2 ring-primary bg-primary/5 shadow-md' : 'hover:bg-surface-container'}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h4 className={`font-bold font-mono text-lg ${isCritical ? 'text-error' : 'text-tertiary'}`}>{transit.transitId}</h4>
          <p className="text-sm text-on-surface-variant">To: {transit.hospital.name}</p>
          {transit.sector && <p className="text-[11px] text-on-surface-variant">Sector {transit.sector.code}: {transit.sector.name}</p>}
          {transit.ambulance.provider?.name && (
            <p className="text-[11px] text-on-surface-variant">Fleet: {transit.ambulance.provider.name}</p>
          )}
        </div>
        <div className="text-right">
          <span className={`text-xl font-semibold ${isCritical ? 'text-error' : 'text-tertiary'}`}>{eta}</span>
          <p className="text-[10px] text-on-surface-variant uppercase">ETA</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCritical ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
          {isCritical ? 'CRITICAL' : 'URGENT'}
        </span>
        <span className="px-2 py-0.5 bg-white border border-outline-variant rounded text-[10px] font-mono">{transit.emergencyType.name}</span>
        {transit.claimedBy ? (
          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold">
            {mine ? 'YOU GUIDING' : `CSR: ${transit.claimedBy.name}`}
          </span>
        ) : (
          !isOverseer && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClaim(transit.id); }}
              disabled={claiming === transit.id || busyGuiding}
              title={busyGuiding ? 'Finish or close your current guidance first' : undefined}
              className="px-3 py-1 rounded bg-primary text-white text-[10px] font-bold disabled:opacity-40"
            >
              {claiming === transit.id ? '...' : busyGuiding ? 'BUSY' : 'CLAIM & GUIDE'}
            </button>
          )
        )}
        {selected && (
          <span className="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-bold">MAP FOCUSED</span>
        )}
      </div>
    </div>
  );
}

const selectClass = 'border border-outline-variant rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-primary min-w-[120px]';

export default function HqDashboard() {
  const { user, ready } = useAuthGuard('hq_1122');
  const { cityId, loading: cityLoading } = useCityContext();
  const [data, setData] = useState<HqData | null>(null);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState<Transit | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [claiming, setClaiming] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [guidingId, setGuidingId] = useState<string | null>(null);
  /** Overseer / free CSR: focus one incident on the map; null = overall city view */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterHospital, setFilterHospital] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [refHospitals, setRefHospitals] = useState<{ id: string; name: string }[]>([]);
  const [refSectors, setRefSectors] = useState<{ id: string; name: string; code: string }[]>([]);
  const [refProviders, setRefProviders] = useState<{ id: string; name: string }[]>([]);

  const me = user || getStoredUser();

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

      const myActive = next.activeTransits.find(
        (t) =>
          t.claimedById === me?.id &&
          (t.status === 'en_route' || t.status === 'pending' || t.status === 'arrived'),
      );

      if (myActive) {
        setGuidingId(myActive.id);
        setPopup(null);
      } else {
        setGuidingId(null);
        if (!next.isCityOverseer) {
          const fresh = (next.unclaimedCorridors || []).find((t) => !dismissedIds.has(t.id));
          setPopup(fresh ?? null);
        } else {
          setPopup(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [cityId, dismissedIds, me?.id]);

  useEffect(() => { if (ready && cityId) load(); }, [ready, cityId, load]);
  useSocket(load);

  // Clear selection if filtered out or trip gone
  useEffect(() => {
    if (!selectedId || !data) return;
    if (!data.activeTransits.some((t) => t.id === selectedId)) {
      setSelectedId(null);
    }
  }, [data, selectedId]);

  async function claim(id: string) {
    if (guidingId) {
      setError('Finish or close your current guidance before taking another corridor.');
      return;
    }
    setClaiming(id);
    try {
      await api(`/transits/${id}/claim`, { method: 'PATCH' });
      setPopup(null);
      setGuidingId(id);
      setSelectedId(id);
      setDismissedIds((prev) => new Set(prev).add(id));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setClaiming(null);
    }
  }

  async function closeGuidance() {
    if (!guidingId) return;
    setReleasing(true);
    try {
      await api(`/transits/${guidingId}/release`, { method: 'PATCH' });
      setGuidingId(null);
      setPopup(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not close guidance');
    } finally {
      setReleasing(false);
    }
  }

  const meId = me?.id;
  const isOverseerPreview = data?.isCityOverseer || me?.role === 'admin';
  const myGuided = data?.activeTransits.find((t) => t.id === guidingId)
    ?? data?.activeTransits.find((t) => t.claimedById === meId)
    ?? null;
  const busyGuiding = !!(guidingId || myGuided) && !isOverseerPreview && !!myGuided
    && (myGuided.status === 'en_route' || myGuided.status === 'pending' || myGuided.status === 'arrived');

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

  const isOverseer = !!isOverseerPreview;
  const roleLabel = isOverseer ? 'City Overseer' : `Sector CSR${me?.sector?.name ? ` · ${me.sector.name}` : ''}`;

  const listForPanel = busyGuiding && myGuided ? [myGuided] : filteredTransits;
  const enRouteFiltered = listForPanel.filter((t) => t.status === 'en_route' || t.status === 'arrived' || t.status === 'pending');

  // Map: CSR guiding → their unit only; else if incident selected → that route only; else overall (filtered)
  const selectedTransit = selectedId
    ? enRouteFiltered.find((t) => t.id === selectedId) ?? data.activeTransits.find((t) => t.id === selectedId)
    : null;

  const mapTransits = busyGuiding && myGuided
    ? [myGuided]
    : selectedTransit
      ? [selectedTransit]
      : enRouteFiltered.filter((t) => t.status === 'en_route');

  const focus = mapTransits[0];
  const mapFocused = busyGuiding || !!selectedTransit;

  const markers: MapMarker[] = mapTransits.map((t, i) => {
    const lat = parseCoord(t.currentLat) ?? parseCoord(t.originLat) ?? fallbackPosition(i)[0];
    const lng = parseCoord(t.currentLng) ?? parseCoord(t.originLng) ?? fallbackPosition(i)[1];
    return {
      id: t.id,
      lat,
      lng,
      label: t.transitId,
      color: t.ambulance.provider?.color || '#d93343',
      shape: t.ambulance.provider?.shape || 'circle',
      sublabel: `${t.ambulance.unitNumber} → ${t.hospital.name}`,
    };
  });

  const routes: MapRoute[] = mapTransits.map((t, i) => {
    const fromLat = parseCoord(t.currentLat) ?? parseCoord(t.originLat) ?? fallbackPosition(i)[0];
    const fromLng = parseCoord(t.currentLng) ?? parseCoord(t.originLng) ?? fallbackPosition(i)[1];
    const toLat = parseCoord(t.hospital.latitude) ?? LAHORE_CENTER[0];
    const toLng = parseCoord(t.hospital.longitude) ?? LAHORE_CENTER[1];
    return {
      id: `route-${t.id}`,
      positions: buildDemoRoute([fromLat, fromLng], [toLat, toLng]),
      color: t.ambulance.provider?.color || '#0056b3',
    };
  });

  const mapCenter: [number, number] = focus
    ? [
        parseCoord(focus.currentLat) ?? parseCoord(focus.originLat) ?? LAHORE_CENTER[0],
        parseCoord(focus.currentLng) ?? parseCoord(focus.originLng) ?? LAHORE_CENTER[1],
      ]
    : LAHORE_CENTER;

  const hasFilters = !!(filterHospital || filterSector || filterProvider);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopNav active="/hq" />
      <main className="flex-1 pt-16 flex flex-col relative overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 z-20">
          <StatCard label="Active Emergencies" value={data.stats.activeEmergencies} accent="error" />
          <StatCard label="Green Corridors" value={data.stats.greenCorridors} accent="tertiary" />
          <StatCard label="Unclaimed" value={data.stats.unclaimed ?? 0} accent="secondary" />
          <StatCard label="Completed Today" value={data.stats.todayCompleted} />
        </div>

        {/* Filters + map mode */}
        <div className="px-4 pb-2 z-20 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase text-on-surface-variant mr-1">Filter</span>
          <select
            className={selectClass}
            value={filterHospital}
            onChange={(e) => { setFilterHospital(e.target.value); setSelectedId(null); }}
          >
            <option value="">All hospitals</option>
            {filterOptions.hospitals.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filterSector}
            onChange={(e) => { setFilterSector(e.target.value); setSelectedId(null); }}
          >
            <option value="">All sectors</option>
            {filterOptions.sectors.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filterProvider}
            onChange={(e) => { setFilterProvider(e.target.value); setSelectedId(null); }}
          >
            <option value="">All providers</option>
            {filterOptions.providers.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilterHospital(''); setFilterSector(''); setFilterProvider(''); setSelectedId(null); }}
              className="text-xs text-primary font-bold px-2 py-1 hover:underline"
            >
              Clear filters
            </button>
          )}

          <span className="hidden sm:inline text-outline-variant mx-1">|</span>

          {mapFocused && !busyGuiding && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white"
            >
              Show overall map
            </button>
          )}
          {!mapFocused && !busyGuiding && (
            <span className="text-[11px] text-on-surface-variant">
              Click an incident to focus its route · {roleLabel}
            </span>
          )}
          {busyGuiding && (
            <span className="text-[11px] text-primary font-medium">Guiding one unit — new intimations paused</span>
          )}
        </div>

        {error && <p className="px-4 text-sm text-error z-20">{error}</p>}

        <div className="flex-1 relative">
          <div className="absolute inset-0 z-0">
            <OsmMap
              center={mapCenter}
              zoom={mapFocused ? 14 : 12}
              markers={markers}
              routes={routes}
              className="h-full w-full z-0"
              onMarkerClick={(id) => {
                if (busyGuiding) return;
                setSelectedId((prev) => (prev === id ? null : id));
              }}
            />
          </div>

          {selectedTransit && !busyGuiding && (
            <div className="absolute top-4 left-4 z-40 max-w-sm bg-white/95 backdrop-blur border border-primary rounded-xl shadow-lg p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase text-primary">Focused incident</p>
              <p className="font-mono font-bold text-lg">{selectedTransit.transitId}</p>
              <p className="text-sm">Unit <strong>{selectedTransit.ambulance.unitNumber}</strong> → {selectedTransit.hospital.name}</p>
              <p className="text-xs text-on-surface-variant">
                {selectedTransit.ambulance.provider?.name || 'Fleet'} · {selectedTransit.sector ? `Sector ${selectedTransit.sector.code}` : 'No sector'}
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="w-full mt-1 border border-outline-variant hover:bg-surface-container-low font-bold text-sm py-2 rounded-lg"
              >
                Back to overall view
              </button>
            </div>
          )}

          {busyGuiding && myGuided && (
            <div className="absolute top-4 left-4 z-40 max-w-sm bg-white/95 backdrop-blur border border-primary rounded-xl shadow-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-error rounded-full severity-pulse" />
                <span className="text-xs font-bold uppercase text-primary">Guiding session</span>
              </div>
              <div>
                <p className="font-mono font-bold text-lg">{myGuided.transitId}</p>
                <p className="text-sm">Unit <strong>{myGuided.ambulance.unitNumber}</strong> → {myGuided.hospital.name}</p>
                <p className="text-xs text-on-surface-variant">{myGuided.triageCode.name}: {myGuided.emergencyType.name}</p>
              </div>
              <button
                type="button"
                onClick={closeGuidance}
                disabled={releasing}
                className="w-full border border-outline-variant hover:bg-surface-container-low font-bold text-sm py-2.5 rounded-lg disabled:opacity-50"
              >
                {releasing ? 'Closing...' : 'Close guidance — route is clear'}
              </button>
            </div>
          )}

          <div className="absolute top-0 right-0 bottom-0 w-[380px] bg-white/95 backdrop-blur-md border-l border-outline-variant flex flex-col z-30">
            <div className="p-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold flex items-center justify-between">
                {busyGuiding ? 'Your Active Guide' : isOverseer ? 'City Incidents' : 'Sector Queue'}
                <span className="text-sm font-mono bg-error-container text-on-error-container px-2 py-0.5 rounded">LIVE</span>
              </h3>
              <p className="text-[11px] text-on-surface-variant mt-1">
                {listForPanel.length} shown
                {hasFilters ? ' (filtered)' : ''}
                {selectedTransit ? ` · map: ${selectedTransit.transitId}` : ' · map: overall'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {listForPanel.map((t) => (
                <EmergencyCard
                  key={t.id}
                  transit={t}
                  onClaim={claim}
                  claiming={claiming}
                  isOverseer={!!isOverseer}
                  myId={me?.id}
                  busyGuiding={busyGuiding}
                  selected={selectedId === t.id || (busyGuiding && myGuided?.id === t.id)}
                  onSelect={() => {
                    if (busyGuiding) return;
                    setSelectedId((prev) => (prev === t.id ? null : t.id));
                  }}
                />
              ))}
              {listForPanel.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-8">
                  No corridors match these filters
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {popup && !isOverseer && !busyGuiding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border-l-8 border-error">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-error text-3xl">notifications_active</span>
              <div>
                <h3 className="text-lg font-bold text-error">Green Corridor Request</h3>
                <p className="text-sm text-on-surface-variant">An ambulance needs guidance in your sector.</p>
              </div>
            </div>
            <div className="bg-surface-container-low rounded-lg p-4 space-y-1">
              <p className="font-mono font-bold text-xl">{popup.transitId}</p>
              <p className="text-sm">Unit <strong>{popup.ambulance.unitNumber}</strong> → {popup.hospital.name}</p>
              <p className="text-sm">{popup.triageCode.name}: {popup.emergencyType.name}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => claim(popup.id)}
                disabled={!!claiming}
                className="flex-1 bg-primary text-white font-bold py-3 rounded-lg disabled:opacity-50"
              >
                {claiming ? 'Claiming...' : "I'm free — Claim & Guide"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedIds((prev) => new Set(prev).add(popup.id));
                  setPopup(null);
                }}
                className="px-4 py-3 border border-outline-variant rounded-lg text-sm"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
