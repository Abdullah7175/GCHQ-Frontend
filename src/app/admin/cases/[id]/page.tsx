'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TopNav } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuthGuard } from '@/lib/hooks';

type Entity = Record<string, unknown>;

function fmt(dt: unknown): string {
  if (!dt) return '—';
  const d = new Date(String(dt));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDistance(meters: unknown): string {
  if (meters == null || meters === '') return '—';
  const km = Number(meters) / 1000;
  return Number.isFinite(km) ? `${km.toFixed(2)} km (${Math.round(Number(meters))} m)` : '—';
}

function consentLabel(v: unknown): string {
  const s = String(v || '');
  if (s === 'pc') return 'PC — Patient Choice';
  if (s === 'ac') return 'AC — Ambulance Choice';
  return '—';
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 pt-0.5">{label}</dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function CaseDetailsPage() {
  const { ready } = useAuthGuard('admin');
  const params = useParams();
  const id = String(params?.id || '');
  const [caseData, setCaseData] = useState<Entity | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api<Entity>(`/transits/${id}`);
        if (!cancelled) setCaseData(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load case');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  if (!ready) return null;

  const ambulance = caseData?.ambulance as Entity | undefined;
  const hospital = caseData?.hospital as Entity | undefined;
  const emergency = caseData?.emergencyType as Entity | undefined;
  const city = caseData?.city as Entity | undefined;
  const breach = caseData?.etaBreach as Entity | null | undefined;
  const breached = Boolean(caseData?.breached);
  const status = String(caseData?.status || '');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/admin"
            className="btn-ghost text-xs px-3 py-2 inline-flex items-center gap-1"
            onClick={() => {
              /* Cases tab is client state; user returns to admin home */
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Admin
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Case details</h1>
            <p className="text-xs text-slate-500 font-mono">{caseData?.transitId ? String(caseData.transitId) : id}</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-sm text-slate-500 gap-2">
            <svg className="animate-spin h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading case…
          </div>
        )}

        {error && (
          <div className="rounded-lg px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-100">{error}</div>
        )}

        {!loading && !error && caseData && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
              <span
                className={`pill ${
                  status === 'completed'
                    ? 'pill-grey'
                    : status === 'en_route'
                      ? 'pill-blue'
                      : status === 'arrived'
                        ? 'pill-green'
                        : status === 'pending'
                          ? 'pill-amber'
                          : 'pill-grey'
                }`}
              >
                {status.replace('_', ' ') || '—'}
              </span>
              {breached ? (
                <span className="pill pill-red">ETA breach: Yes</span>
              ) : (
                <span className="pill pill-green">ETA breach: No</span>
              )}
              {city?.name != null && (
                <span className="text-xs text-slate-500 ml-auto">{String(city.name)}</span>
              )}
            </div>

            <dl className="px-5 py-2">
              <DetailRow label="Ambulance">
                {ambulance?.unitNumber ? String(ambulance.unitNumber) : '—'}
              </DetailRow>
              <DetailRow label="Pickup / start">{fmt(caseData.startedAt)}</DetailRow>
              <DetailRow label="Hospital">
                {hospital?.name ? String(hospital.name) : '—'}
              </DetailRow>
              <DetailRow label="Emergency">
                {emergency?.name || emergency?.code
                  ? String(emergency.name || emergency.code)
                  : '—'}
              </DetailRow>
              <DetailRow label="End / completed">{fmt(caseData.completedAt)}</DetailRow>
              <DetailRow label="Total distance">
                {fmtDistance(caseData.totalDistanceMeters ?? caseData.routeDistanceMeters)}
              </DetailRow>
              <DetailRow label="Consent (PC/AC)">{consentLabel(caseData.hospitalChoiceConsent)}</DetailRow>
              <DetailRow label="Promised ETA">
                <div className="space-y-0.5">
                  <div>{fmt(caseData.estimatedArrivalAt)}</div>
                  {caseData.baselineEtaMinutes != null && (
                    <div className="text-xs text-slate-500">
                      Baseline {String(caseData.baselineEtaMinutes)} min
                      {caseData.etaMinutes != null ? ` · last live ${String(caseData.etaMinutes)} min` : ''}
                    </div>
                  )}
                </div>
              </DetailRow>
              <DetailRow label="Actual arrival">{fmt(caseData.arrivedAt ?? caseData.completedAt)}</DetailRow>
              <DetailRow label="Breach">
                {breached ? (
                  <div className="space-y-1">
                    <span className="font-semibold text-red-700">Yes</span>
                    {breach && (
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>Detected: {fmt(breach.detectedAt)}</div>
                        <div>Expected: {fmt(breach.expectedAt)}</div>
                        <div>Actual: {fmt(breach.actualAt)}</div>
                        <div>
                          Delay: {breach.delayMinutes != null ? `${String(breach.delayMinutes)} min` : '—'}
                          {breach.thresholdMinutes != null
                            ? ` (threshold ${String(breach.thresholdMinutes)} min)`
                            : ''}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="font-semibold text-green-700">No</span>
                )}
              </DetailRow>
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}
