'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopNav, StatCard } from '@/components/ui';
import { api, cityQuery } from '@/lib/api';
import { useAuthGuard, useSocket, useLiveEta } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';

interface HospitalOption {
  id: string;
  name: string;
}

interface Transit {
  id: string;
  transitId: string;
  etaMinutes: number;
  paramedicNotes: string;
  prepStatus: string;
  ambulance: { unitNumber: string; provider: { name: string } };
  emergencyType: { name: string };
  triageCode: { name: string; color: string; priority: number };
  sector: { name: string };
}

interface DashboardData {
  stats: { totalIncoming: number; todayCompleted: number; staffAlertActive: boolean };
  incomingQueue: Transit[];
  emergencyBreakdown: { name: string; code: string; count: string }[];
}

const HOSPITAL_STORAGE_KEY = 'selectedHospitalId';

function getStoredHospitalId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(HOSPITAL_STORAGE_KEY);
}

function setStoredHospitalId(id: string) {
  localStorage.setItem(HOSPITAL_STORAGE_KEY, id);
}

function QueueRow({ transit }: { transit: Transit }) {
  const eta = useLiveEta(transit.etaMinutes);
  const isCritical = transit.triageCode.priority === 1;

  return (
    <tr className="hover:bg-surface-container-low/50 transition-colors">
      <td className="px-6 py-5">
        <div className="flex flex-col">
          <span className={`text-xl font-mono leading-none ${isCritical ? 'text-secondary-container' : 'text-tertiary'}`}>
            {eta}
          </span>
          <span className="text-[10px] text-on-surface-variant uppercase mt-1">minutes</span>
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: transit.triageCode.color }} />
          <div>
            <p className="font-bold">{transit.triageCode.name}: {transit.emergencyType.name}</p>
            <p className="text-sm text-on-surface-variant">Unit: {transit.ambulance.unitNumber} ({transit.sector?.name})</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5" colSpan={2}>
        <p className="text-sm italic line-clamp-2 max-w-md">&quot;{transit.paramedicNotes || 'No notes'}&quot;</p>
      </td>
    </tr>
  );
}

export default function HospitalDashboard() {
  const { user, ready } = useAuthGuard('hospital');
  const { cityId, currentCity, loading: cityLoading } = useCityContext();
  const isAdmin = user?.role === 'admin';
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [hospitalsLoaded, setHospitalsLoaded] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin) {
      setHospitalId(user?.hospitalId ?? user?.hospital?.id ?? null);
      setHospitalsLoaded(true);
      return;
    }
    if (!cityId) {
      setHospitals([]);
      setHospitalId(null);
      setHospitalsLoaded(true);
      return;
    }
    setHospitalsLoaded(false);
    setHospitalId(null);
    setData(null);
    setError('');
    api<HospitalOption[]>(`/hospitals${cityQuery(cityId)}`)
      .then((list) => {
        setHospitals(list);
        const stored = getStoredHospitalId();
        const validStored = stored && list.some((h) => h.id === stored) ? stored : null;
        const resolved = validStored ?? list[0]?.id ?? null;
        setHospitalId(resolved);
        if (resolved) setStoredHospitalId(resolved);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load hospitals'))
      .finally(() => setHospitalsLoaded(true));
  }, [ready, isAdmin, cityId, user?.hospitalId, user?.hospital?.id]);

  const load = useCallback(async () => {
    if (!hospitalId) return;
    try {
      setError('');
      const d = await api<DashboardData>(`/dashboard/hospital?hospitalId=${hospitalId}`);
      setData(d);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [hospitalId]);

  useEffect(() => { if (ready && hospitalId) load(); }, [ready, hospitalId, load]);
  useSocket(load);

  function handleHospitalChange(id: string) {
    setHospitalId(id);
    setStoredHospitalId(id);
    setData(null);
  }

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);
  const hospitalName = isAdmin ? selectedHospital?.name : user?.hospital?.name;

  if (!ready || cityLoading || (isAdmin && !hospitalsLoaded)) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (isAdmin && hospitalsLoaded && hospitals.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav active="/hospital" />
        <div className="flex-1 flex items-center justify-center pt-16 px-6">
          <div className="max-w-md text-center space-y-3">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">local_hospital</span>
            <h2 className="text-xl font-semibold">No hospitals in {currentCity?.name || 'this city'}</h2>
            <p className="text-sm text-on-surface-variant">
              Create a hospital for this city first (Admin → Hospitals), or switch to another city in the top navigation.
            </p>
            <a href="/admin" className="inline-block mt-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold">
              Go to Admin
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!hospitalId) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav active="/hospital" />
        <div className="flex-1 flex items-center justify-center pt-16 text-on-surface-variant">
          {isAdmin ? 'Select a hospital to view the ER dashboard.' : 'No hospital assigned to this account.'}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav active="/hospital" />
        <div className="flex-1 flex items-center justify-center pt-16 text-error">{error}</div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopNav active="/hospital" />
      <div className="flex pt-16 h-full">
        <aside className="hidden lg:flex fixed left-0 h-full w-[280px] bg-surface-container-lowest border-r border-outline-variant flex-col py-4">
          <div className="px-6 mb-8">
            {isAdmin && hospitals.length > 0 && (
              <div className="mb-4">
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Hospital</label>
                <select
                  value={hospitalId}
                  onChange={(e) => handleHospitalChange(e.target.value)}
                  className="w-full border border-outline-variant rounded px-2 py-1.5 text-sm bg-surface"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
            <h2 className="text-xl font-semibold">{hospitalName || 'Hospital ER'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-secondary-container rounded-full severity-pulse" />
              <span className="text-sm text-on-surface-variant">Active Ops: {String(data.stats.totalIncoming).padStart(2, '0')} In-Bound</span>
            </div>
          </div>
        </aside>

        <main className="flex-1 lg:ml-[280px] p-6 flex flex-col gap-6 bg-surface-container-low overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Incoming" value={String(data.stats.totalIncoming).padStart(2, '0')} suffix="Ambulances" />
            <StatCard label="Completed Today" value={data.stats.todayCompleted} accent="tertiary" />
            <StatCard
              label="Staff Alert Status"
              value={data.stats.staffAlertActive ? 'ACTIVE' : 'NORMAL'}
              accent={data.stats.staffAlertActive ? 'error' : 'tertiary'}
            />
          </div>

          <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0">
            <section className="flex-[1.5] bg-surface-container-lowest rounded border border-outline-variant flex flex-col overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">ambulance</span>
                  <h3 className="text-xl font-semibold">En-Route Incoming Queue</h3>
                </div>
                <span className="text-sm font-mono text-on-surface-variant bg-surface-container-low px-2 py-1 rounded">Live Syncing...</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-on-surface-variant uppercase text-[10px] tracking-widest border-b border-outline-variant">
                      <th className="px-6 py-3 font-bold">ETA</th>
                      <th className="px-6 py-3 font-bold">Condition / Unit</th>
                      <th className="px-6 py-3 font-bold" colSpan={2}>Paramedic Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {data.incomingQueue.map((t) => (
                      <QueueRow key={t.id} transit={t} />
                    ))}
                    {data.incomingQueue.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-12 text-center text-on-surface-variant">No incoming ambulances</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="flex-1 flex flex-col gap-6 min-w-[340px]">
              <div className="flex-1 bg-surface-container-lowest rounded border border-outline-variant p-6 shadow-sm">
                <h4 className="text-xl font-semibold flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">emergency_heat</span>
                  Emergency Types Received Today
                </h4>
                <div className="space-y-3">
                  {data.emergencyBreakdown.map((e) => (
                    <div key={e.code} className="flex justify-between items-center bg-surface-container-low p-3 rounded border border-outline-variant">
                      <span className="font-medium">{e.name}</span>
                      <span className="font-mono font-bold text-primary">{e.count}</span>
                    </div>
                  ))}
                  {data.emergencyBreakdown.length === 0 && (
                    <p className="text-on-surface-variant text-sm">No emergencies recorded today</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
