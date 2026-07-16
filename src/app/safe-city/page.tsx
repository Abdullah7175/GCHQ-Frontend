'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TopNav } from '@/components/ui';
import { api, cityQuery } from '@/lib/api';
import { useAuthGuard, useSocket, useLiveEta } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { OsmMap } from '@/components/OsmMap';
import { MapMarker, MapRoute, parseCoord, fallbackPosition, resolveCityMapView } from '@/components/map-types';
import { getLiveRoute } from '@/lib/demo-route';

interface Corridor {
  id: string;
  transitId: string;
  etaMinutes: number;
  currentSpeed: number;
  currentLat?: number | string | null;
  currentLng?: number | string | null;
  originLat?: number | string | null;
  originLng?: number | string | null;
  ambulance: {
    unitNumber: string;
    currentLat?: number | string | null;
    currentLng?: number | string | null;
    currentSpeed?: number | string | null;
    provider: { name: string; color: string; shape?: string };
  };
  hospital: { name: string; latitude?: number | string | null; longitude?: number | string | null };
  sector: { name: string };
  triageCode: { name: string };
}

interface SafeCityData {
  activeCorridors: Corridor[];
}

function liveSpeedKmh(c: Corridor): number {
  const fromTransit = Number(c.currentSpeed);
  const fromAmbulance = Number(c.ambulance?.currentSpeed);
  if (Number.isFinite(fromTransit) && fromTransit > 0) return fromTransit;
  if (Number.isFinite(fromAmbulance) && fromAmbulance >= 0) return fromAmbulance;
  return 0;
}

function corridorFrom(c: Corridor, i: number, cityCenter: [number, number]): [number, number] {
  const lat =
    parseCoord(c.currentLat) ??
    parseCoord(c.ambulance.currentLat) ??
    parseCoord(c.originLat) ??
    fallbackPosition(i, cityCenter)[0];
  const lng =
    parseCoord(c.currentLng) ??
    parseCoord(c.ambulance.currentLng) ??
    parseCoord(c.originLng) ??
    fallbackPosition(i, cityCenter)[1];
  return [lat, lng];
}

function corridorTo(c: Corridor): [number, number] | null {
  const lat = parseCoord(c.hospital.latitude);
  const lng = parseCoord(c.hospital.longitude);
  if (lat == null || lng == null) return null;
  return [lat, lng];
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
          <div className="font-semibold">{liveSpeedKmh(corridor).toFixed(0)} km/h</div>
        </div>
      </div>
    </div>
  );
}

export default function SafeCityDashboard() {
  const { ready } = useAuthGuard('safe_city');
  const { cityId, currentCity, loading: cityLoading } = useCityContext();
  const [data, setData] = useState<SafeCityData | null>(null);
  const [error, setError] = useState('');
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const mapView = useMemo(() => resolveCityMapView(currentCity), [currentCity]);
  const routeFingerprint = useMemo(
    () =>
      JSON.stringify(
        (data?.activeCorridors ?? []).map((c) => [
          c.id,
          Number(c.currentLat ?? c.ambulance.currentLat ?? 0).toFixed(4),
          Number(c.currentLng ?? c.ambulance.currentLng ?? 0).toFixed(4),
          liveSpeedKmh(c).toFixed(0),
          c.hospital.latitude,
          c.hospital.longitude,
        ]),
      ),
    [data?.activeCorridors],
  );

  const load = useCallback(async () => {
    if (!cityId) return;
    try {
      setError('');
      const res = await api<{ activeCorridors: Corridor[] }>(`/dashboard/safe-city${cityQuery(cityId)}`);
      setData({ activeCorridors: res.activeCorridors });
      setLastRefreshAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [cityId]);

  useEffect(() => { if (ready && cityId) load(); }, [ready, cityId, load]);
  useSocket(load);

  // Poll every 15s so speed / GPS / ETA stay in sync even if sockets drop
  useEffect(() => {
    if (!ready || !cityId) return;
    const timer = window.setInterval(() => { void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [ready, cityId, load]);

  // Road-following routes via OSRM (same as driver app); refresh when positions change
  useEffect(() => {
    let cancelled = false;
    async function buildRoutes() {
      if (!data?.activeCorridors?.length) {
        setRoutes([]);
        return;
      }
      const built = await Promise.all(
        data.activeCorridors.map(async (c, i) => {
          const from = corridorFrom(c, i, mapView.center);
          const to = corridorTo(c);
          if (!to) {
            return {
              id: `route-${c.id}`,
              positions: [from] as [number, number][],
              color: c.ambulance.provider?.color || '#0056b3',
            };
          }
          const path = await getLiveRoute(from, to);
          return {
            id: `route-${c.id}`,
            positions: path.length >= 2 ? path : [from, to],
            color: c.ambulance.provider?.color || '#0056b3',
          };
        }),
      );
      if (!cancelled) setRoutes(built.filter((r) => r.positions.length >= 2));
    }
    void buildRoutes();
    return () => { cancelled = true; };
  }, [data?.activeCorridors, mapView.center, routeFingerprint]);

  if (!ready || cityLoading || (cityId && !data && !error)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!cityId) {
    return <div className="min-h-screen flex items-center justify-center text-on-surface-variant">Select a city from the top navigation.</div>;
  }

  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center text-error">{error || 'No data'}</div>;
  }

  const markers: MapMarker[] = [];
  data.activeCorridors.forEach((c, i) => {
    const [lat, lng] = corridorFrom(c, i, mapView.center);
    markers.push({
      id: `unit-${c.id}`,
      lat,
      lng,
      label: c.transitId,
      color: c.ambulance.provider?.color || '#d93343',
      shape: c.ambulance.provider?.shape || 'circle',
      sublabel: `${c.ambulance.unitNumber} · live`,
    });

    const dest = corridorTo(c);
    if (dest) {
      markers.push({
        id: `hospital-${c.id}`,
        lat: dest[0],
        lng: dest[1],
        label: c.hospital.name,
        color: '#0f766e',
        shape: 'hospital',
        sublabel: 'Destination hospital',
      });
    }
  });

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopNav active="/safe-city" />
      <main className="flex-1 pt-16 flex overflow-hidden bg-surface-container-low">
        <section className="w-full md:w-[480px] lg:w-[520px] shrink-0 border-r border-outline-variant bg-white p-4 overflow-y-auto custom-scrollbar">
          <h2 className="text-xs font-bold uppercase text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">route</span>
            Ongoing Corridors Grid
            {currentCity && (
              <span className="ml-auto normal-case tracking-normal font-semibold text-on-surface-variant">
                {currentCity.name}
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.activeCorridors.map((c) => <CorridorCard key={c.id} corridor={c} />)}
            {data.activeCorridors.length === 0 && (
              <p className="text-on-surface-variant text-sm col-span-full">No active corridors</p>
            )}
          </div>
        </section>

        <section className="flex-1 min-w-0 relative overflow-hidden">
          <OsmMap
            center={mapView.center}
            zoom={mapView.zoom}
            markers={markers}
            routes={routes}
            fitToMarkers={markers.length >= 2}
            className="h-full w-full"
          />
          <div className="absolute top-4 left-4 z-[1000] glass-panel px-3 py-1.5 rounded border border-outline-variant">
            <p className="text-[10px] font-bold text-primary uppercase">
              Live Route Coordination — {currentCity?.name || 'City'} (OSM + OSRM)
            </p>
            {lastRefreshAt && (
              <p className="text-[10px] text-on-surface-variant mt-0.5">Auto-refresh 15s · last {lastRefreshAt}</p>
            )}
          </div>

          <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur p-4 rounded border border-outline-variant shadow-lg space-y-2 z-[1000]">
            <p className="text-xs font-bold uppercase text-on-surface-variant mb-2">Map Legend</p>
            <div className="flex items-center gap-2 text-sm"><div className="w-3 h-3 bg-[#d93343] rounded-full" /> Live ambulance</div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex w-4 h-4 items-center justify-center border-2 border-teal-700 rounded text-teal-700 text-[10px] font-black">+</span>
              Hospital destination
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
