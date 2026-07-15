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
  providerTrips: { provider: string; code: string; shape: string; color: string; count: string }[];
  hospitalLoad: { hospital: string; count: string }[];
  hospitalEmergencies: { hospital: string; emergencyType: string; code: string; count: string }[];
  sectorEmergencies: { sectorName: string; emergencyType: string; code: string; count: string }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#d0ed57', '#a4de6c'];

export default function VvipDashboard() {
  const { ready } = useAuthGuard('vvip');
  const { cityId } = useCityContext();
  const [data, setData] = useState<VvipData | null>(null);

  const load = useCallback(async () => {
    setData(await api<VvipData>(`/dashboard/vvip${cityQuery(cityId)}`));
  }, [cityId]);

  useEffect(() => { if (ready) load(); }, [ready, load]);
  useSocket(load);

  if (!ready || !data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const maxProviderTrips = Math.max(...data.providerTrips.map((p) => Number(p.count)), 1);
  const maxHospitalLoad = Math.max(...data.hospitalLoad.map((h) => Number(h.count)), 1);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav active="/vvip" />
      <main className="pt-16 p-6 space-y-6 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">VVIP Command Console</h1>
          <span className="text-xs font-mono bg-primary/10 text-primary px-3 py-1 rounded">LIVE OPERATIONS</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Active Corridors" value={data.kpis.activeCorridors} accent="error" />
          <StatCard label="Avg Time Saved" value={`${data.kpis.avgTimeSavedMinutes}m`} accent="tertiary" />
          <StatCard label="Transit Rate" value={`${data.kpis.transitRate}%`} />
          <StatCard label="Corridors Cleared" value={data.kpis.corridorsClearedToday} accent="tertiary" />
          <StatCard
            label="Latency Breaches"
            value={data.kpis.latencyBreaches}
            accent={data.kpis.latencyBreaches > 0 ? 'error' : 'tertiary'}
          />
        </div>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h2 className="text-lg font-semibold">System-Wide Live Operations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant uppercase text-[10px] tracking-widest">
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
                  <tr key={op.transitId} className="hover:bg-surface-container-low/50">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{op.transitId}</td>
                    <td className="px-4 py-3">{op.provider}</td>
                    <td className="px-4 py-3">{op.emergencyType}</td>
                    <td className="px-4 py-3">{op.triageLevel}</td>
                    <td className="px-4 py-3">{op.sector}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-bold uppercase">{op.status}</span></td>
                    <td className="px-4 py-3 font-mono">{op.elapsedMinutes}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Emergency Trips Today by Provider</h3>
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
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Hospital Load Distribution Today</h3>
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
            </div>
          </section>
        </div>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Incident Types by Sector</h3>
          <div className="h-[350px] w-full">
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
          </div>
        </section>

        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Emergency Types by Hospital (Today)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant uppercase text-[10px]">
                  <th className="text-left py-2">Hospital</th>
                  <th className="text-left py-2">Emergency Type</th>
                  <th className="text-right py-2">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {data.hospitalEmergencies.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2">{row.hospital}</td>
                    <td className="py-2">{row.emergencyType}</td>
                    <td className="py-2 text-right font-mono font-bold">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
