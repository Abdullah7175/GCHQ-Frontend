'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, cityQuery, getStoredUser } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { OsmMap } from '@/components/OsmMap';
import { MapMarker, MapRoute, parseCoord, LAHORE_CENTER } from '@/components/map-types';
import { buildDemoRoute, interpolateRouteProgress } from '@/lib/demo-route';

interface Hospital {
  id: string;
  name: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  sectorId?: string | null;
}
interface EmergencyType { id: string; name: string; code: string }
interface TriageCode { id: string; name: string; code: string }
interface Ambulance {
  id: string;
  unitNumber: string;
  status: string;
  driverId?: string | null;
  currentLat?: number | string | null;
  currentLng?: number | string | null;
}
interface Transit {
  id: string;
  transitId: string;
  status: string;
  ambulanceId?: string;
  hospitalId?: string;
  currentLat?: number | string | null;
  currentLng?: number | string | null;
  originLat?: number | string | null;
  originLng?: number | string | null;
  hospital: {
    name: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
  };
  emergencyType: { name: string };
  triageCode: { name: string };
}

export default function DriverApp() {
  const { user, ready } = useAuthGuard('paramedic');
  const { cityId, loading: cityLoading } = useCityContext();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [emergencyTypes, setEmergencyTypes] = useState<EmergencyType[]>([]);
  const [triageCodes, setTriageCodes] = useState<TriageCode[]>([]);
  const [ambulance, setAmbulance] = useState<Ambulance | null>(null);
  const [activeTransit, setActiveTransit] = useState<Transit | null>(null);
  const [hospitalId, setHospitalId] = useState('');
  const [emergencyTypeId, setEmergencyTypeId] = useState('');
  const [triageCodeId, setTriageCodeId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [route, setRoute] = useState<[number, number][]>([]);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const simBusy = useRef(false);

  const resolvedCityId = cityId || user?.cityId || null;

  const load = useCallback(async () => {
    if (!resolvedCityId) return;
    const cq = cityQuery(resolvedCityId);
    setLoadError('');
    try {
      const [h, et, tc, ambulances, transits] = await Promise.all([
        api<Hospital[]>(`/hospitals${cq}`),
        api<EmergencyType[]>('/emergency-types'),
        api<TriageCode[]>('/triage-codes'),
        api<Ambulance[]>(`/ambulances${cq}`),
        api<Transit[]>(`/transits?active=true&cityId=${resolvedCityId}`),
      ]);
      setHospitals(h);
      setEmergencyTypes(et);
      setTriageCodes(tc);
      const myAmbulance =
        ambulances.find((a) => a.driverId === user?.id) ??
        ambulances.find((a) => a.status === 'available') ??
        null;
      setAmbulance(myAmbulance);

      const mine = transits.find(
        (t) =>
          myAmbulance &&
          t.ambulanceId === myAmbulance.id &&
          (t.status === 'en_route' || t.status === 'pending' || t.status === 'arrived'),
      ) ?? null;
      setActiveTransit(mine);

      if (mine) {
        const fromLat = parseCoord(mine.currentLat) ?? parseCoord(mine.originLat) ?? parseCoord(myAmbulance?.currentLat) ?? LAHORE_CENTER[0];
        const fromLng = parseCoord(mine.currentLng) ?? parseCoord(mine.originLng) ?? parseCoord(myAmbulance?.currentLng) ?? LAHORE_CENTER[1];
        const toLat = parseCoord(mine.hospital.latitude) ?? LAHORE_CENTER[0];
        const toLng = parseCoord(mine.hospital.longitude) ?? LAHORE_CENTER[1];
        setRoute(buildDemoRoute([fromLat, fromLng], [toLat, toLng]));
      } else {
        setRoute([]);
        setProgress(0);
        progressRef.current = 0;
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dispatch data');
    }
  }, [resolvedCityId, user?.id]);

  useEffect(() => {
    if (ready && resolvedCityId && !cityLoading) load();
  }, [ready, resolvedCityId, cityLoading, load]);

  // Demo live GPS: move along route; when tracker APIs arrive, replace this loop with device GPS posts
  useEffect(() => {
    if (!activeTransit || activeTransit.status !== 'en_route' || !ambulance || route.length < 2) return;

    const timer = setInterval(async () => {
      if (simBusy.current) return;
      const next = Math.min(1, progressRef.current + 0.04);
      progressRef.current = next;
      setProgress(next);
      const [lat, lng] = interpolateRouteProgress(route, next);
      simBusy.current = true;
      try {
        const result = await api<{ ambulance: Ambulance; transit: Transit | null }>(
          `/ambulances/${ambulance.id}/gps`,
          {
            method: 'PATCH',
            body: JSON.stringify({ latitude: lat, longitude: lng, speed: 38 }),
          },
        );
        if (result.transit?.status === 'completed') {
          setMessage('Arrived at hospital (geofence). Trip completed.');
          setActiveTransit(null);
          setRoute([]);
          setProgress(0);
          progressRef.current = 0;
          load();
        } else if (result.transit) {
          setActiveTransit(result.transit);
        }
      } catch {
        /* keep simulating on transient errors */
      } finally {
        simBusy.current = false;
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [activeTransit?.id, activeTransit?.status, ambulance?.id, route, load]);

  async function handleGo() {
    if (!ambulance || !hospitalId || !emergencyTypeId || !triageCodeId) {
      setMessage('Please fill all required fields');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const hospital = hospitals.find((h) => h.id === hospitalId);
      const originLat = parseCoord(ambulance.currentLat) ?? LAHORE_CENTER[0] + 0.02;
      const originLng = parseCoord(ambulance.currentLng) ?? LAHORE_CENTER[1] - 0.02;
      const destLat = parseCoord(hospital?.latitude) ?? LAHORE_CENTER[0];
      const destLng = parseCoord(hospital?.longitude) ?? LAHORE_CENTER[1];

      const transit = await api<Transit>('/transits', {
        method: 'POST',
        body: JSON.stringify({
          ambulanceId: ambulance.id,
          hospitalId,
          emergencyTypeId,
          triageCodeId,
          sectorId: hospital?.sectorId || undefined,
          paramedicNotes: notes || undefined,
          originLat,
          originLng,
          baselineEtaMinutes: 12,
        }),
      });
      const started = await api<Transit>(`/transits/${transit.id}/start`, {
        method: 'PATCH',
        body: JSON.stringify({ currentLat: originLat, currentLng: originLng }),
      });
      const demoRoute = buildDemoRoute([originLat, originLng], [destLat, destLng]);
      setRoute(demoRoute);
      setProgress(0);
      progressRef.current = 0;
      setActiveTransit(started);
      setMessage('Corridor requested. Best demo route loaded. HQ CSRs notified.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!activeTransit) return;
    setLoading(true);
    try {
      await api(`/transits/${activeTransit.id}/complete`, { method: 'PATCH' });
      setMessage('Trip completed from driver app.');
      setNotes('');
      setHospitalId('');
      setEmergencyTypeId('');
      setTriageCodeId('');
      setActiveTransit(null);
      setRoute([]);
      setProgress(0);
      progressRef.current = 0;
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to complete');
    } finally {
      setLoading(false);
    }
  }

  if (!ready || cityLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!resolvedCityId) {
    return <div className="min-h-screen flex items-center justify-center text-on-surface-variant">No city assigned.</div>;
  }

  const pos = route.length ? interpolateRouteProgress(route, progress) : null;
  const markers: MapMarker[] = pos
    ? [{ id: 'me', lat: pos[0], lng: pos[1], label: ambulance?.unitNumber || 'Unit', color: '#d93343', shape: 'circle', sublabel: 'You' }]
    : [];
  const routes: MapRoute[] = route.length
    ? [{ id: 'demo-route', positions: route, color: '#0056b3' }]
    : [];
  const mapCenter: [number, number] = pos || LAHORE_CENTER;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-primary text-on-primary p-4 shadow-md">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-bold">Ambulance Dispatch</h1>
            <p className="text-sm opacity-90">{user?.name || getStoredUser()?.name} | {ambulance?.unitNumber || 'No unit'}</p>
          </div>
          <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }} className="text-sm opacity-80">
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full">
        {activeTransit ? (
          <div className="space-y-4 mt-2">
            <div className="bg-surface-container-lowest border-2 border-primary rounded-xl p-4 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 bg-error rounded-full severity-pulse" />
                <span className="font-bold text-primary uppercase text-sm">Active Green Corridor</span>
              </div>
              <p className="font-mono font-bold text-xl">{activeTransit.transitId}</p>
              <p className="text-sm">To: <strong>{activeTransit.hospital.name}</strong></p>
              <p className="text-sm text-on-surface-variant">
                {activeTransit.triageCode.name}: {activeTransit.emergencyType.name}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Status: {activeTransit.status.toUpperCase()} · Demo route {Math.round(progress * 100)}%
              </p>
            </div>

            <div className="h-[320px] rounded-xl overflow-hidden border border-outline-variant relative">
              <OsmMap center={mapCenter} zoom={13} markers={markers} routes={routes} className="h-full w-full" />
              <div className="absolute top-2 left-2 z-[1000] glass-panel px-2 py-1 rounded text-[10px] font-bold text-primary">
                DEMO BEST ROUTE (Google Maps later)
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={loading}
              className="w-full bg-tertiary-container text-on-tertiary-container font-bold py-4 rounded-xl text-lg disabled:opacity-50"
            >
              {loading ? 'Processing...' : '✓ MARK ARRIVED / COMPLETE'}
            </button>
            <p className="text-[11px] text-center text-on-surface-variant">
              Trip also auto-completes when demo GPS enters the hospital geofence (~250m).
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">1. Destination Hospital *</label>
              <select
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full border-2 border-outline-variant rounded-xl px-4 py-4 text-lg focus:border-primary focus:outline-none bg-white"
              >
                <option value="">Choose hospital...</option>
                {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">2. Triage Code *</label>
              <select
                value={triageCodeId}
                onChange={(e) => setTriageCodeId(e.target.value)}
                className="w-full border-2 border-outline-variant rounded-xl px-4 py-4 text-lg focus:border-primary focus:outline-none bg-white"
              >
                <option value="">Select triage code...</option>
                {triageCodes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">3. Emergency Type *</label>
              <select
                value={emergencyTypeId}
                onChange={(e) => setEmergencyTypeId(e.target.value)}
                className="w-full border-2 border-outline-variant rounded-xl px-4 py-4 text-lg focus:border-primary focus:outline-none bg-white"
              >
                <option value="">Select emergency type...</option>
                {emergencyTypes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full border-2 border-outline-variant rounded-xl px-4 py-3 focus:border-primary focus:outline-none bg-white"
                placeholder="Quick clinical notes..."
              />
            </div>
            <button
              onClick={handleGo}
              disabled={loading || !ambulance}
              className="w-full bg-secondary-container text-on-secondary-container font-extrabold py-6 rounded-xl text-2xl shadow-lg disabled:opacity-50 mt-2"
            >
              {loading ? 'REQUESTING...' : '▶ REQUEST CORRIDOR'}
            </button>
            {!ambulance && <p className="text-error text-sm text-center">No available ambulance assigned to you</p>}
          </div>
        )}

        {loadError && (
          <div className="mt-4 p-4 rounded-lg text-center font-medium bg-error-container text-on-error-container">{loadError}</div>
        )}
        {message && (
          <div className={`mt-4 p-4 rounded-lg text-center font-medium ${message.toLowerCase().includes('fail') ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container/30 text-tertiary'}`}>
            {message}
          </div>
        )}
      </main>
    </div>
  );
}
