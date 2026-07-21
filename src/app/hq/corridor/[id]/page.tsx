'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TopNav, ProviderMarker } from '@/components/ui';
import { api } from '@/lib/api';
import { formatEta, useAuthGuard, useSocket, usePresenceHeartbeat } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { OsmMap } from '@/components/OsmMap';
import { MapMarker, MapRoute, parseCoord, resolveCityMapView } from '@/components/map-types';
import { getLiveRoute } from '@/lib/demo-route';

interface TransitDetail {
  id: string;
  transitId: string;
  status: string;
  etaMinutes: number | null;
  currentSpeed: number | string | null;
  currentLat?: number | string | null;
  currentLng?: number | string | null;
  originLat?: number | string | null;
  originLng?: number | string | null;
  startedAt?: string | null;
  paramedicNotes?: string | null;
  ambulance: {
    unitNumber: string;
    currentLat?: number | string | null;
    currentLng?: number | string | null;
    currentSpeed?: number | string | null;
    provider?: { name?: string; color?: string; shape?: string; markerLetter?: string };
  };
  hospital: {
    name: string;
    address?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
  emergencyType?: { name: string } | null;
  triageCode?: { name: string; color?: string; priority?: number } | null;
  sector?: { name: string; code: string } | null;
  claimedBy?: { name: string } | null;
}

function unitPosition(t: TransitDetail): [number, number] | null {
  const lat = parseCoord(t.currentLat) ?? parseCoord(t.ambulance?.currentLat) ?? parseCoord(t.originLat);
  const lng = parseCoord(t.currentLng) ?? parseCoord(t.ambulance?.currentLng) ?? parseCoord(t.originLng);
  if (lat == null || lng == null) return null;
  return [lat, lng];
}

function hospitalPosition(t: TransitDetail): [number, number] | null {
  const lat = parseCoord(t.hospital?.latitude);
  const lng = parseCoord(t.hospital?.longitude);
  if (lat == null || lng == null) return null;
  return [lat, lng];
}

function speedKmh(t: TransitDetail): number {
  const fromTransit = Number(t.currentSpeed);
  const fromAmbulance = Number(t.ambulance?.currentSpeed);
  if (Number.isFinite(fromTransit) && fromTransit > 0) return fromTransit;
  if (Number.isFinite(fromAmbulance) && fromAmbulance >= 0) return fromAmbulance;
  return 0;
}

const STATUS_PILL: Record<string, string> = {
  pending: 'pill-amber',
  en_route: 'pill-blue',
  arrived: 'pill-green',
  completed: 'pill-grey',
  cancelled: 'pill-grey',
};

export default function CorridorDetailPage() {
  const { ready } = useAuthGuard('hq_1122');
  usePresenceHeartbeat(ready);
  const { currentCity, loading: cityLoading } = useCityContext();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const transitDbId = params?.id;

  const [transit, setTransit] = useState<TransitDetail | null>(null);
  const [error, setError] = useState('');
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const mapView = useMemo(() => resolveCityMapView(currentCity), [currentCity]);

  const load = useCallback(async () => {
    if (!transitDbId) return;
    try {
      const t = await api<TransitDetail>(`/transits/${transitDbId}`);
      setTransit(t);
      setError('');
      setLastRefreshAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load corridor');
    }
  }, [transitDbId]);

  useEffect(() => { if (ready && transitDbId) load(); }, [ready, transitDbId, load]);
  useSocket(load);

  // Poll every 15s so the unit keeps moving even if sockets drop
  useEffect(() => {
    if (!ready || !transitDbId) return;
    const timer = window.setInterval(() => { void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [ready, transitDbId, load]);

  // Road-following route via OSRM from live unit position to hospital
  const from = transit ? unitPosition(transit) : null;
  const to = transit ? hospitalPosition(transit) : null;
  const routeKey = from && to ? `${from[0].toFixed(4)},${from[1].toFixed(4)}-${to[0]},${to[1]}` : '';

  useEffect(() => {
    let cancelled = false;
    async function build() {
      if (!from || !to) {
        setRoutePoints([]);
        return;
      }
      const path = await getLiveRoute(from, to);
      if (!cancelled) setRoutePoints(path.length >= 2 ? path : [from, to]);
    }
    void build();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  if (!ready || cityLoading || (!transit && !error)) {
    return <div className="min-h-screen flex items-center justify-center ops-shell">Loading...</div>;
  }

  if (error && !transit) {
    return (
      <div className="min-h-screen ops-shell flex flex-col">
        <TopNav active="/hq" />
        <div className="flex-1 flex flex-col items-center justify-center pt-16 gap-3">
          <p className="text-error">{error}</p>
          <button type="button" onClick={() => router.push('/hq')} className="btn-ghost text-xs px-4 py-2">
            Back to HQ
          </button>
        </div>
      </div>
    );
  }

  if (!transit) return null;

  const providerColor = transit.ambulance?.provider?.color || '#d93343';
  const providerShape = transit.ambulance?.provider?.shape || 'circle';
  const providerLetter = transit.ambulance?.provider?.markerLetter;
  const markers: MapMarker[] = [];
  if (from) {
    markers.push({
      id: 'unit',
      lat: from[0],
      lng: from[1],
      label: transit.ambulance?.unitNumber || 'Unit',
      color: providerColor,
      shape: providerShape,
      letter: providerLetter,
      sublabel: `${transit.transitId} · live position`,
    });
  }
  if (to) {
    markers.push({
      id: 'hospital',
      lat: to[0],
      lng: to[1],
      label: transit.hospital?.name || 'Hospital',
      color: '#0f766e',
      shape: 'hospital',
      sublabel: 'Destination hospital',
    });
  }

  const routes: MapRoute[] = routePoints.length >= 2
    ? [{ id: 'corridor-route', positions: routePoints, color: providerColor }]
    : [];

  const isActive = ['pending', 'en_route', 'arrived'].includes(transit.status);
  const isCritical = transit.triageCode?.priority === 1;

  return (
    <div className="h-screen flex flex-col overflow-hidden ops-shell">
      <TopNav active="/hq" />
      <main className="flex-1 pt-16 flex overflow-hidden">
        {/* Corridor info panel */}
        <section className="w-full md:w-[400px] lg:w-[440px] shrink-0 border-r border-outline-variant bg-white/80 backdrop-blur-sm overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            <button
              type="button"
              onClick={() => router.push('/hq')}
              className="btn-ghost text-xs px-3 py-2"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Back to HQ corridors
            </button>

            <div className={isCritical ? 'dash-card-critical p-5' : 'dash-card p-5'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-kicker mb-1">Corridor</p>
                  <h1 className={`font-mono font-bold text-2xl ${isCritical ? 'text-error' : 'text-slate-900'}`}>
                    {transit.transitId}
                  </h1>
                </div>
                <span className={`pill ${STATUS_PILL[transit.status] || 'pill-grey'} uppercase`}>
                  {transit.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">ETA</p>
                  <p className="text-xl font-bold text-primary">{isActive ? formatEta(transit.etaMinutes) : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">SPEED</p>
                  <p className="text-xl font-bold text-slate-800">{speedKmh(transit).toFixed(0)} <span className="text-xs font-medium text-slate-500">km/h</span></p>
                </div>
              </div>
            </div>

            <div className="dash-panel p-5 space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">AMBULANCE</p>
                <p className="font-semibold text-slate-800">{transit.ambulance?.unitNumber || '—'}</p>
                {transit.ambulance?.provider?.name && (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: providerColor }} />
                    {transit.ambulance.provider.name}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">DESTINATION</p>
                <p className="font-semibold text-slate-800">{transit.hospital?.name || '—'}</p>
                {transit.hospital?.address && <p className="text-xs text-slate-500">{transit.hospital.address}</p>}
              </div>
              {transit.sector && (
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">SECTOR</p>
                  <p className="font-semibold text-slate-800">Sector {transit.sector.code}: {transit.sector.name}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">EMERGENCY</p>
                  <p className="font-semibold text-slate-800">{transit.emergencyType?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">TRIAGE</p>
                  <p className="font-semibold text-slate-800">{transit.triageCode?.name || '—'}</p>
                </div>
              </div>
              {transit.claimedBy?.name && (
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">CLAIMED BY</p>
                  <p className="font-semibold text-slate-800">{transit.claimedBy.name}</p>
                </div>
              )}
              {transit.startedAt && (
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">STARTED</p>
                  <p className="font-semibold text-slate-800">
                    {new Date(transit.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              {transit.paramedicNotes && (
                <div>
                  <p className="text-[10px] font-mono text-on-surface-variant tracking-wider">PARAMEDIC NOTES</p>
                  <p className="text-xs italic text-slate-500">"{transit.paramedicNotes}"</p>
                </div>
              )}
            </div>

            {!from && (
              <div className="dash-panel p-4 text-xs text-on-surface-variant">
                No live GPS received for this unit yet — the route will appear once the driver app starts sending positions.
              </div>
            )}
          </div>
        </section>

        {/* Live map */}
        <section className="flex-1 min-w-0 relative overflow-hidden">
          <OsmMap
            center={from || to || mapView.center}
            zoom={mapView.zoom}
            markers={markers}
            routes={routes}
            fitToMarkers={markers.length >= 2}
            className="h-full w-full"
          />
          <div className="absolute top-4 left-4 z-[1000] glass-panel px-3 py-2 rounded-xl">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
              {transit.transitId} — Live Route Tracking
            </p>
            {lastRefreshAt && (
              <p className="text-[10px] text-on-surface-variant mt-0.5">Auto-refresh 15s · last {lastRefreshAt}</p>
            )}
          </div>

          <div className="absolute bottom-6 left-6 glass-panel p-4 rounded-xl space-y-2 z-[1000]">
            <p className="text-xs font-bold uppercase text-on-surface-variant mb-2 tracking-wider">Map Legend</p>
            <div className="flex items-center gap-2 text-sm">
              <ProviderMarker shape={providerShape} color={providerColor} size={12} letter={providerLetter} />
              {transit.ambulance?.unitNumber || 'Ambulance'} (live)
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex w-4 h-4 items-center justify-center border-2 border-teal-700 rounded text-teal-700 text-[10px] font-black">+</span>
              {transit.hospital?.name || 'Hospital'}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
