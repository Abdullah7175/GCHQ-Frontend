'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import { api } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';
import { createFleetIcon } from '@/components/map-icons';

type GeofenceShapeType = 'circle' | 'rectangle' | 'polygon';

interface GeofenceData {
  shapeType: GeofenceShapeType;
  centerLat: number;
  centerLng: number;
  radiusMeters: number | null;
  boundaryPoints: { latitude: number; longitude: number }[];
}

interface HospitalData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

function layerToPayload(layer: L.Layer): {
  shapeType: GeofenceShapeType;
  centerLat: number;
  centerLng: number;
  radiusMeters?: number;
  points: { latitude: number; longitude: number }[];
} | null {
  if (layer instanceof L.Circle) {
    const center = layer.getLatLng();
    const radius = layer.getRadius();
    const points: { latitude: number; longitude: number }[] = [];
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * 360;
      const rad = (angle * Math.PI) / 180;
      const dx = radius * Math.cos(rad);
      const dy = radius * Math.sin(rad);
      const lat = center.lat + (dy / 111320);
      const lng = center.lng + (dx / (111320 * Math.cos((center.lat * Math.PI) / 180)));
      points.push({ latitude: lat, longitude: lng });
    }
    return {
      shapeType: 'circle',
      centerLat: center.lat,
      centerLng: center.lng,
      radiusMeters: Math.round(radius),
      points,
    };
  }

  if (layer instanceof L.Rectangle) {
    const bounds = layer.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const se = L.latLng(sw.lat, ne.lng);
    const nw = L.latLng(ne.lat, sw.lng);
    const points = [sw, se, ne, nw].map((ll) => ({ latitude: ll.lat, longitude: ll.lng }));
    return {
      shapeType: 'rectangle',
      centerLat: bounds.getCenter().lat,
      centerLng: bounds.getCenter().lng,
      points,
    };
  }

  if (layer instanceof L.Polygon) {
    const latlngs = layer.getLatLngs()[0] as L.LatLng[];
    const points = latlngs.map((ll) => ({ latitude: ll.lat, longitude: ll.lng }));
    const centroid = points.reduce(
      (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
      { latitude: 0, longitude: 0 },
    );
    return {
      shapeType: 'polygon',
      centerLat: centroid.latitude / points.length,
      centerLng: centroid.longitude / points.length,
      points,
    };
  }

  return null;
}

function addGeofenceLayer(data: GeofenceData) {
  const pts = data.boundaryPoints;
  if (data.shapeType === 'circle' && data.radiusMeters) {
    return L.circle([data.centerLat, data.centerLng], {
      radius: data.radiusMeters,
      color: '#2563eb',
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      weight: 2,
    });
  }
  if (data.shapeType === 'rectangle' && pts.length >= 4) {
    const lats = pts.map((p) => p.latitude);
    const lngs = pts.map((p) => p.longitude);
    return L.rectangle(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 },
    );
  }
  if (pts.length >= 3) {
    return L.polygon(
      pts.map((p) => [p.latitude, p.longitude] as [number, number]),
      { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 },
    );
  }
  return null;
}

export default function HospitalGeofenceEditor() {
  const params = useParams();
  const hospitalId = params.id as string;
  const { ready } = useAuthGuard('admin');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const hospitalMarkerRef = useRef<L.Marker | null>(null);

  const [hospital, setHospital] = useState<HospitalData | null>(null);
  const [savedGeofence, setSavedGeofence] = useState<GeofenceData | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const rebuildDrawControl = useCallback((map: L.Map, group: L.FeatureGroup) => {
    if (drawControlRef.current) {
      map.removeControl(drawControlRef.current);
    }
    const hasShape = group.getLayers().length > 0;
    drawControlRef.current = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: hasShape
          ? false
          : {
              allowIntersection: false,
              showArea: true,
              shapeOptions: { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 },
            },
        rectangle: hasShape
          ? false
          : {
              shapeOptions: { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 },
            },
        circle: hasShape
          ? false
          : {
              shapeOptions: { color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2 },
            },
        polyline: false,
        marker: false,
        circlemarker: false,
      },
      edit: {
        featureGroup: group,
        remove: true,
      },
    });
    map.addControl(drawControlRef.current);
  }, []);

  useEffect(() => {
    if (!ready || !hospitalId) return;

    let cancelled = false;

    async function init() {
      try {
        const [h, g] = await Promise.all([
          api<HospitalData>(`/hospitals/${hospitalId}`),
          api<GeofenceData | null>(`/hospitals/${hospitalId}/geofence`),
        ]);
        if (cancelled) return;
        setHospital(h);
        setSavedGeofence(g);

        if (!mapContainerRef.current || mapRef.current) return;

        const lat = Number(h.latitude);
        const lng = Number(h.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          setError('Hospital has no GPS coordinates. Edit the hospital in Admin first.');
          return;
        }

        const map = L.map(mapContainerRef.current).setView([lat, lng], 17);
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        hospitalMarkerRef.current = L.marker([lat, lng], {
          icon: createFleetIcon('hospital', '#dc2626', 32),
          interactive: false,
        }).addTo(map);
        hospitalMarkerRef.current.bindTooltip(h.name, { permanent: true, direction: 'top', offset: [0, -16] });

        const drawnItems = new L.FeatureGroup();
        drawnItemsRef.current = drawnItems;
        map.addLayer(drawnItems);

        if (g) {
          const layer = addGeofenceLayer(g);
          if (layer) {
            drawnItems.addLayer(layer);
            map.fitBounds(layer.getBounds().pad(0.15));
          }
        }

        rebuildDrawControl(map, drawnItems);

        map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
          const event = e as L.DrawEvents.Created;
          drawnItems.clearLayers();
          drawnItems.addLayer(event.layer);
          rebuildDrawControl(map, drawnItems);
          setStatus('Fence drawn — drag handles to adjust, then Save.');
        });

        map.on(L.Draw.Event.EDITED, () => {
          setStatus('Fence updated — click Save to persist.');
        });

        map.on(L.Draw.Event.DELETED, () => {
          rebuildDrawControl(map, drawnItems);
          setStatus('Fence removed from map — Save to apply or draw a new shape.');
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [ready, hospitalId, rebuildDrawControl]);

  async function handleSave() {
    const group = drawnItemsRef.current;
    if (!group || group.getLayers().length === 0) {
      setError('Draw a fence first using the tools on the map (circle, rectangle, or polygon).');
      return;
    }
    const layer = group.getLayers()[0];
    const payload = layerToPayload(layer);
    if (!payload) {
      setError('Unsupported shape');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api(`/hospitals/${hospitalId}/geofence`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSavedGeofence({
        shapeType: payload.shapeType,
        centerLat: payload.centerLat,
        centerLng: payload.centerLng,
        radiusMeters: payload.radiusMeters ?? null,
        boundaryPoints: payload.points,
      });
      setStatus('Geofence saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSaved() {
    if (!savedGeofence) return;
    if (!confirm('Delete saved geofence for this hospital?')) return;
    setSaving(true);
    setError('');
    try {
      await api(`/hospitals/${hospitalId}/geofence`, { method: 'DELETE' });
      drawnItemsRef.current?.clearLayers();
      if (mapRef.current && drawnItemsRef.current) {
        rebuildDrawControl(mapRef.current, drawnItemsRef.current);
      }
      setSavedGeofence(null);
      setStatus('Geofence deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Arrival geofence</h1>
          <p className="text-sm text-slate-500">{hospital?.name ?? 'Loading hospital…'}</p>
        </div>
        <div className="flex items-center gap-2">
          {savedGeofence && (
            <button type="button" onClick={() => void handleDeleteSaved()} disabled={saving} className="btn-danger-ghost text-sm px-3 py-2">
              Delete saved
            </button>
          )}
          <Link href="/admin" className="btn-ghost text-sm px-3 py-2">
            Back to Admin
          </Link>
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="btn-primary text-sm px-4 py-2">
            {saving ? 'Saving…' : 'Save geofence'}
          </button>
        </div>
      </header>

      <div className="shrink-0 px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-900 flex flex-wrap gap-x-4 gap-y-1">
        <span><strong>Circle</strong> — click centre, drag radius</span>
        <span><strong>Rectangle</strong> — drag corners</span>
        <span><strong>Polygon</strong> — click vertices, double-click to finish</span>
        <span><strong>Edit</strong> — drag white handles on saved shape</span>
      </div>

      {error && (
        <div className="shrink-0 mx-4 mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      {status && !error && (
        <div className="shrink-0 mx-4 mt-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{status}</div>
      )}

      <div ref={mapContainerRef} className="flex-1 min-h-0 w-full" />
    </div>
  );
}
