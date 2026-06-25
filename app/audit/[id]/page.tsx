'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AuditRequestResponse {
  id: string;
  status: string;
  reportSummary: string | null;
  websiteUrl: string;
  businessName: string | null;
  auditId: string | null;
  researchUrl: string | null;
  findings: Array<{ severity: string; title: string; description: string; category: string }>;
  createdAt: string;
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === 'critical'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : severity === 'warning'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-slate-500/15 text-slate-300 border-slate-500/30';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${styles}`}>
      {severity}
    </span>
  );
}

function StatusBanner({ status }: { status: string }) {
  if (status === 'pending' || status === 'processing') {
    return (
      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200">
        <p className="font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
          Your audit is running…
        </p>
        <p className="text-sm text-blue-200/80 mt-1">
          This page refreshes automatically. It usually takes 1–3 minutes.
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200">
        <p className="font-medium">We couldn&apos;t complete your audit</p>
        <p className="text-sm mt-1">
          <Link href="/" className="underline hover:text-red-100">
            Request another free audit
          </Link>
        </p>
      </div>
    );
  }

  return null;
}

export default function VisitorAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [data, setData] = useState<AuditRequestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setRequestId(p.id));
  }, [params]);

  useEffect(() => {
    if (!requestId) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const load = async () => {
      try {
        const response = await fetch(`/api/audit-request/${requestId}`);
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? 'Failed to load audit');
        }
        const body = (await response.json()) as AuditRequestResponse;
        if (!cancelled) {
          setData(body);
          if (body.status === 'pending' || body.status === 'processing') {
            if (!interval) {
              interval = setInterval(() => void load(), 5000);
            }
          } else if (interval) {
            clearInterval(interval);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit');
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [requestId]);

  const title = data?.businessName ?? data?.websiteUrl ?? 'Your website audit';

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <header className="space-y-2 border-b border-slate-800 pb-6">
          <p className="text-sm text-emerald-400 font-medium">Free website audit</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          {data?.websiteUrl && (
            <a
              href={data.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-emerald-400"
            >
              {data.websiteUrl}
            </a>
          )}
        </header>

        {error && (
          <p className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </p>
        )}

        {!data && !error && <p className="text-slate-500">Loading your audit…</p>}

        {data && <StatusBanner status={data.status} />}

        {data?.status === 'completed' && data.reportSummary && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Your report</h2>
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 whitespace-pre-wrap text-slate-300 leading-relaxed text-sm sm:text-base">
              {data.reportSummary}
            </div>
          </section>
        )}

        {data?.findings && data.findings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Key findings</h2>
            <ul className="space-y-3">
              {data.findings.map((f, i) => (
                <li
                  key={`${f.title}-${i}`}
                  className="p-4 rounded-lg border border-slate-800 bg-slate-900/30 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-xs text-slate-500 uppercase">{f.category}</span>
                  </div>
                  <p className="font-medium text-white">{f.title}</p>
                  <p className="text-sm text-slate-400">{f.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data?.researchUrl && data.status === 'completed' && (
          <p className="text-sm text-slate-400">
            Want the full technical breakdown?{' '}
            <Link href={data.researchUrl} className="text-emerald-400 hover:underline">
              View detailed research report
            </Link>
          </p>
        )}

        <p className="text-sm text-slate-500 pt-4">
          <Link href="/" className="text-emerald-400 hover:underline">
            ← Back to SynapseCRO
          </Link>
        </p>
      </div>
    </main>
  );
}
