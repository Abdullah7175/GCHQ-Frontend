'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, cityQuery, getStoredUser, logout } from '@/lib/api';
import { useAuthGuard, useSocket } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { OsmMap } from '@/components/OsmMap';
import { MapMarker, MapRoute, parseCoord, resolveCityMapView } from '@/components/map-types';
import { getLiveRoute } from '@/lib/demo-route';
import { corridorRouteColor } from '@/lib/route-colors';
import { BrandLogo } from '@/components/BrandLogo';

interface Hospital {
  id: string;
  name: string;
  address?: string | null;
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
  provider?: { name?: string; color?: string; shape?: string; markerLetter?: string };
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

const GPS_INTERVAL_MS = 15_000;

export default function DriverApp() {
  const { user, ready } = useAuthGuard('paramedic');
  const { cityId, currentCity, loading: cityLoading } = useCityContext();
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
  const [deviceLocation, setDeviceLocation] = useState<[number, number] | null>(null);
  const [watchingLocation, setWatchingLocation] = useState(false);
  const [lastGpsOkAt, setLastGpsOkAt] = useState<string | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const locationWatchRef = useRef<number | null>(null);
  const lastGpsSentRef = useRef(0);
  const ambulanceRef = useRef<Ambulance | null>(null);
  const transitRef = useRef<Transit | null>(null);

  const resolvedCityId = cityId || user?.cityId || null;

  useEffect(() => { ambulanceRef.current = ambulance; }, [ambulance]);
  useEffect(() => { transitRef.current = activeTransit; }, [activeTransit]);

  const load = useCallback(async () => {
    if (!resolvedCityId) return;
    const cq = cityQuery(resolvedCityId);
    setLoadError('');
    try {
      const [h, et, tc, mine, transitsRaw] = await Promise.all([
        api<Hospital[]>(`/hospitals${cq}`),
        api<EmergencyType[]>('/emergency-types'),
        api<TriageCode[]>('/triage-codes'),
        api<{ ambulance: Ambulance; activeTransit: Transit | null } | null>('/ambulances/mine').catch(() => null),
        api<Transit[] | { data: Transit[] }>(`/transits?active=true&cityId=${resolvedCityId}`),
      ]);
      setHospitals(h);
      setEmergencyTypes(et);
      setTriageCodes(tc);

      // Only the currently active shift unit may be used — never fall back to any available ambulance.
      const myAmbulance = mine?.ambulance ?? null;
      setAmbulance(myAmbulance);
      if (!myAmbulance) {
        setLoadError('No active ambulance shift for this driver. Sign in after your unit is assigned.');
      }

      const transits = Array.isArray(transitsRaw) ? transitsRaw : transitsRaw.data ?? [];
      const mineTransit =
        mine?.activeTransit ??
        transits.find(
          (t) =>
            myAmbulance &&
            t.ambulanceId === myAmbulance.id &&
            (t.status === 'en_route' || t.status === 'pending' || t.status === 'arrived'),
        ) ??
        null;
      setActiveTransit(mineTransit);

      if (myAmbulance && parseCoord(myAmbulance.currentLat) != null && parseCoord(myAmbulance.currentLng) != null) {
        setDeviceLocation((prev) => prev ?? [Number(myAmbulance!.currentLat), Number(myAmbulance!.currentLng)]);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dispatch data');
    }
  }, [resolvedCityId, user?.id]);

  useEffect(() => {
    if (ready && resolvedCityId && !cityLoading) load();
  }, [ready, resolvedCityId, cityLoading, load]);
  useSocket(load);

  const pushGps = useCallback(async (lat: number, lng: number, speedKmh: number) => {
    const unit = ambulanceRef.current;
    if (!unit) return;
    const now = Date.now();
    if (now - lastGpsSentRef.current < GPS_INTERVAL_MS) return;
    lastGpsSentRef.current = now;

    try {
      const body: Record<string, number | string> = {
        latitude: lat,
        longitude: lng,
        speed: speedKmh,
      };
      const trip = transitRef.current;
      if (trip?.id) body.transitId = trip.id;

      const result = await api<{
        ok: boolean;
        ambulance: Ambulance;
        transit: Transit | null;
        recordedAt: string;
      }>(`/ambulances/${unit.id}/gps`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      setAmbulance((prev) => prev ? { ...prev, ...result.ambulance } : result.ambulance);
      setLastGpsOkAt(result.recordedAt);

      if (result.transit?.status === 'completed') {
        setMessage('Trip completed.');
        setNotes('');
        setHospitalId('');
        setEmergencyTypeId('');
        setTriageCodeId('');
        setActiveTransit(null);
        load();
      } else if (result.transit) {
        setActiveTransit((prev) => (prev ? { ...prev, ...result.transit! } : result.transit));
      }
    } catch {
      // Keep map alive if one GPS post fails
    }
  }, [load]);

  useEffect(() => {
    if (!ambulance || !ready || typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const speedMps = position.coords.speed ?? 0;
        const speedKmh = Math.max(0, Number(speedMps) * 3.6);
        setDeviceLocation([lat, lng]);
        setWatchingLocation(true);
        void pushGps(lat, lng, speedKmh);
      },
      (error) => {
        setWatchingLocation(false);
        setLoadError(error.message || 'Location access is required for live tracking');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    locationWatchRef.current = watchId;

    // Force a ping every 15s even if watchPosition is quiet
    const interval = window.setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const speedKmh = Math.max(0, Number(position.coords.speed ?? 0) * 3.6);
          setDeviceLocation([lat, lng]);
          setWatchingLocation(true);
          lastGpsSentRef.current = 0; // allow interval force-send
          void pushGps(lat, lng, speedKmh);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
      );
    }, GPS_INTERVAL_MS);

    return () => {
      if (locationWatchRef.current != null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      window.clearInterval(interval);
    };
  }, [ambulance?.id, ready, pushGps]);

  // Shortest driving path from live GPS → hospital (OSRM)
  useEffect(() => {
    let cancelled = false;
    async function loadRoute() {
      if (!currentPosCandidate() || !destinationCandidate()) {
        setRoutePoints([]);
        return;
      }
      const from = currentPosCandidate()!;
      const to = destinationCandidate()!;
      const path = await getLiveRoute(from, to);
      if (!cancelled) setRoutePoints(path);
    }

    function currentPosCandidate(): [number, number] | null {
      if (deviceLocation) return deviceLocation;
      if (ambulance && parseCoord(ambulance.currentLat) != null && parseCoord(ambulance.currentLng) != null) {
        return [Number(ambulance.currentLat), Number(ambulance.currentLng)];
      }
      return null;
    }
    function destinationCandidate(): [number, number] | null {
      if (!activeTransit) return null;
      if (parseCoord(activeTransit.hospital.latitude) == null || parseCoord(activeTransit.hospital.longitude) == null) return null;
      return [Number(activeTransit.hospital.latitude), Number(activeTransit.hospital.longitude)];
    }

    void loadRoute();
    return () => { cancelled = true; };
  }, [
    activeTransit?.id,
    activeTransit?.hospital?.latitude,
    activeTransit?.hospital?.longitude,
    deviceLocation?.[0],
    deviceLocation?.[1],
    ambulance?.currentLat,
    ambulance?.currentLng,
  ]);

  async function handleGo() {
    if (!ambulance || !hospitalId || !emergencyTypeId || !triageCodeId) {
      setMessage('Please fill all required fields');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const hospital = hospitals.find((h) => h.id === hospitalId);
      const cityMap = resolveCityMapView(currentCity);
      const originLat = deviceLocation?.[0] ?? parseCoord(ambulance.currentLat) ?? cityMap.center[0] + 0.02;
      const originLng = deviceLocation?.[1] ?? parseCoord(ambulance.currentLng) ?? cityMap.center[1] - 0.02;

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
      setActiveTransit(started);
      lastGpsSentRef.current = 0;
      void pushGps(originLat, originLng, 0);
      setMessage('Corridor requested. Live GPS is streaming to HQ.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setLoading(false);
    }
  }

  async function handleArrived() {
    if (!activeTransit) return;
    setLoading(true);
    try {
      const arrived = await api<Transit>(`/transits/${activeTransit.id}/arrived`, { method: 'PATCH' });
      setActiveTransit(arrived);
      setMessage('Marked as arrived at hospital.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to mark arrived');
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

  const currentPos: [number, number] | null =
    deviceLocation
    ?? (ambulance && parseCoord(ambulance.currentLat) != null && parseCoord(ambulance.currentLng) != null
      ? [Number(ambulance.currentLat), Number(ambulance.currentLng)]
      : null);
  const destination: [number, number] | null = activeTransit && parseCoord(activeTransit.hospital.latitude) != null && parseCoord(activeTransit.hospital.longitude) != null
    ? [Number(activeTransit.hospital.latitude), Number(activeTransit.hospital.longitude)]
    : null;
  const selectedHospitalId = activeTransit?.hospitalId || hospitalId;
  const markers: MapMarker[] = hospitals.flatMap((hospital) => {
    const lat = parseCoord(hospital.latitude);
    const lng = parseCoord(hospital.longitude);
    if (lat == null || lng == null) return [];
    return [{
      id: `hospital-${hospital.id}`,
      lat,
      lng,
      label: hospital.name,
      color: '#dc2626',
      shape: 'hospital',
      sublabel:
        hospital.id === selectedHospitalId
          ? 'Selected destination'
          : hospital.address || 'Hospital',
    }];
  });
  if (currentPos) {
    const fleet = ambulance?.provider;
    markers.push({
      id: 'me',
      lat: currentPos[0],
      lng: currentPos[1],
      label: ambulance?.unitNumber || 'Unit',
      color: fleet?.color || '#d93343',
      shape: fleet?.shape || 'circle',
      letter: fleet?.markerLetter,
      sublabel: watchingLocation ? 'Your live location' : 'Last known location',
    });
  }
  const routes: MapRoute[] = routePoints.length >= 2
    ? [{ id: 'live-route', positions: routePoints, color: corridorRouteColor(0) }]
    : currentPos && destination
      ? [{ id: 'live-route', positions: [currentPos, destination], color: corridorRouteColor(0) }]
      : [];
  const mapCenter: [number, number] = currentPos || resolveCityMapView(currentCity).center;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-primary text-on-primary p-4 shadow-md">
        <div className="flex justify-between items-center max-w-lg mx-auto gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size={44} />
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-none">GCHQ</h1>
              <p className="text-[11px] opacity-90 mt-0.5">Green Corridor Headquarters</p>
              <p className="text-sm opacity-90 truncate">{user?.name || getStoredUser()?.name} | {ambulance?.unitNumber || 'No unit'}</p>
              <p className="text-[11px] opacity-80">
                GPS {watchingLocation ? 'LIVE' : 'OFF'} · sync every 15s
                {lastGpsOkAt ? ` · last sent ${new Date(lastGpsOkAt).toLocaleTimeString()}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout(
                deviceLocation
                  ? { latitude: deviceLocation[0], longitude: deviceLocation[1] }
                  : undefined,
              );
              window.location.href = '/login';
            }}
            className="text-sm opacity-80 shrink-0"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        <div className="h-[280px] rounded-xl overflow-hidden border border-outline-variant relative">
          <OsmMap center={mapCenter} zoom={13} markers={markers} routes={routes} className="h-full w-full" />
          <div className="absolute top-2 left-2 z-[1000] glass-panel px-2 py-1 rounded text-[10px] font-bold text-primary">
            {currentPos ? 'YOUR LIVE LOCATION' : 'WAITING FOR GPS'}
          </div>
          {currentPos && (
            <div className="absolute bottom-2 left-2 z-[1000] glass-panel px-2 py-1 rounded text-[10px] font-mono">
              {currentPos[0].toFixed(5)}, {currentPos[1].toFixed(5)}
            </div>
          )}
        </div>

        {activeTransit ? (
          <div className="space-y-4">
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
              <p className="text-xs text-on-surface-variant mt-1">Status: {activeTransit.status.toUpperCase()}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleArrived}
                disabled={loading || activeTransit.status === 'arrived'}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50"
              >
                {loading ? 'Processing...' : activeTransit.status === 'arrived' ? '✓ ARRIVED' : 'MARK ARRIVED'}
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="w-full bg-tertiary-container text-on-tertiary-container font-bold py-4 rounded-xl text-lg disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'COMPLETE TRIP'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
            {!ambulance && <p className="text-error text-sm text-center">No ambulance assigned to your driver account</p>}
          </div>
        )}

        {loadError && (
          <div className="p-4 rounded-lg text-center font-medium bg-error-container text-on-error-container">{loadError}</div>
        )}
        {message && (
          <div className={`p-4 rounded-lg text-center font-medium ${message.toLowerCase().includes('fail') ? 'bg-error-container text-on-error-container' : 'bg-tertiary-container/30 text-tertiary'}`}>
            {message}
          </div>
        )}
      </main>
    </div>
  );
}
