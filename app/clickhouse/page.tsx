'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';

interface ShowcaseData {
  architecture: { sensory: string; cognitive: string; motor: string; evals: string };
  scale: {
    analyticsEventCount: number;
    seoInsightEventCount: number;
    agentLoopEventCount: number;
    llmEvalEventCount: number;
    hourlyAggRows: number;
    distinctAudits: number;
    distinctLeads: number;
  };
  conversion: {
    pageViews: number;
    ctaClicks: number;
    conversionRate: number | null;
    dailyTrend: Array<{ day: string; pageViews: number; ctaClicks: number; conversionRate: number | null }>;
  };
  seo: {
    persistentFindings: Array<{
      title: string;
      severity: string;
      daysPersisting: number;
      auditCount: number;
    }>;
    rankTrajectory: Array<{
      completedAt: string;
      rankPosition: number | null;
      lcpMs: number | null;
      criticalCount: number;
      businessName: string;
    }>;
    categoryHeatmap: Array<{ week: string; category: string; critical: number; warning: number }>;
  };
  agentLoop: Array<{ loopType: string; createdAt: string; metricsSnapshot: Record<string, unknown> }>;
  langfuse: {
    configured: boolean;
    evalAggregates: Array<{ traceName: string; scoreName: string; avgValue: number; count: number }>;
  };
  queryTimings: Array<{ name: string; elapsedMs: number; rowCount: number }>;
  promptPreview: { trendSummary: string | null; promptBlock: string };
  postgresPainPoints: string[];
}

function MiniBarChart({
  rows,
  valueKey,
}: {
  rows: Array<{ day: string; pageViews: number; ctaClicks: number }>;
  valueKey: 'pageViews' | 'ctaClicks';
}) {
  const max = Math.max(...rows.map((r) => r[valueKey]), 1);
  return (
    <div className="flex items-end gap-0.5 h-24">
      {rows.slice(-21).map((row) => {
        const h = Math.max(4, (row[valueKey] / max) * 100);
        return (
          <div
            key={row.day}
            title={`${row.day}: ${row[valueKey]}`}
            className="flex-1 bg-teal-500/70 rounded-t-sm min-w-[3px]"
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

export default function ClickHouseShowcasePage() {
  const [data, setData] = useState<ShowcaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/clickhouse/showcase');
      if (!res.ok) throw new Error('ClickHouse not configured');
      setData((await res.json()) as ShowcaseData);
      setError(null);
    } catch {
      setError('ClickHouse showcase unavailable — set CLICKHOUSE_* env vars.');
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="flex-1">
      <PageContainer className="py-10 sm:py-14 space-y-10 max-w-5xl">
        <header className="space-y-3 border-b border-white/[0.06] pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              ClickHouse agent memory
            </h1>
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-200 border border-yellow-500/20">
              Hackathon showcase
            </span>
          </div>
          <p className="text-zinc-400 max-w-2xl">
            SynapseCRO uses ClickHouse as the autonomous agent&apos;s long-term memory — not just event storage.
          </p>
          <Link href="/dashboard" className="text-sm text-teal-400 hover:text-teal-300">
            ← Back to dashboard
          </Link>
        </header>

        {error && <SurfaceCard className="p-5 text-zinc-400 text-sm">{error}</SurfaceCard>}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(['sensory', 'cognitive', 'motor', 'evals'] as const).map((key) => (
                <SurfaceCard key={key} className="p-5 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-yellow-400/80">{key}</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{data.architecture[key]}</p>
                </SurfaceCard>
              ))}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Scale</h2>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['Analytics events', data.scale.analyticsEventCount],
                  ['SEO insight rows', data.scale.seoInsightEventCount],
                  ['Agent loop events', data.scale.agentLoopEventCount],
                  ['LLM eval events', data.scale.llmEvalEventCount],
                  ['Hourly MV rows', data.scale.hourlyAggRows],
                  ['Audits', data.scale.distinctAudits],
                  ['Leads', data.scale.distinctLeads],
                ].map(([label, value]) => (
                  <SurfaceCard key={label as string} className="p-4">
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p className="text-xl font-semibold text-white tabular-nums">
                      {Number(value).toLocaleString()}
                    </p>
                  </SurfaceCard>
                ))}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <SurfaceCard className="p-5 sm:p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Daily conversion (30d)</h2>
                <MiniBarChart rows={data.conversion.dailyTrend} valueKey="pageViews" />
                <p className="text-sm text-zinc-400 tabular-nums">
                  {data.conversion.pageViews} views · {data.conversion.ctaClicks} clicks ·{' '}
                  {data.conversion.conversionRate ?? '—'}% CVR
                </p>
              </SurfaceCard>

              <SurfaceCard className="p-5 sm:p-6 space-y-4">
                <h2 className="text-lg font-semibold text-white">Query timings (live)</h2>
                <ul className="space-y-2 text-sm">
                  {data.queryTimings.map((q) => (
                    <li key={q.name} className="flex justify-between gap-3 text-zinc-400">
                      <span className="font-mono text-xs text-zinc-500">{q.name}</span>
                      <span className="text-teal-400 tabular-nums">
                        {q.elapsedMs >= 0 ? `${q.elapsedMs}ms` : 'err'} · {q.rowCount} rows
                      </span>
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            </section>

            {data.seo.persistentFindings.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">
                  Issues persisting across re-audits
                </h2>
                <SurfaceCard className="p-5 sm:p-6">
                  <ul className="space-y-3 text-sm">
                    {data.seo.persistentFindings.map((f) => (
                      <li key={f.title} className="flex justify-between gap-4">
                        <span className="text-zinc-300">
                          <span className={f.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}>
                            [{f.severity}]
                          </span>{' '}
                          {f.title}
                        </span>
                        <span className="text-zinc-500 tabular-nums shrink-0">
                          {f.daysPersisting}d · {f.auditCount} audits
                        </span>
                      </li>
                    ))}
                  </ul>
                </SurfaceCard>
              </section>
            )}

            {data.seo.rankTrajectory.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">Rank + LCP trajectory</h2>
                <SurfaceCard className="p-5 sm:p-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-zinc-500 text-left">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Rank</th>
                        <th className="pb-2">LCP</th>
                        <th className="pb-2">Critical</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.seo.rankTrajectory.map((row) => (
                        <tr key={row.completedAt} className="border-t border-white/[0.04] text-zinc-300">
                          <td className="py-2 tabular-nums">{row.completedAt.slice(0, 10)}</td>
                          <td className="py-2">#{row.rankPosition ?? '—'}</td>
                          <td className="py-2">{row.lcpMs ? `${row.lcpMs}ms` : '—'}</td>
                          <td className="py-2">{row.criticalCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SurfaceCard>
              </section>
            )}

            {data.promptPreview.trendSummary && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">LLM prompt memory block</h2>
                <SurfaceCard className="p-5 sm:p-6 space-y-3">
                  <p className="text-violet-200 font-medium">{data.promptPreview.trendSummary}</p>
                  <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                    {data.promptPreview.promptBlock}
                  </pre>
                </SurfaceCard>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-white mb-4">
                Langfuse evals
                <span
                  className={`ml-2 text-xs font-normal px-2 py-0.5 rounded ${
                    data.langfuse.configured
                      ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                      : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                  }`}
                >
                  {data.langfuse.configured ? 'connected' : 'set LANGFUSE_* keys'}
                </span>
              </h2>
              <SurfaceCard className="p-5 sm:p-6 space-y-3">
                <p className="text-sm text-zinc-400">
                  Every optimize + audit ingest is traced in Langfuse (ClickHouse&apos;s LLM observability stack)
                  and mirrored to <code className="text-zinc-300">llm_eval_events</code> for SQL aggregates.
                </p>
                {data.langfuse.evalAggregates.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-zinc-500 border-b border-white/[0.06]">
                          <th className="pb-2 pr-4 font-medium">Trace</th>
                          <th className="pb-2 pr-4 font-medium">Score</th>
                          <th className="pb-2 pr-4 font-medium">Avg</th>
                          <th className="pb-2 font-medium">N</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.langfuse.evalAggregates.map((row) => (
                          <tr key={`${row.traceName}-${row.scoreName}`} className="border-b border-white/[0.04]">
                            <td className="py-2 pr-4 text-zinc-300 font-mono text-xs">{row.traceName}</td>
                            <td className="py-2 pr-4 text-zinc-400">{row.scoreName}</td>
                            <td className="py-2 pr-4 text-white tabular-nums">{row.avgValue}</td>
                            <td className="py-2 text-zinc-500 tabular-nums">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No eval rows yet — run optimize or an audit.</p>
                )}
              </SurfaceCard>
            </section>

            {data.agentLoop.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-white mb-4">Closed-loop agent timeline</h2>
                <SurfaceCard className="p-5 sm:p-6 space-y-2">
                  {data.agentLoop.map((e) => (
                    <div
                      key={e.createdAt + e.loopType}
                      className="flex justify-between gap-3 text-sm border-b border-white/[0.04] pb-2 last:border-0"
                    >
                      <span className="text-zinc-300 capitalize">{e.loopType.replace('_', ' ')}</span>
                      <span className="text-zinc-500 tabular-nums text-xs">{e.createdAt.slice(0, 19)}</span>
                    </div>
                  ))}
                </SurfaceCard>
              </section>
            )}

            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Why not Postgres?</h2>
              <SurfaceCard className="p-5 sm:p-6">
                <ul className="list-disc list-inside space-y-2 text-sm text-zinc-400">
                  {data.postgresPainPoints.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </SurfaceCard>
            </section>
          </>
        )}
      </PageContainer>
    </main>
  );
}
