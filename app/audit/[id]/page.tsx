'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ReportSkeleton } from '@/components/LoadingSkeleton';
import { PageSpeedPanel } from '@/components/PageSpeedPanel';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
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
  { key: 'scan', label: 'Scanning your site' },
  { key: 'competitors', label: 'Checking nearby competitors' },
  { key: 'social', label: 'Reviewing directory profiles' },
  { key: 'report', label: 'Preparing your report' },
] as const;

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === 'critical'
      ? 'bg-red-500/10 text-red-300 border-red-500/25'
      : severity === 'warning'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
        : 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border capitalize ${styles}`}>
      {severity}
    </span>
  );
}

function ScoreRing({ score }: { score: number }) {
  const { label, tone } = scoreLabel(score);
  const ringColor =
    tone === 'good' ? 'text-teal-400' : tone === 'fair' ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div
        className={`relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 ${ringColor} border-current bg-zinc-950/60`}
        role="img"
        aria-label={`Website health score ${score} out of 100`}
      >
        <span className="text-3xl font-semibold text-white tabular-nums">{score}</span>
      </div>
      <div className="text-center sm:text-left">
        <p className="text-sm text-zinc-400">Website health score</p>
        <p className="text-lg font-semibold text-white">{label}</p>
        <p className="text-sm text-zinc-400 mt-1">Based on SEO, messaging, and online presence</p>
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
    <SurfaceCard className="p-5 sm:p-6 space-y-5 border-teal-500/20 bg-teal-500/[0.03]">
      <div className="flex items-center gap-2 text-teal-200">
        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" aria-hidden="true" />
        <p className="font-medium">
          {status === 'pending' ? 'Queued' : 'Running your audit'}
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
                    ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                    : isActive
                      ? 'bg-teal-500/15 border-teal-400/40 text-teal-200'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-500'
                }`}
                aria-hidden="true"
              >
                {isDone ? '✓' : index + 1}
              </span>
              <span className={isActive || isDone ? 'text-zinc-200' : 'text-zinc-500'}>{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-zinc-400">This page refreshes automatically. Usually takes 1–3 minutes.</p>
    </SurfaceCard>
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
      <h2 className="text-lg font-semibold text-white">Findings</h2>
      {grouped.map(({ severity, items }) => (
        <div key={severity} className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-400 capitalize">{severity}</h3>
          <ul className="space-y-3">
            {items.map((f, i) => (
              <li key={`${f.title}-${i}`}>
                <SurfaceCard className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-xs text-zinc-500 uppercase">{f.category}</span>
                  </div>
                  <p className="font-medium text-white">{f.title}</p>
                  <p className="text-sm text-zinc-400 leading-relaxed">{f.description}</p>
                </SurfaceCard>
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
      <h2 className="text-lg font-semibold text-white">SEO &amp; technical</h2>
      <ul className="space-y-2">
        {seoFindings.slice(0, 5).map((f, i) => (
          <li key={i}>
            <SurfaceCard className="flex gap-3 text-sm p-3">
              <SeverityBadge severity={f.severity} />
              <div>
                <p className="font-medium text-zinc-200">{f.title}</p>
                <p className="text-zinc-500 mt-0.5">{f.description}</p>
              </div>
            </SurfaceCard>
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

  const title = data?.businessName ?? data?.websiteUrl ?? 'Website audit';
  const isRunning = data?.status === 'pending' || data?.status === 'processing';
  const socialFound = data?.socialProfiles.filter((p) => p.status === 'found').length ?? 0;
  const socialTotal = data?.socialProfiles.length ?? 0;

  return (
    <main className="flex-1">
      <PageContainer narrow className="py-10 sm:py-14 space-y-8">
        <header className="space-y-2 border-b border-white/[0.06] pb-6">
          <p className="text-sm text-teal-400 font-medium">Free website audit</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
          {data?.websiteUrl && (
            <a
              href={data.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 hover:text-teal-400 break-all"
            >
              {data.websiteUrl}
            </a>
          )}
        </header>

        {error && (
          <p className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm" role="alert">
            {error}
          </p>
        )}

        {!data && !error && <ReportSkeleton />}

        {data && isRunning && <AuditProgress status={data.status} createdAt={data.createdAt} />}

        {data?.status === 'failed' && (
          <SurfaceCard className="p-5 border-red-500/25 bg-red-500/[0.03] text-red-200 space-y-2">
            <p className="font-medium">We couldn&apos;t finish this audit</p>
            {data.errorMessage && (
              <p className="text-sm text-red-200/80">{data.errorMessage}</p>
            )}
            <p className="text-sm">
              <Link href="/" className="text-teal-400 hover:underline">
                Request another audit
              </Link>
            </p>
          </SurfaceCard>
        )}

        {data?.status === 'completed' && (
          <>
            {data.addedToPipeline && (
              <SurfaceCard className="p-4 border-teal-500/25 bg-teal-500/[0.03] text-teal-200">
                <p className="font-medium">Added to leads</p>
                <p className="text-sm text-teal-200/80 mt-1">
                  This business is now in your lead list.{' '}
                  <Link href="/leads" className="text-teal-400 hover:underline">
                    View leads
                  </Link>
                </p>
              </SurfaceCard>
            )}

            {data.score !== null && (
              <SurfaceCard className="p-5 sm:p-6">
                <ScoreRing score={data.score} />
              </SurfaceCard>
            )}

            {data.reportSummary && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Summary</h2>
                <SurfaceCard className="p-5 whitespace-pre-wrap text-zinc-300 leading-relaxed text-sm sm:text-base">
                  {data.reportSummary}
                </SurfaceCard>
              </section>
            )}

            <FindingsSection findings={data.findings ?? []} />
            <SeoIssuesSection findings={data.findings ?? []} />

            {data.pageSpeed && !data.pageSpeed.skipped && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Page speed</h2>
                <SurfaceCard className="p-5">
                  <PageSpeedPanel pageSpeed={data.pageSpeed} />
                </SurfaceCard>
              </section>
            )}

            {data.competitors && data.competitors.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Nearby competitors</h2>
                <p className="text-sm text-zinc-400">
                  Who else shows up for similar searches in your area.
                </p>
                <SurfaceCard className="divide-y divide-white/[0.06] overflow-hidden">
                  {data.competitors.map((c) => (
                    <div key={c.url} className="px-4 py-3 flex items-center gap-3 text-sm">
                      <span className="text-zinc-500 font-mono text-xs w-8">#{c.rank_position}</span>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:underline truncate"
                      >
                        {c.business_name}
                      </a>
                    </div>
                  ))}
                </SurfaceCard>
              </section>
            )}

            {socialTotal > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Directory profiles</h2>
                <p className="text-sm text-zinc-400">
                  Found {socialFound} of {socialTotal} profiles we checked.
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {data.socialProfiles.map((p) => (
                    <li key={p.platform_id}>
                      <SurfaceCard className="flex items-center justify-between gap-2 p-3 text-sm">
                        <span className="text-zinc-300">{p.platform_name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-md border capitalize ${
                            p.status === 'found'
                              ? 'bg-teal-500/10 text-teal-300 border-teal-500/25'
                              : 'bg-white/[0.04] text-zinc-400 border-white/[0.08]'
                          }`}
                        >
                          {p.status === 'found' ? 'Found' : 'Missing'}
                        </span>
                      </SurfaceCard>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <SurfaceCard className="p-5 sm:p-6 space-y-3 border-teal-500/20 bg-teal-500/[0.03]">
              <h2 className="text-lg font-semibold text-teal-200">Need help fixing these?</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                We can update your landing page, address SEO issues, and open GitHub pull requests
                with suggested changes.
              </p>
              <a
                href="mailto:hello@synapsecro.com?subject=Help%20with%20my%20website%20audit"
                className="inline-flex min-h-11 items-center px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors"
              >
                Get in touch
              </a>
            </SurfaceCard>

            {data.researchUrl && (
              <p className="text-sm text-zinc-400">
                Full technical report:{' '}
                <Link href={data.researchUrl} className="text-teal-400 hover:underline">
                  View detailed audit
                </Link>
              </p>
            )}
          </>
        )}

        <p className="text-sm text-zinc-500 pt-4">
          <Link href="/" className="text-teal-400 hover:underline">
            ← Home
          </Link>
        </p>
      </PageContainer>
    </main>
  );
}
