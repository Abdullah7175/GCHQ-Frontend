'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LAHORE_CENTER, MapMarker, MapRoute } from './map-types';
import { createFleetIcon } from './map-icons';

function MapViewSync({
  center,
  zoom,
  fitKey,
  fitPositions,
}: {
  center: [number, number];
  zoom: number;
  fitKey?: string;
  fitPositions?: [number, number][];
}) {
  const map = useMap();
  const lat = Number(center[0]);
  const lng = Number(center[1]);
  const z = Number(zoom);

  useEffect(() => {
    if (fitPositions && fitPositions.length >= 2) {
      const bounds = L.latLngBounds(fitPositions.map(([a, b]) => L.latLng(a, b)));
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2), { animate: true, maxZoom: 14 });
        return;
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(z)) return;
    map.setView([lat, lng], z, { animate: true });
  }, [map, lat, lng, z, fitKey]);

  return null;
}

interface OsmMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routes?: MapRoute[];
  className?: string;
  fitToMarkers?: boolean;
  onMarkerClick?: (id: string) => void;
}

export default function OsmMapInner({
  center = LAHORE_CENTER,
  zoom = 12,
  markers = [],
  routes = [],
  className = 'h-full w-full',
  fitToMarkers = false,
  onMarkerClick,
}: OsmMapProps) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const fitPositions: [number, number][] | undefined = fitToMarkers
    ? [
        ...markers.map((m) => [m.lat, m.lng] as [number, number]),
        ...routes.flatMap((r) => r.positions),
      ]
    : undefined;
  const fitKey = fitToMarkers
    ? markers.map((m) => m.id).sort().join('|')
    : `center:${center[0]},${center[1]},${zoom}`;

  return (
    <div className={className} style={{ height: '100%', width: '100%', minHeight: 300 }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <MapViewSync center={center} zoom={zoom} fitKey={fitKey} fitPositions={fitPositions} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.positions}
            pathOptions={{ color: route.color || '#0056b3', weight: 5, opacity: 0.9 }}
          />
        ))}
        {markers.map((m) => {
          const size = m.shape === 'hospital' || m.shape === 'plus' ? 28 : 22;
          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={createFleetIcon(m.shape || 'circle', m.color || '#d93343', size, m.letter)}
              eventHandlers={
                onMarkerClick
                  ? { click: () => onMarkerClick(m.id) }
                  : undefined
              }
            >
              <Popup>
                <strong>{m.label}</strong>
                {m.sublabel && <div className="text-xs text-gray-600">{m.sublabel}</div>}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
