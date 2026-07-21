'use client';

import { useCallback, useEffect, useState } from 'react';
import { TopNav, StatCard } from '@/components/ui';
import { api, cityQuery } from '@/lib/api';
import { useAuthGuard, useSocket } from '@/lib/hooks';
import { useCityContext } from '@/lib/city-context';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface VvipData {
  operationsTable: {
    transitId: string;
    provider: string;
    destination: string;
    triageLevel: string;
    sector: string;
    status: string;
    emergencyType: string;
    elapsedMinutes: number;
  }[];
  kpis: {
    activeCorridors: number;
    avgTimeSavedMinutes: number;
    transitRate: number;
    corridorsClearedToday: number;
    latencyBreaches: number;
  };
  latencyBreachLog?: {
    id: string;
    breachType: string;
    delayMinutes: number;
    thresholdMinutes: number;
    detectedAt: string;
    sector: string | null;
    referenceType: string;
    summary: string;
    cityName?: string;
  }[];
  providerTrips: { provider: string; code: string; shape: string; color: string; count: string }[];
  hospitalLoad: { hospital: string; count: string }[];
  hospitalEmergencies: { hospital: string; emergencyType: string; code: string; count: string }[];
  sectorEmergencies: { sectorName: string; emergencyType: string; code: string; count: string }[];
  city?: { name: string; code: string };
}

const COLORS = ['#0f7a45', '#1d4ed8', '#c47a0a', '#c62828', '#0e7490', '#7c3aed', '#059669', '#b45309'];

export default function VvipDashboard() {
  const { ready } = useAuthGuard('vvip');
  const { cityId, currentCity, loading: cityLoading } = useCityContext();
  const [data, setData] = useState<VvipData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!cityId) return;
    try {
      setError('');
      setData(await api<VvipData>(`/dashboard/vvip${cityQuery(cityId)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    }
  }, [cityId]);

  useEffect(() => { if (ready && cityId) load(); }, [ready, cityId, load]);
  useSocket(load);

  useEffect(() => {
    if (!ready || !cityId) return;
    const timer = window.setInterval(() => { void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [ready, cityId, load]);

  if (!ready || cityLoading) {
    return <div className="min-h-screen flex items-center justify-center ops-shell">Loading...</div>;
  }

  if (!cityId) {
    return (
      <div className="min-h-screen ops-shell flex flex-col">
        <TopNav active="/vvip" />
        <div className="flex-1 flex items-center justify-center pt-16 text-on-surface-variant">
          Assign a city to this VVIP account (Admin → Users), or select a city if you have multi-city access.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen ops-shell flex flex-col">
        <TopNav active="/vvip" />
        <div className="flex-1 flex items-center justify-center pt-16 text-error">{error || 'Loading...'}</div>
      </div>
    );
  }

  const maxProviderTrips = Math.max(...data.providerTrips.map((p) => Number(p.count)), 1);
  const maxHospitalLoad = Math.max(...data.hospitalLoad.map((h) => Number(h.count)), 1);
  const cityLabel = data.city?.name || currentCity?.name || 'City';

  return (
    <div className="min-h-screen flex flex-col ops-shell">
      <TopNav active="/vvip" />
      <main className="pt-16 p-6 space-y-6 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="section-kicker mb-1">Strategic Overview</p>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">VVIP Command Console</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">{cityLabel} operations</p>
          </div>
          <span className="live-badge">Live operations</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Active Corridors" value={data.kpis.activeCorridors} accent="error" icon="emergency" />
          <StatCard label="Avg Time Saved" value={`${data.kpis.avgTimeSavedMinutes}m`} accent="tertiary" icon="timer" />
          <StatCard label="Transit Rate" value={`${data.kpis.transitRate ?? 0}%`} icon="trending_up" />
          <StatCard label="Corridors Cleared" value={data.kpis.corridorsClearedToday} accent="tertiary" icon="task_alt" />
          <StatCard
            label="Latency Breaches"
            value={data.kpis.latencyBreaches}
            accent={data.kpis.latencyBreaches > 0 ? 'error' : 'tertiary'}
            icon="warning"
          />
        </div>

        <section className="dash-panel overflow-hidden">
          <div className="dash-panel-header px-6 py-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Latency Breaches</h2>
              <p className="text-[11px] text-on-surface-variant">ETA overruns & user presence — today and recent history</p>
            </div>
            <span className={`pill ${data.kpis.latencyBreaches > 0 ? 'pill-red' : 'pill-green'}`}>
              {data.kpis.latencyBreaches} today
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-on-surface-variant uppercase text-[10px] tracking-widest border-b border-outline-variant">
                  <th className="px-4 py-3">Detected</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">User / Case</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Delay</th>
                  <th className="px-4 py-3">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {(data.latencyBreachLog ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-primary-light/40 transition-colors">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {new Date(row.detectedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`pill ${row.breachType === 'transit_eta' ? 'pill-amber' : 'pill-red'}`}>
                        {row.breachType === 'transit_eta' ? 'Ambulance ETA' : 'User offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.summary}</td>
                    <td className="px-4 py-3">{row.sector || row.cityName || '—'}</td>
                    <td className="px-4 py-3 font-mono text-error">{row.delayMinutes}m</td>
                    <td className="px-4 py-3 font-mono">{row.thresholdMinutes}m</td>
                  </tr>
                ))}
                {(data.latencyBreachLog ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">
                      No latency breaches recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dash-panel overflow-hidden">
          <div className="dash-panel-header px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Live Operations</h2>
            <p className="text-[11px] text-on-surface-variant">City-scoped · fleet filters apply when configured</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-on-surface-variant uppercase text-[10px] tracking-widest border-b border-outline-variant">
                  <th className="px-4 py-3">Transit ID</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Emergency</th>
                  <th className="px-4 py-3">Triage</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Elapsed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.operationsTable.map((op) => (
                  <tr key={op.transitId} className="hover:bg-primary-light/40 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{op.transitId}</td>
                    <td className="px-4 py-3">{op.provider}</td>
                    <td className="px-4 py-3">{op.emergencyType}</td>
                    <td className="px-4 py-3">{op.triageLevel}</td>
                    <td className="px-4 py-3">{op.sector}</td>
                    <td className="px-4 py-3">
                      <span className="pill pill-green uppercase">{op.status}</span>
                    </td>
                    <td className="px-4 py-3 font-mono">{op.elapsedMinutes}m</td>
                  </tr>
                ))}
                {data.operationsTable.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-on-surface-variant">No active operations</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="dash-panel p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-900">Emergency Trips Today by Provider</h3>
            <div className="space-y-4">
              {data.providerTrips.map((p) => (
                <div key={p.code}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{p.provider}</span>
                    <span className="font-mono font-bold">{p.count} trips</span>
                  </div>
                  <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(Number(p.count) / maxProviderTrips) * 100}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              ))}
              {data.providerTrips.length === 0 && (
                <p className="text-sm text-on-surface-variant">No trips today</p>
              )}
            </div>
          </section>

          <section className="dash-panel p-6">
            <h3 className="text-lg font-semibold mb-4 text-slate-900">Hospital Load Distribution Today</h3>
            <div className="space-y-4">
              {data.hospitalLoad.map((h) => (
                <div key={h.hospital}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{h.hospital}</span>
                    <span className="font-mono font-bold">{h.count} patients</span>
                  </div>
                  <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(Number(h.count) / maxHospitalLoad) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {data.hospitalLoad.length === 0 && (
                <p className="text-sm text-on-surface-variant">No completed arrivals today</p>
              )}
            </div>
          </section>
        </div>

        <section className="dash-panel p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-900">Incident Types by Sector</h3>
          <div className="h-[350px] w-full">
            {data.sectorEmergencies.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sectorEmergencies}
                    dataKey="count"
                    nameKey="sectorName"
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    label={({ payload }: any) => `${payload.sectorName}: ${payload.emergencyType}`}
                  >
                    {data.sectorEmergencies.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [value, props.payload.emergencyType]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-on-surface-variant text-sm">No sector data today</div>
            )}
          </div>
        </section>

        <section className="dash-panel p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-900">Emergency Types by Hospital (Today)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant uppercase text-[10px] tracking-wider border-b border-outline-variant">
                  <th className="text-left py-2">Hospital</th>
                  <th className="text-left py-2">Emergency Type</th>
                  <th className="text-right py-2">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.hospitalEmergencies.map((row, i) => (
                  <tr key={i} className="hover:bg-primary-light/30">
                    <td className="py-2.5">{row.hospital}</td>
                    <td className="py-2.5">{row.emergencyType}</td>
                    <td className="py-2.5 text-right font-mono font-bold">{row.count}</td>
                  </tr>
                ))}
                {data.hospitalEmergencies.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-on-surface-variant">No hospital emergency rows today</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
