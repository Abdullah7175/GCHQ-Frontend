'use client';

import dynamic from 'next/dynamic';

const HospitalGeofenceEditor = dynamic(() => import('./HospitalGeofenceEditor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-sm text-slate-600">
      Loading map editor…
    </div>
  ),
});

export default function HospitalGeofencePage() {
  return <HospitalGeofenceEditor />;
}
