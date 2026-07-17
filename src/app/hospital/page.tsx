'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopNav } from '@/components/ui';
import { api, cityQuery } from '@/lib/api';
import { formatEta, useAuthGuard, useSocket } from '@/lib/hooks';
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
  status: string;
  completedAt?: string | null;
  ambulance: { unitNumber: string; provider: { name: string } };
  emergencyType: { name: string };
  triageCode: { name: string; color: string; priority: number };
  sector: { name: string };
}

interface DashboardData {
  stats: { totalIncoming: number; todayCompleted: number; staffAlertActive: boolean };
  incomingQueue: Transit[];
  completedHistory: Transit[];
  emergencyBreakdown: { name: string; code: string; count: string }[];
}

interface AlertItem {
  id: string;
  transit: Transit;
  expiresAt: number;
}

const HOSPITAL_STORAGE_KEY = 'selectedHospitalId';

function getStoredHospitalId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(HOSPITAL_STORAGE_KEY);
}

function setStoredHospitalId(id: string) {
  localStorage.setItem(HOSPITAL_STORAGE_KEY, id);
}

function StatusTableRow({ transit }: { transit: Transit }) {
  const eta = transit.status === 'completed' ? 'Done' : formatEta(transit.etaMinutes);
  const isOngoing = transit.status !== 'completed';

  return (
    <tr className={`border-b border-outline-variant last:border-b-0 ${isOngoing ? 'animate-matrix-alert bg-red-50/80' : ''}`}>
      <td className="w-[26%] px-2.5 py-2 align-top">
        <div className="font-mono font-bold text-[11px] text-slate-800 break-words">{transit.transitId}</div>
        <div className="text-[10px] uppercase text-slate-500 break-words">{transit.status}</div>
      </td>
      <td className="w-[25%] px-2.5 py-2 align-top">
        <div className="font-semibold text-[11px] text-slate-800 break-words">{transit.ambulance.unitNumber}</div>
        <div className="text-[10px] text-slate-500 break-words">{transit.sector?.name || 'Unknown Sector'}</div>
      </td>
      <td className="w-[29%] px-2.5 py-2 align-top">
        <div className="font-semibold text-[11px] text-slate-800 break-words">{transit.triageCode.name}</div>
        <div className="text-[10px] text-slate-500 break-words">{transit.emergencyType.name}</div>
      </td>
      <td className="w-[20%] px-2.5 py-2 align-top">
        <div className="font-semibold text-[11px] text-slate-800 whitespace-nowrap">{eta}</div>
        <div className="text-[10px] text-slate-500">
          {transit.status === 'completed' && transit.completedAt
            ? new Date(transit.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'ongoing'}
        </div>
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

  const prevQueueIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [tick, setTick] = useState(0);
  const [soundReady, setSoundReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAlertSound = useCallback(async () => {
    try {
      const base = audioRef.current ?? new Audio('/alert-sound.mp3');
      audioRef.current = base;
      // Clone so overlapping alerts can each play
      const clip = base.cloneNode(true) as HTMLAudioElement;
      clip.volume = 1;
      await clip.play();
      setSoundReady(true);
    } catch {
      setSoundReady(false);
    }
  }, []);

  const unlockSound = useCallback(async () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/alert-sound.mp3');
        audioRef.current.preload = 'auto';
      }
      const a = audioRef.current;
      a.muted = true;
      await a.play();
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      setSoundReady(true);
    } catch {
      setSoundReady(false);
    }
  }, []);

  useEffect(() => {
    audioRef.current = new Audio('/alert-sound.mp3');
    audioRef.current.preload = 'auto';
    const unlock = () => { void unlockSound(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [unlockSound]);

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

  useEffect(() => {
    primedRef.current = false;
    prevQueueIdsRef.current = new Set();
    setAlerts([]);
  }, [hospitalId]);

  useEffect(() => { if (ready && hospitalId) load(); }, [ready, hospitalId, load]);
  useSocket(load);

  useEffect(() => {
    if (!data?.incomingQueue) return;
    const currentIds = new Set(data.incomingQueue.map((t) => t.id));

    // First snapshot after hospital load — baseline only, no alerts
    if (!primedRef.current) {
      primedRef.current = true;
      prevQueueIdsRef.current = currentIds;
      return;
    }

    const prevIds = prevQueueIdsRef.current;
    const newTransits = data.incomingQueue.filter((t) => !prevIds.has(t.id));
    if (newTransits.length) {
      const now = Date.now();
      setAlerts((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const additions = newTransits
          .filter((t) => !existing.has(t.id))
          .map((t) => ({
            id: t.id,
            transit: t,
            expiresAt: now + 60_000,
          }));
        return [...prev, ...additions];
      });

      newTransits.forEach((_, index) => {
        window.setTimeout(() => { void playAlertSound(); }, index * 400);
      });
    }
    prevQueueIdsRef.current = currentIds;
  }, [data?.incomingQueue, playAlertSound]);

  useEffect(() => {
    if (!alerts.length) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      setAlerts((prev) => prev.filter((item) => item.expiresAt > now));
    }, 250);
    return () => window.clearInterval(timer);
  }, [alerts.length]);

  useEffect(() => {
    setAlerts((prev) =>
      prev.map((item) => {
        const updated = data?.incomingQueue.find((t) => t.id === item.id);
        return updated ? { ...item, transit: updated } : item;
      }),
    );
  }, [data?.incomingQueue]);

  function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  }

  function handleHospitalChange(id: string) {
    setHospitalId(id);
    setStoredHospitalId(id);
    setData(null);
  }

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);
  const hospitalName = isAdmin ? selectedHospital?.name : user?.hospital?.name;

  const triageOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set([...data.incomingQueue, ...data.completedHistory].map((t) => t.triageCode.name));
    return Array.from(set);
  }, [data?.incomingQueue, data?.completedHistory]);

  const issueOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set([...data.incomingQueue, ...data.completedHistory].map((t) => t.emergencyType.name));
    return Array.from(set);
  }, [data?.incomingQueue, data?.completedHistory]);

  const filteredQueue = useMemo(() => {
    let list = data?.incomingQueue ?? [];
    if (filterTriage) {
      list = list.filter((t) => t.triageCode.name === filterTriage);
    }
    if (filterIssue) {
      list = list.filter((t) => t.emergencyType.name === filterIssue);
    }

    if (alerts[0]) {
      const queue = [...list];
      const idx = queue.findIndex((t) => t.id === alerts[0].id);
      if (idx > -1) {
        const [item] = queue.splice(idx, 1);
        queue.unshift(item);
        return queue;
      }
    }
    return list;
  }, [data?.incomingQueue, filterTriage, filterIssue, alerts]);

  const filteredHistory = useMemo(() => {
    let list = data?.completedHistory ?? [];
    if (filterTriage) {
      list = list.filter((t) => t.triageCode.name === filterTriage);
    }
    if (filterIssue) {
      list = list.filter((t) => t.emergencyType.name === filterIssue);
    }
    return list;
  }, [data?.completedHistory, filterTriage, filterIssue]);

  const combinedStatusList = useMemo(
    () => [...filteredQueue, ...filteredHistory],
    [filteredQueue, filteredHistory],
  );

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
    <div className="h-screen flex flex-col overflow-hidden ops-shell">
      <TopNav active="/hospital" />
      <div className="flex pt-16 h-full overflow-hidden">
        <style>{`
          @keyframes hospital-alert-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.03); opacity: 0.96; }
          }
          @keyframes matrix-alert-glow {
            0%, 100% { background-color: #fff8f8; box-shadow: 0 0 0 rgba(198, 40, 40, 0); }
            50% { background-color: #ffefef; box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.12); }
          }
          .animate-hospital-alert {
            animation: hospital-alert-pulse 1s infinite ease-in-out;
          }
          .animate-matrix-alert {
            animation: matrix-alert-glow 1.2s infinite ease-in-out;
          }
        `}</style>

        <main className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          {isAdmin && hospitals.length > 0 && (
            <div className="max-w-xs">
              <label className="section-kicker block mb-2">Select Hospital</label>
              <select
                value={hospitalId}
                onChange={(e) => handleHospitalChange(e.target.value)}
                className="w-full border border-outline-variant rounded-xl px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-primary font-semibold text-slate-800 shadow-sm"
              >
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0">
            <section className="flex-[1.45] flex flex-col gap-6 min-w-[340px]">
              <div className="dash-panel p-6">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">dashboard</span>
                    Ongoing Grid
                  </h4>
                  <div className="flex gap-2 items-center">
                    {!soundReady && (
                      <button
                        type="button"
                        onClick={() => void unlockSound()}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold bg-amber-500 text-white hover:bg-amber-600"
                      >
                        Enable alert sound
                      </button>
                    )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {filteredQueue.map((t) => (
                    <div
                      key={t.id}
                      className={`dash-card-critical p-4 min-h-[190px] animate-matrix-alert`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono font-bold text-base text-slate-800">{t.transitId}</p>
                          <p className="text-sm font-semibold text-slate-700">{t.ambulance.unitNumber}</p>
                        </div>
                        <span className="rounded-full px-2 py-1 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: t.triageCode.color }}>
                          {t.triageCode.name}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Emergency</p>
                          <p className="font-semibold text-slate-700">{t.emergencyType.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">ETA</p>
                          <p className="font-semibold text-slate-700">{formatEta(t.etaMinutes)}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Hospital</p>
                          <p className="font-semibold text-slate-700">{hospitalName || 'Hospital ER'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Notes</p>
                          <p className="text-xs italic text-slate-500">"{t.paramedicNotes || 'No notes provided'}"</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredQueue.length === 0 && (
                    <p className="text-slate-400 text-sm italic py-4 text-center">No ongoing ambulances.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="w-full lg:w-[330px] xl:w-[320px] shrink-0 flex flex-col gap-6">
              <div className="dash-panel overflow-hidden">
                <div className="dash-panel-header px-4 py-3">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">table_rows</span>
                    Ongoing and Completed Details
                  </h4>
                </div>
                <div className="overflow-y-auto overflow-x-hidden max-h-[420px] custom-scrollbar">
                  <table className="w-full table-fixed text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-500 uppercase text-[10px] font-bold tracking-widest border-b border-outline-variant">
                        <th className="w-[26%] px-2.5 py-2">Transit</th>
                        <th className="w-[25%] px-2.5 py-2">Ambulance</th>
                        <th className="w-[29%] px-2.5 py-2">Priority</th>
                        <th className="w-[20%] px-2.5 py-2">ETA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedStatusList.map((t) => (
                        <StatusTableRow key={`${t.status}-${t.id}`} transit={t} />
                      ))}
                      {combinedStatusList.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-10 text-center text-slate-400 font-medium text-sm">
                            No ongoing or completed cases matching filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {alerts.length > 0 && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/75 backdrop-blur-sm p-3 sm:p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
            <p className="text-white font-extrabold uppercase tracking-wider text-sm sm:text-base">
              Incoming alerts · {alerts.length}
            </p>
            {!soundReady && (
              <button
                type="button"
                onClick={() => void unlockSound()}
                className="rounded-lg px-3 py-1.5 text-xs font-bold bg-amber-500 text-white"
              >
                Enable sound
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 content-start h-full auto-rows-fr">
              {alerts.map((alert) => {
                const secsLeft = Math.max(0, Math.ceil((alert.expiresAt - (tick || Date.now())) / 1000));
                return (
                  <div
                    key={alert.id}
                    className="animate-hospital-alert relative flex flex-col bg-white rounded-2xl shadow-2xl border-4 border-red-600 p-5 min-h-[280px]"
                  >
                    <button
                      type="button"
                      aria-label="Close alert"
                      onClick={() => dismissAlert(alert.id)}
                      className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow-lg"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
                    </button>

                    <div className="flex items-start justify-between gap-3 pr-12">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-red-600">Incoming ambulance</p>
                        <p className="font-mono font-bold text-2xl text-slate-900 mt-1">{alert.transit.transitId}</p>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white shrink-0"
                        style={{ backgroundColor: alert.transit.triageCode.color }}
                      >
                        {alert.transit.triageCode.name}
                      </span>
                    </div>

                    <div className="mt-5 space-y-2 text-sm sm:text-base text-slate-700 flex-1">
                      <p><strong>Ambulance:</strong> {alert.transit.ambulance.unitNumber}</p>
                      <p><strong>Provider:</strong> {alert.transit.ambulance.provider?.name || '—'}</p>
                      <p><strong>Emergency:</strong> {alert.transit.emergencyType.name}</p>
                      <p><strong>Sector:</strong> {alert.transit.sector?.name || '—'}</p>
                      <p><strong>ETA:</strong> {formatEta(alert.transit.etaMinutes)}</p>
                      <p className="italic text-slate-500">"{alert.transit.paramedicNotes || 'No notes provided'}"</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                        Auto-close in {secsLeft}s
                      </p>
                      <div className="h-1.5 flex-1 max-w-[140px] rounded-full bg-red-100 overflow-hidden">
                        <div
                          className="h-full bg-red-600 transition-[width] duration-250 ease-linear"
                          style={{ width: `${Math.max(0, (secsLeft / 60) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
