'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ReportSkeleton } from '@/components/LoadingSkeleton';
import { PageSpeedPanel } from '@/components/PageSpeedPanel';
import { scoreLabel } from '@/lib/audit/score';

interface AuditFinding {
  severity: string;
  title: string;
  description: string;
  category: string;
}

interface AuditRequestResponse {
  id: string;
  status: string;
  reportSummary: string | null;
  errorMessage?: string | null;
  websiteUrl: string;
  businessName: string | null;
  auditId: string | null;
  researchUrl: string | null;
  score: number | null;
  findings: AuditFinding[];
  competitors: Array<{ rank_position: number; business_name: string; url: string }>;
  socialProfiles: Array<{
    platform_id: string;
    platform_name: string;
    status: string;
    profile_url: string | null;
  }>;
  addedToPipeline?: boolean;
  pageSpeed?: {
    url: string;
    strategy: string;
    performanceScore: number | null;
    lcpMs: number | null;
    cls: number | null;
    inpMs: number | null;
    skipped: boolean;
    reason?: string;
  } | null;
  createdAt: string;
}

const PROGRESS_STEPS = [
  { key: 'scan', label: 'Scanning your site…' },
  { key: 'competitors', label: 'Checking competitors…' },
  { key: 'social', label: 'Analyzing social profiles…' },
  { key: 'report', label: 'Writing your report…' },
] as const;

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === 'critical'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : severity === 'warning'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-slate-500/15 text-slate-300 border-slate-500/30';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border capitalize ${styles}`}>
      {severity}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const { label, tone } = scoreLabel(score);
  const ringColor =
    tone === 'good' ? 'text-emerald-400' : tone === 'fair' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div
        className={`relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 ${ringColor} border-current bg-slate-900/60`}
        role="img"
        aria-label={`Website health score ${score} out of 100`}
      >
        <span className="text-3xl font-bold text-white tabular-nums">{score}</span>
      </div>
      <div className="text-center sm:text-left">
        <p className="text-sm text-slate-400 uppercase tracking-wide">Website health score</p>
        <p className="text-lg font-semibold text-white">{label}</p>
        <p className="text-sm text-slate-400 mt-1">Based on SEO, messaging, and online presence checks</p>
      </div>
    </div>
  );
}

function AuditProgress({ status, createdAt }: { status: string; createdAt: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const update = () => {
      const elapsedMs = Date.now() - new Date(createdAt).getTime();
      setActiveIndex(Math.min(PROGRESS_STEPS.length - 1, Math.floor(elapsedMs / 25000)));
    };
    update();
    const timer = setInterval(update, 5000);
    return () => clearInterval(timer);
  }, [createdAt]);

  return (
    <div className="p-5 sm:p-6 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-5">
      <div className="flex items-center gap-2 text-blue-200">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
        <p className="font-medium">
          {status === 'pending' ? 'Your audit is queued…' : 'Your audit is running…'}
        </p>
      </div>
      <ol className="space-y-3" aria-label="Audit progress">
        {PROGRESS_STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  isDone
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : isActive
                      ? 'bg-blue-500/20 border-blue-400/50 text-blue-200 animate-pulse'
                      : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
                aria-hidden="true"
              >
                {isDone ? '✓' : index + 1}
              </span>
              <span className={isActive || isDone ? 'text-slate-200' : 'text-slate-500'}>{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-blue-200/70">This page refreshes automatically. Usually takes 1–3 minutes.</p>
    </div>
  );
}

function FindingsSection({ findings }: { findings: AuditFinding[] }) {
  const grouped = useMemo(() => {
    const order = ['critical', 'warning', 'info'] as const;
    return order
      .map((severity) => ({
        severity,
        items: findings.filter((f) => f.severity === severity),
      }))
      .filter((g) => g.items.length > 0);
  }, [findings]);

  if (findings.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-white">What we found</h2>
      {grouped.map(({ severity, items }) => (
        <div key={severity} className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 capitalize">{severity} issues</h3>
          <ul className="space-y-3">
            {items.map((f, i) => (
              <li
                key={`${f.title}-${i}`}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={f.severity} />
                  <span className="text-xs text-slate-500 uppercase">{f.category}</span>
                </div>
                <p className="font-medium text-white">{f.title}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function SeoIssuesSection({ findings }: { findings: AuditFinding[] }) {
  const seoFindings = findings.filter((f) => f.category === 'seo' || f.category === 'technical');
  if (seoFindings.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">SEO &amp; technical issues</h2>
      <ul className="space-y-2">
        {seoFindings.slice(0, 5).map((f, i) => (
          <li key={i} className="flex gap-3 text-sm p-3 rounded-lg border border-slate-800 bg-slate-900/30">
            <SeverityBadge severity={f.severity} />
            <div>
              <p className="font-medium text-slate-200">{f.title}</p>
              <p className="text-slate-500 mt-0.5">{f.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
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
  const isRunning = data?.status === 'pending' || data?.status === 'processing';
  const socialFound = data?.socialProfiles.filter((p) => p.status === 'found').length ?? 0;
  const socialTotal = data?.socialProfiles.length ?? 0;

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <header className="space-y-2 border-b border-slate-800 pb-6">
          <p className="text-sm text-emerald-400 font-medium">Free website audit</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          {data?.websiteUrl && (
            <a
              href={data.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-emerald-400 break-all"
            >
              {data.websiteUrl}
            </a>
          )}
        </header>

        {error && (
          <p className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm" role="alert">
            {error}
          </p>
        )}

        {!data && !error && <ReportSkeleton />}

        {data && isRunning && <AuditProgress status={data.status} createdAt={data.createdAt} />}

        {data?.status === 'failed' && (
          <div className="p-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 space-y-2">
            <p className="font-medium">We couldn&apos;t complete your audit</p>
            {data.errorMessage && (
              <p className="text-sm text-red-200/80">{data.errorMessage}</p>
            )}
            <p className="text-sm">
              <Link href="/" className="underline hover:text-red-100">
                Request another free audit
              </Link>
            </p>
          </div>
        )}

        {data?.status === 'completed' && (
          <>
            {data.addedToPipeline && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
                <p className="font-medium">Added to your pipeline</p>
                <p className="text-sm text-emerald-200/80 mt-1">
                  This business is now tracked as a lead in SynapseCRO.{' '}
                  <Link href="/leads" className="underline hover:text-emerald-100">
                    View leads
                  </Link>
                </p>
              </div>
            )}

            {data.score !== null && (
              <section className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/40">
                <ScoreRing score={data.score} />
              </section>
            )}

            {data.reportSummary && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Executive summary</h2>
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 whitespace-pre-wrap text-slate-300 leading-relaxed text-sm sm:text-base">
                  {data.reportSummary}
                </div>
              </section>
            )}

            <FindingsSection findings={data.findings ?? []} />
            <SeoIssuesSection findings={data.findings ?? []} />

            {data.pageSpeed && !data.pageSpeed.skipped && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Core Web Vitals</h2>
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                  <PageSpeedPanel pageSpeed={data.pageSpeed} />
                </div>
              </section>
            )}

            {data.competitors && data.competitors.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Who you&apos;re up against</h2>
                <p className="text-sm text-slate-400">
                  Top competitors ranking for similar searches in your area:
                </p>
                <ul className="rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
                  {data.competitors.map((c) => (
                    <li key={c.url} className="px-4 py-3 flex items-center gap-3 text-sm bg-slate-900/30">
                      <span className="text-slate-500 font-mono text-xs w-8">#{c.rank_position}</span>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline truncate"
                      >
                        {c.business_name}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {socialTotal > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Social &amp; directory presence</h2>
                <p className="text-sm text-slate-400">
                  Found {socialFound} of {socialTotal} profiles we checked.
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.socialProfiles.map((p) => (
                    <li
                      key={p.platform_id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-800 bg-slate-900/30 text-sm"
                    >
                      <span className="text-slate-300">{p.platform_name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded border capitalize ${
                          p.status === 'found'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
                        }`}
                      >
                        {p.status === 'found' ? 'Found' : 'Missing'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="p-5 sm:p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-3">
              <h2 className="text-lg font-semibold text-emerald-200">Want us to fix this?</h2>
              <p className="text-sm text-emerald-100/90 leading-relaxed">
                SynapseCRO can improve your landing page, fix SEO issues, and even open GitHub pull requests
                with suggested changes — automatically.
              </p>
              <p className="text-sm">
                <a
                  href="mailto:hello@synapsecro.com?subject=Help%20with%20my%20website%20audit"
                  className="inline-flex min-h-11 items-center px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                >
                  Contact us to get started
                </a>
              </p>
            </section>

            {data.researchUrl && (
              <p className="text-sm text-slate-400">
                Want the full technical breakdown?{' '}
                <Link href={data.researchUrl} className="text-emerald-400 hover:underline">
                  View detailed research report
                </Link>
              </p>
            )}
          </>
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
