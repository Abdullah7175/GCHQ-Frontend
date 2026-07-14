'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LAHORE_CENTER, MapMarker, MapRoute } from './map-types';
import { createFleetIcon } from './map-icons';

const centerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapViewSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const lat = Number(center[0]);
  const lng = Number(center[1]);
  const z = Number(zoom);
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(z)) return;
    map.setView([lat, lng], z, { animate: true });
  }, [map, lat, lng, z]);
  return null;
}

interface OsmMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routes?: MapRoute[];
  className?: string;
  onMarkerClick?: (id: string) => void;
}

export default function OsmMapInner({
  center = LAHORE_CENTER,
  zoom = 12,
  markers = [],
  routes = [],
  className = 'h-full w-full',
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

  return (
    <div className={className} style={{ height: '100%', width: '100%', minHeight: 300 }}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <MapViewSync center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.positions}
          pathOptions={{ color: route.color || '#0056b3', weight: 4, opacity: 0.85 }}
        />
      ))}
      {markers.map((m) => (
        <Marker
          key={m.id}
          position={[m.lat, m.lng]}
          icon={createFleetIcon(m.shape || 'circle', m.color || '#d93343')}
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
      ))}
      {markers.length === 0 && (
        <Marker position={center} icon={centerIcon}>
          <Popup>City operations center</Popup>
        </Marker>
      )}
      </MapContainer>
    </div>
  );
}
