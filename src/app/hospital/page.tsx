'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function QueueRow({ transit, isNew }: { transit: Transit; isNew: boolean }) {
  const eta = useLiveEta(transit.etaMinutes);
  const isCritical = transit.triageCode.priority === 1;

  return (
    <tr className={`hover:bg-slate-50 transition-all ${isNew ? 'bg-error-container/20 font-bold border-2 border-error' : ''}`}>
      <td className="px-6 py-5">
        <div className="flex flex-col">
          <span className={`text-2xl font-mono leading-none font-extrabold ${isCritical ? 'text-error' : 'text-slate-700'}`}>
            {eta}
          </span>
          <span className="text-[9px] text-slate-400 font-extrabold uppercase mt-1">minutes eta</span>
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-12 rounded-full shrink-0" style={{ backgroundColor: transit.triageCode.color }} />
          <div>
            <p className="font-extrabold text-base text-slate-800">{transit.triageCode.name}: {transit.emergencyType.name}</p>
            <p className="text-xs font-semibold text-slate-500">Unit: <span className="font-mono text-primary">{transit.ambulance.unitNumber}</span> ({transit.sector?.name || 'Unknown Sector'})</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5" colSpan={2}>
        <p className="text-sm font-medium text-slate-600 bg-slate-50 border border-slate-100 p-2.5 rounded italic max-w-lg">
          &quot;{transit.paramedicNotes || 'No notes reported'}&quot;
        </p>
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

  // Filters State
  const [filterTriage, setFilterTriage] = useState('');
  const [filterIssue, setFilterIssue] = useState('');

  // New Transit Alert Popup State
  const prevQueueIdsRef = useRef<Set<string>>(new Set());
  const [newTransitAlert, setNewTransitAlert] = useState<Transit | null>(null);

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

  // Monitor for incoming transits to alert
  useEffect(() => {
    if (!data?.incomingQueue) return;
    const currentIds = new Set(data.incomingQueue.map((t) => t.id));
    const prevIds = prevQueueIdsRef.current;

    // Only fire alert popups if this is not the initial page load
    if (prevIds.size > 0) {
      const newTransit = data.incomingQueue.find((t) => !prevIds.has(t.id));
      if (newTransit) {
        setNewTransitAlert(newTransit);
        const timer = setTimeout(() => {
          setNewTransitAlert(null);
        }, 5000);
        prevQueueIdsRef.current = currentIds;
        return () => clearTimeout(timer);
      }
    }
    prevQueueIdsRef.current = currentIds;
  }, [data?.incomingQueue]);

  function handleHospitalChange(id: string) {
    setHospitalId(id);
    setStoredHospitalId(id);
    setData(null);
  }

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);
  const hospitalName = isAdmin ? selectedHospital?.name : user?.hospital?.name;

  // Filter options derived dynamically from queue
  const triageOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.incomingQueue.map((t) => t.triageCode.name));
    return Array.from(set);
  }, [data?.incomingQueue]);

  const issueOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.incomingQueue.map((t) => t.emergencyType.name));
    return Array.from(set);
  }, [data?.incomingQueue]);

  // Filtered queue grouped with the alerted transit strictly pinned to top
  const filteredQueue = useMemo(() => {
    let list = data?.incomingQueue ?? [];
    if (filterTriage) {
      list = list.filter((t) => t.triageCode.name === filterTriage);
    }
    if (filterIssue) {
      list = list.filter((t) => t.emergencyType.name === filterIssue);
    }

    if (newTransitAlert) {
      const queue = [...list];
      const idx = queue.findIndex((t) => t.id === newTransitAlert.id);
      if (idx > -1) {
        const [item] = queue.splice(idx, 1);
        queue.unshift(item);
        return queue;
      }
    }
    return list;
  }, [data?.incomingQueue, filterTriage, filterIssue, newTransitAlert]);

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
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <TopNav active="/hospital" />
      <div className="flex pt-16 h-full overflow-hidden">
        {/* CSS Animation Injector */}
        <style>{`
          @keyframes center-alert-blink {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.95; }
          }
          .animate-alert-blink {
            animation: center-alert-blink 1s infinite ease-in-out;
          }
        `}</style>

        {/* Sidebar */}
        <aside className="hidden lg:flex fixed left-0 h-full w-[280px] bg-white border-r border-outline-variant flex-col py-4 z-20">
          <div className="px-6 mb-8">
            {isAdmin && hospitals.length > 0 && (
              <div className="mb-6">
                <label className="text-[10px] font-extrabold uppercase text-primary block mb-2 tracking-wider">Select Hospital</label>
                <select
                  value={hospitalId}
                  onChange={(e) => handleHospitalChange(e.target.value)}
                  className="w-full border border-outline-variant rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-primary font-semibold text-slate-800"
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>
            )}
            <h2 className="text-xl font-bold text-slate-800">{hospitalName || 'Hospital ER'}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold text-slate-500">Active Ops: {String(data.stats.totalIncoming).padStart(2, '0')} In-Bound</span>
            </div>
            {isAdmin && (
              <a href="/admin" className="inline-flex items-center gap-1.5 mt-6 text-xs font-bold text-primary hover:underline">
                <span className="material-symbols-outlined text-[16px]">settings</span>
                System Administration
              </a>
            )}
          </div>
        </aside>

        {/* Main Content Pane */}
        <main className="flex-1 lg:ml-[280px] p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          {/* Stats Bar */}
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
            {/* Tabular Patient Queue */}
            <section className="flex-[1.5] bg-white rounded-xl border border-outline-variant flex flex-col overflow-hidden shadow-sm">
              <div className="px-6 py-4.5 border-b border-outline-variant flex flex-wrap justify-between items-center bg-slate-50 gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[24px]">clinical_research</span>
                  <h3 className="text-lg font-bold text-slate-800">Incoming Patient Triage Queue</h3>
                </div>

                {/* Inline filters */}
                <div className="flex gap-2">
                  <select
                    className="border border-outline-variant rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
                    value={filterTriage}
                    onChange={(e) => setFilterTriage(e.target.value)}
                  >
                    <option value="">All Triage Levels</option>
                    {triageOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>

                  <select
                    className="border border-outline-variant rounded-lg px-2 py-1 text-xs bg-white focus:outline-none"
                    value={filterIssue}
                    onChange={(e) => setFilterIssue(e.target.value)}
                  >
                    <option value="">All Issues</option>
                    {issueOptions.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-outline-variant">
                      <th className="px-6 py-3">ETA</th>
                      <th className="px-6 py-3">Patient Priority / Ambulance</th>
                      <th className="px-6 py-3" colSpan={2}>Paramedic Vitals & Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {filteredQueue.map((t) => (
                      <QueueRow key={t.id} transit={t} isNew={newTransitAlert?.id === t.id} />
                    ))}
                    {filteredQueue.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium">
                          No active incoming ambulances matching filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Breakdown section */}
            <section className="flex-1 flex flex-col gap-6 min-w-[340px]">
              <div className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm">
                <h4 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Emergency Breakdown Today
                </h4>
                <div className="space-y-3">
                  {data.emergencyBreakdown.map((e) => (
                    <div key={e.code} className="flex justify-between items-center bg-slate-50 p-3.5 rounded-lg border border-outline-variant">
                      <span className="font-semibold text-slate-700">{e.name}</span>
                      <span className="font-mono font-extrabold text-primary text-base">{e.count}</span>
                    </div>
                  ))}
                  {data.emergencyBreakdown.length === 0 && (
                    <p className="text-slate-400 text-sm italic py-4 text-center">No emergencies recorded today</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Blinking Triage Alert Popup in center screen */}
      {newTransitAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="animate-alert-blink text-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center space-y-4 border-4 border-white"
            style={{ backgroundColor: newTransitAlert.triageCode.color }}
          >
            <span className="material-symbols-outlined text-6xl text-white">emergency</span>
            <div>
              <h2 className="text-3xl font-extrabold uppercase tracking-wide">
                NEW INCOMING PATIENT!
              </h2>
              <p className="text-sm font-bold opacity-90 mt-1">
                Triage Priority: {newTransitAlert.triageCode.name}
              </p>
            </div>
            <div className="bg-white/15 rounded-xl p-5 text-left border border-white/20">
              <p className="font-mono font-bold text-2xl mb-1">{newTransitAlert.transitId}</p>
              <p className="text-sm font-semibold">Diagnosis: {newTransitAlert.emergencyType.name}</p>
              <p className="text-sm font-semibold">Ambulance: {newTransitAlert.ambulance.unitNumber}</p>
              <p className="text-xs italic opacity-95 mt-3 border-t border-white/20 pt-2">
                &quot;{newTransitAlert.paramedicNotes || 'No vitals notes provided'}&quot;
              </p>
            </div>
            <p className="text-xs font-bold uppercase opacity-85 tracking-widest animate-pulse">
              Autodismissing in 5 seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
