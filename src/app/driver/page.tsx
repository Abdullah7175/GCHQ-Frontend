'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, cityQuery, getStoredUser } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { OsmMap } from '@/components/OsmMap';
import { MapMarker, MapRoute, parseCoord, LAHORE_CENTER } from '@/components/map-types';

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
  const [deviceLocation, setDeviceLocation] = useState<[number, number] | null>(null);
  const [watchingLocation, setWatchingLocation] = useState(false);
  const locationWatchRef = useRef<number | null>(null);

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
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load dispatch data');
    }
  }, [resolvedCityId, user?.id]);

  useEffect(() => {
    if (ready && resolvedCityId && !cityLoading) load();
  }, [ready, resolvedCityId, cityLoading, load]);

  useEffect(() => {
    if (!ambulance || !ready || typeof window === 'undefined' || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const speedMps = position.coords.speed ?? 0;
        const speedKmh = Math.max(0, Number(speedMps) * 3.6);
        setDeviceLocation([lat, lng]);
        setWatchingLocation(true);

        if (!activeTransit || activeTransit.status === 'completed') return;
        try {
          const result = await api<{ ambulance: Ambulance; transit: Transit | null }>(`/ambulances/${ambulance.id}/gps`, {
            method: 'PATCH',
            body: JSON.stringify({ latitude: lat, longitude: lng, speed: speedKmh }),
          });
          if (result.transit?.status === 'completed') {
            setMessage('Trip completed.');
            setNotes('');
            setHospitalId('');
            setEmergencyTypeId('');
            setTriageCodeId('');
            setActiveTransit(null);
            load();
          } else if (result.transit) {
            setActiveTransit(result.transit);
          }
        } catch {
          // Keep the map alive even if one GPS post fails.
        }
      },
      (error) => {
        setWatchingLocation(false);
        setLoadError(error.message || 'Location access is required for live tracking');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );

    locationWatchRef.current = watchId;
    return () => {
      if (locationWatchRef.current != null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [ambulance?.id, activeTransit?.id, activeTransit?.status, load, ready]);

  async function handleGo() {
    if (!ambulance || !hospitalId || !emergencyTypeId || !triageCodeId) {
      setMessage('Please fill all required fields');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const hospital = hospitals.find((h) => h.id === hospitalId);
      const originLat = deviceLocation?.[0] ?? parseCoord(ambulance.currentLat) ?? LAHORE_CENTER[0] + 0.02;
      const originLng = deviceLocation?.[1] ?? parseCoord(ambulance.currentLng) ?? LAHORE_CENTER[1] - 0.02;

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
      setMessage('Corridor requested. HQ and hospital dashboards updated.');
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
  const markers: MapMarker[] = [];
  if (currentPos) {
    markers.push({ id: 'me', lat: currentPos[0], lng: currentPos[1], label: ambulance?.unitNumber || 'Unit', color: '#d93343', shape: 'circle', sublabel: 'Your live location' });
  }
  if (destination) {
    markers.push({ id: 'hospital', lat: destination[0], lng: destination[1], label: activeTransit?.hospital.name || 'Hospital', color: '#0056b3', shape: 'square', sublabel: 'Destination hospital' });
  }
  const routes: MapRoute[] = currentPos && destination
    ? [{ id: 'live-route', positions: [currentPos, destination], color: '#0056b3' }]
    : [];
  const mapCenter: [number, number] = currentPos || LAHORE_CENTER;

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
                Status: {activeTransit.status.toUpperCase()} · GPS {watchingLocation ? 'LIVE' : 'WAITING'}
              </p>
            </div>

            <div className="h-[320px] rounded-xl overflow-hidden border border-outline-variant relative">
              <OsmMap center={mapCenter} zoom={13} markers={markers} routes={routes} className="h-full w-full" />
              <div className="absolute top-2 left-2 z-[1000] glass-panel px-2 py-1 rounded text-[10px] font-bold text-primary">
                LIVE DEVICE LOCATION
              </div>
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
            <p className="text-[11px] text-center text-on-surface-variant">
              The driver sees only the live location map. HQ and hospital dashboards receive the request details through the API.
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
            <p className="text-[11px] text-center text-on-surface-variant">
              Allow device GPS so the map can show your current location and send live ambulance updates.
            </p>
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
