'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopNav } from '@/components/ui';
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

interface SafeCityData {
  activeCorridors: Corridor[];
}

function CorridorCard({ corridor }: { corridor: Corridor }) {
  const eta = useLiveEta(corridor.etaMinutes);

  return (
    <div className="bg-surface p-4 rounded-xl border border-outline-variant relative overflow-hidden shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-[10px] font-mono text-on-surface-variant">AMBULANCE</div>
          <div className="text-lg font-semibold">{corridor.ambulance.unitNumber}</div>
          <div className="text-xs text-on-surface-variant">{corridor.ambulance.provider.name}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-on-surface-variant">ETA</div>
          <div className="text-primary font-bold">{eta}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[10px] font-mono text-on-surface-variant">DESTINATION</div>
          <div className="font-semibold">{corridor.hospital.name}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-on-surface-variant">SECTOR</div>
          <div className="font-semibold">{corridor.sector?.name || 'N/A'}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-on-surface-variant">TRIAGE</div>
          <div className="font-semibold">{corridor.triageCode.name}</div>
        </div>
        <div>
          <div className="text-[10px] font-mono text-on-surface-variant">SPEED</div>
          <div className="font-semibold">{Number(corridor.currentSpeed).toFixed(0)} km/h</div>
        </div>
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
      const res = await api<{ activeCorridors: Corridor[] }>(`/dashboard/safe-city${cityQuery(cityId)}`);
      setData({ activeCorridors: res.activeCorridors });
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopNav active="/safe-city" />
      <main className="flex-1 pt-16 flex overflow-hidden bg-surface-container-low">
        <section className="w-full md:w-[480px] lg:w-[520px] shrink-0 border-r border-outline-variant bg-white p-4 overflow-y-auto custom-scrollbar">
          <h2 className="text-xs font-bold uppercase text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">route</span>
            Ongoing Corridors Grid
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.activeCorridors.map((c) => <CorridorCard key={c.id} corridor={c} />)}
            {data.activeCorridors.length === 0 && (
              <p className="text-on-surface-variant text-sm col-span-full">No active corridors</p>
            )}
          </div>
        </section>

        <section className="flex-1 min-w-0 relative overflow-hidden">
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
        </section>
      </main>
    </div>
  );
}
