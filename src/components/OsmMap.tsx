'use client';

import dynamic from 'next/dynamic';
import { MapMarker, MapRoute } from './map-types';

const OsmMapInner = dynamic(() => import('./OsmMapInner'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-200 animate-pulse flex items-center justify-center text-sm text-on-surface-variant">Loading map...</div>,
});

export function OsmMap(props: {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routes?: MapRoute[];
  className?: string;
  onMarkerClick?: (id: string) => void;
}) {
  return <OsmMapInner {...props} />;
}
