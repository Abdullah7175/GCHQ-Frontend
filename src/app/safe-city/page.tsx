'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopNav, StatCard } from '@/components/ui';
import { api, cityQuery } from '@/lib/api';
import { useAuthGuard, useSocket, useLiveEta } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { OsmMap } from '@/components/OsmMap';
import { MapMarker, MapRoute, parseCoord, fallbackPosition, LAHORE_CENTER } from '@/components/map-types';

interface Corridor {
  id: string;
  transitId: string;
  etaMinutes: number;
  currentSpeed: number;
  currentLat?: number | string | null;
  currentLng?: number | string | null;
  originLat?: number | string | null;
  originLng?: number | string | null;
  ambulance: { unitNumber: string; provider: { name: string; color: string; shape?: string } };
  hospital: { name: string; latitude?: number | string | null; longitude?: number | string | null };
  sector: { name: string };
  triageCode: { name: string };
}

interface Sector {
  id: string;
  name: string;
  code: string;
  gridStatus: string;
  overrideActive: boolean;
  color: string;
}

interface SafeCityData {
  activeCorridors: Corridor[];
  sectors: Sector[];
  latencyBreaches: Corridor[];
  stats: { activeCorridorsCount: number; fleetEnRoute: number };
}

function CorridorCard({ corridor }: { corridor: Corridor }) {
  const eta = useLiveEta(corridor.etaMinutes);
  const progress = corridor.etaMinutes ? Math.min(100, Math.max(0, 100 - corridor.etaMinutes * 5)) : 50;

  return (
    <div className="bg-surface p-4 rounded-xl border border-outline-variant relative overflow-hidden shadow-sm">
      <div className="absolute top-2 right-2">
        <span className="text-[10px] font-mono text-primary font-bold">LIVE</span>
      </div>
      <div className="flex justify-between items-end mb-4">
        <div>
          <div className="text-[10px] font-mono text-on-surface-variant">UNIT ID</div>
          <div className="text-lg font-semibold">{corridor.ambulance.unitNumber}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-on-surface-variant">PRIORITY</div>
          <div className="text-primary font-bold">{corridor.triageCode.name}</div>
        </div>
      </div>
      <div className="mb-2 flex justify-between text-[11px] font-mono text-on-surface-variant">
        <span>{corridor.sector?.name} → {corridor.hospital.name}</span>
        <span>ETA: {eta}</span>
      </div>
      <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 text-[10px] text-on-surface-variant">
        Speed: {Number(corridor.currentSpeed).toFixed(0)} km/h
      </div>
    </div>
  );
}

export default function SafeCityDashboard() {
  const { ready } = useAuthGuard('safe_city');
  const { cityId, loading: cityLoading } = useCityContext();
  const [data, setData] = useState<SafeCityData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!cityId) return;
    try {
      setError('');
      setData(await api<SafeCityData>(`/dashboard/safe-city${cityQuery(cityId)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [cityId]);

  useEffect(() => { if (ready && cityId) load(); }, [ready, cityId, load]);
  useSocket(load);

  if (!ready || cityLoading || (cityId && !data && !error)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!cityId) {
    return <div className="min-h-screen flex items-center justify-center text-on-surface-variant">Select a city from the top navigation.</div>;
  }

  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center text-error">{error || 'No data'}</div>;
  }

  const markers: MapMarker[] = data.activeCorridors.map((c, i) => {
    const lat = parseCoord(c.currentLat) ?? parseCoord(c.originLat) ?? fallbackPosition(i)[0];
    const lng = parseCoord(c.currentLng) ?? parseCoord(c.originLng) ?? fallbackPosition(i)[1];
    return {
      id: c.id,
      lat,
      lng,
      label: c.transitId,
      color: c.ambulance.provider?.color || '#d93343',
      shape: c.ambulance.provider?.shape || 'circle',
      sublabel: `${c.ambulance.unitNumber} → ${c.hospital.name}`,
    };
  });

  const routes: MapRoute[] = data.activeCorridors.map((c, i) => {
    const fromLat = parseCoord(c.currentLat) ?? parseCoord(c.originLat) ?? fallbackPosition(i)[0];
    const fromLng = parseCoord(c.currentLng) ?? parseCoord(c.originLng) ?? fallbackPosition(i)[1];
    const toLat = parseCoord(c.hospital.latitude) ?? LAHORE_CENTER[0];
    const toLng = parseCoord(c.hospital.longitude) ?? LAHORE_CENTER[1];
    return {
      id: `route-${c.id}`,
      positions: [[fromLat, fromLng], [toLat, toLng]],
      color: c.ambulance.provider?.color || '#0056b3',
    };
  });

  const gridStatusColor: Record<string, string> = {
    flowing: 'text-green-600',
    moderate: 'text-tertiary',
    saturating: 'text-primary',
    gridlocked: 'text-error',
  };

  async function toggleOverride(id: string) {
    await api(`/sectors/${id}/toggle-override`, { method: 'PATCH' });
    load();
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopNav active="/safe-city" />
      <main className="flex-1 pt-16 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 relative overflow-hidden min-h-[400px]">
          <OsmMap center={LAHORE_CENTER} zoom={12} markers={markers} routes={routes} className="h-full w-full" />
          <div className="absolute top-4 left-4 z-[1000] glass-panel px-3 py-1.5 rounded border border-outline-variant">
            <p className="text-[10px] font-bold text-primary uppercase">Live Route Coordination — OpenStreetMap</p>
          </div>

          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur p-4 rounded border border-outline-variant shadow-lg space-y-2 z-[1000]">
            <p className="text-xs font-bold uppercase text-on-surface-variant mb-2">Fleet Legend</p>
            <div className="flex items-center gap-2 text-sm"><div className="w-3 h-3 bg-[#d93343] rounded-full" /> Rescue 1122</div>
            <div className="flex items-center gap-2 text-sm"><div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#f59e0b]" /> Edhi</div>
            <div className="flex items-center gap-2 text-sm"><div className="w-3 h-3 bg-[#2563eb]" /> Chhipa</div>
            <div className="flex items-center gap-2 text-sm"><div className="w-3 h-3 bg-[#16a34a] rotate-45" /> Al-Khidmat</div>
          </div>

          {data.latencyBreaches.length > 0 && (
            <div className="absolute top-4 right-4 z-[1000] bg-error text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
              <p className="font-bold text-sm">{data.latencyBreaches.length} Latency Breach(es)</p>
              <p className="text-xs opacity-90">Vehicle below 10 km/h</p>
            </div>
          )}
        </div>

        <aside className="w-full md:w-[380px] bg-surface-container-low border-l border-outline-variant flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Active Corridors" value={data.stats.activeCorridorsCount} />
            <StatCard label="Fleet En Route" value={data.stats.fleetEnRoute} accent="tertiary" />
          </div>

          <section>
            <h2 className="text-xs font-bold uppercase text-primary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">route</span>
              Active Green Corridors
            </h2>
            <div className="space-y-4">
              {data.activeCorridors.map((c) => <CorridorCard key={c.id} corridor={c} />)}
              {data.activeCorridors.length === 0 && (
                <p className="text-on-surface-variant text-sm">No active corridors</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase text-on-surface-variant mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">settings_input_component</span>
              Sector Traffic Override
            </h2>
            <div className="space-y-2">
              {data.sectors.map((s) => (
                <div key={s.id} className={`bg-surface border p-3 rounded-lg flex items-center justify-between shadow-sm ${s.overrideActive ? 'border-primary' : 'border-outline-variant'}`}>
                  <div>
                    <div className="font-semibold">Sector {s.code}: {s.name}</div>
                    <div className="text-[11px] text-on-surface-variant">
                      Grid: <span className={`font-bold ${gridStatusColor[s.gridStatus]}`}>{s.gridStatus.toUpperCase()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleOverride(s.id)}
                    className={`p-2 rounded transition-all ${s.overrideActive ? 'bg-primary-container text-on-primary-container animate-pulse' : 'bg-surface-container-high text-on-surface-variant hover:bg-primary-container'}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{s.overrideActive ? 'auto_mode' : 'pan_tool'}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <div className="bg-surface-container-highest border border-outline-variant p-4 rounded-lg">
            <div className="flex gap-3">
              <span className="material-symbols-outlined text-primary">gpp_maybe</span>
              <div>
                <div className="text-xs font-bold uppercase">Privacy Protocol Active</div>
                <p className="text-[10px] text-on-surface-variant">PII/PHI redacted. No patient identifiers on this dashboard.</p>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
