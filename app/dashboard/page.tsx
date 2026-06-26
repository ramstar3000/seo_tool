'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { CardGridSkeleton } from '@/components/LoadingSkeleton';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

interface BrainLog {
  id: string;
  thought_process: string;
  action_taken: string;
  created_at: string;
}

interface Metrics {
  pageViews: number;
  ctaClicks: number;
  conversionRate: number | null;
}

interface HourlyFunnelRow {
  hour: string;
  pageViews: number;
  ctaClicks: number;
  conversionRate: number | null;
}

interface AnalyticsMetricsResponse {
  source: 'clickhouse' | 'supabase';
  totals: Metrics;
  hourly: HourlyFunnelRow[];
}

interface ProviderSpendSummary {
  provider: string;
  spentUsd: number;
  capUsd: number | null;
  capped: boolean;
  warning: boolean;
  last7DaysUsd: number;
  callCount: number;
}

interface CostSummary {
  totalSpendUsd: number;
  globalCapUsd: number | null;
  globalCapped: boolean;
  globalWarning: boolean;
  llmSpendUsd: number;
  llmCapUsd: number;
  llmCapped: boolean;
  providers: ProviderSpendSummary[];
  last7DaysUsd: number;
}

interface SeoInsightMetrics {
  source: 'clickhouse' | 'none';
  auditCount: number;
  findingCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  byCategory: Array<{ category: string; critical: number; warning: number; info: number }>;
  recentFindings: Array<{ title: string; severity: string; category: string; completedAt: string }>;
  persistentFindings?: Array<{
    title: string;
    category: string;
    severity: string;
    auditCount: number;
    daysPersisting: number;
  }>;
}

interface ClickHouseShowcaseResponse {
  source: 'clickhouse';
  scale: {
    analyticsEventCount: number;
    seoInsightEventCount: number;
    distinctAudits: number;
    distinctLeads: number;
  };
  persistentFindings: Array<{
    title: string;
    severity: string;
    category: string;
    daysPersisting: number;
    auditCount: number;
  }>;
  promptPreview: {
    trendSummary: string | null;
    promptBlock: string;
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Gemini',
  anthropic: 'Anthropic',
  tavily: 'Tavily',
  firecrawl: 'Firecrawl',
  resend: 'Resend',
  pagespeed: 'PageSpeed',
  github: 'GitHub',
};

function formatUsd(value: number): string {
  return value < 0.01 && value > 0 ? '<$0.01' : `$${value.toFixed(2)}`;
}

function SpendBar({
  spentUsd,
  capUsd,
  capped,
  warning,
}: {
  spentUsd: number;
  capUsd: number | null;
  capped: boolean;
  warning: boolean;
}) {
  if (capUsd === null || capUsd <= 0) {
    return (
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full w-0 bg-teal-500/60" />
      </div>
    );
  }

  const pct = Math.min(100, (spentUsd / capUsd) * 100);
  const barColor = capped ? 'bg-red-500' : warning ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatHourLabel(isoHour: string): string {
  const date = new Date(isoHour);
  if (Number.isNaN(date.getTime())) return isoHour;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' });
}

function HourlyFunnelChart({ rows }: { rows: HourlyFunnelRow[] }) {
  if (rows.length === 0) return null;

  const maxViews = Math.max(...rows.map((row) => row.pageViews), 1);

  return (
    <div className="space-y-3">
      {rows.slice(-12).map((row) => {
        const widthPct = Math.max(4, (row.pageViews / maxViews) * 100);
        return (
          <div key={row.hour} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-3 text-sm">
            <span className="text-zinc-500 tabular-nums">{formatHourLabel(row.hour)}</span>
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-teal-500/80 transition-all duration-500"
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="text-zinc-400 tabular-nums text-right">
              {row.conversionRate === null ? '—' : `${row.conversionRate}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function hasSupabaseConfig(): boolean {
  return createBrowserSupabaseClient() !== null;
}

export const metadata = {
  title: 'Dashboard — SynapseCRO',
  description: 'Your activity dashboard for SynapseCRO, including visits, clicks, and recent agent logs.',
};

export default function Dashboard() {
  const [logs, setLogs] = useState<BrainLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    pageViews: 0,
    ctaClicks: 0,
    conversionRate: null,
  });
  const [metricsSource, setMetricsSource] = useState<'clickhouse' | 'supabase' | null>(null);
  const [hourlyFunnel, setHourlyFunnel] = useState<HourlyFunnelRow[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [seoInsights, setSeoInsights] = useState<SeoInsightMetrics | null>(null);
  const [clickhouseShowcase, setClickhouseShowcase] = useState<ClickHouseShowcaseResponse | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingCost, setIsLoadingCost] = useState(true);
  const [isLoadingSeoInsights, setIsLoadingSeoInsights] = useState(true);
  const [costError, setCostError] = useState<string | null>(null);

  const loadCostSummary = useCallback(async () => {
    setIsLoadingCost(true);
    setCostError(null);
    try {
      const response = await fetch('/api/cost/summary');
      if (response.status === 401) {
        setCostError('Sign in to view API spend.');
        return;
      }
      if (!response.ok) {
        setCostError('Could not load API spend.');
        return;
      }
      setCostSummary((await response.json()) as CostSummary);
    } catch {
      setCostError('Could not load API spend.');
    } finally {
      setIsLoadingCost(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const response = await fetch('/api/analytics/metrics');
      if (!response.ok) return;
      const data = (await response.json()) as AnalyticsMetricsResponse;
      setMetrics(data.totals);
      setMetricsSource(data.source);
      setHourlyFunnel(data.hourly);
    } catch {
      // Keep prior metrics on transient errors
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  const loadSeoInsights = useCallback(async () => {
    setIsLoadingSeoInsights(true);
    try {
      const response = await fetch('/api/seo/insights/metrics');
      if (!response.ok) {
        setSeoInsights(null);
        return;
      }
      setSeoInsights((await response.json()) as SeoInsightMetrics);
    } catch {
      setSeoInsights(null);
    } finally {
      setIsLoadingSeoInsights(false);
    }
  }, []);

  const loadShowcase = useCallback(async () => {
    try {
      const response = await fetch('/api/clickhouse/showcase');
      if (!response.ok) {
        setClickhouseShowcase(null);
        return;
      }
      setClickhouseShowcase((await response.json()) as ClickHouseShowcaseResponse);
    } catch {
      setClickhouseShowcase(null);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    void loadSeoInsights();
    void loadShowcase();
  }, [loadSeoInsights, loadShowcase]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    void supabase
      .from('agent_brain_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }: { data: BrainLog[] | null }) => {
        if (data) setLogs(data);
      });

    const channel = supabase
      .channel('dashboard_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_brain_logs' },
        (payload: { new: Record<string, unknown> }) => {
          setLogs((prev) => [payload.new as unknown as BrainLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    void loadCostSummary();
  }, [loadCostSummary]);

  const hasActivity = metrics.pageViews > 0 || metrics.ctaClicks > 0;
  const activeProviders =
    costSummary?.providers.filter((p) => p.spentUsd > 0 || p.callCount > 0) ?? [];
  const displayProviders =
    activeProviders.length > 0
      ? activeProviders
      : (costSummary?.providers.filter((p) => p.provider === 'gemini' || p.provider === 'tavily') ??
        []);

  return (
    <main className="flex-1">
      <PageContainer className="py-10 sm:py-14 space-y-10">
        <header className="space-y-2 border-b border-white/[0.06] pb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Activity dashboard</h1>
            {metricsSource === 'clickhouse' && (
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-200 border border-yellow-500/20">
                ClickHouse analytics
              </span>
            )}
            {metricsSource === 'clickhouse' && (
              <Link
                href="/clickhouse"
                className="text-xs font-medium px-2 py-1 rounded-md bg-yellow-500/5 text-yellow-300/90 border border-yellow-500/15 hover:bg-yellow-500/10 transition-colors"
              >
                Deep dive →
              </Link>
            )}
            {seoInsights?.source === 'clickhouse' && (
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-violet-500/10 text-violet-200 border border-violet-500/20">
                SEO insight memory
              </span>
            )}
          </div>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            Visits, button clicks, and recent copy updates.
          </p>
        </header>

        {/* Metrics */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="text-lg sm:text-xl font-semibold text-white mb-4">
            Your numbers at a glance
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {isLoadingMetrics ? (
              <CardGridSkeleton count={3} cols={3} />
            ) : (
              <>
            <SurfaceCard className="p-5 sm:p-6">
              <p className="text-sm text-zinc-400 mb-1">People who visited</p>
              <p className="text-3xl font-semibold text-white tabular-nums">{metrics.pageViews}</p>
            </SurfaceCard>
            <SurfaceCard className="p-5 sm:p-6">
              <p className="text-sm text-zinc-400 mb-1">Clicked main button</p>
              <p className="text-3xl font-semibold text-white tabular-nums">{metrics.ctaClicks}</p>
            </SurfaceCard>
            <SurfaceCard className="p-5 sm:p-6">
              <p className="text-sm text-zinc-400 mb-1">Conversion rate</p>
              <p className="text-3xl font-semibold text-white tabular-nums">
                {metrics.conversionRate === null ? '—' : `${metrics.conversionRate}%`}
              </p>
            </SurfaceCard>
              </>
            )}
          </div>

          {!isLoadingMetrics && !hasActivity && (
            <SurfaceCard className="mt-4 p-4 text-zinc-400 text-sm">
              No activity yet.{' '}
              <Link href="/" className="text-teal-400 underline underline-offset-2 hover:text-teal-300">
                Visit the homepage
              </Link>{' '}
              and click the main button to see numbers here.
            </SurfaceCard>
          )}

          {!isLoadingMetrics && hourlyFunnel.length > 0 && (
            <SurfaceCard className="mt-4 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-white">Hourly conversion funnel</h3>
                  <p className="text-xs text-zinc-500 mt-1">Last 7 days — aggregated in ClickHouse</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadMetrics()}
                  className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Refresh
                </button>
              </div>
              <HourlyFunnelChart rows={hourlyFunnel} />
            </SurfaceCard>
          )}
        </section>

        {/* SEO insight memory */}
        {!isLoadingSeoInsights && seoInsights?.source === 'clickhouse' && (
          <section aria-labelledby="seo-insights-heading">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 id="seo-insights-heading" className="text-lg sm:text-xl font-semibold text-white">
                SEO insight memory
              </h2>
              <button
                type="button"
                onClick={() => void loadSeoInsights()}
                className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                Refresh
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-4 mb-4">
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">Audits ingested</p>
                <p className="text-3xl font-semibold text-white tabular-nums">{seoInsights.auditCount}</p>
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">Findings tracked</p>
                <p className="text-3xl font-semibold text-white tabular-nums">{seoInsights.findingCount}</p>
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">Critical</p>
                <p className="text-3xl font-semibold text-red-300 tabular-nums">{seoInsights.criticalCount}</p>
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">Warnings</p>
                <p className="text-3xl font-semibold text-amber-300 tabular-nums">{seoInsights.warningCount}</p>
              </SurfaceCard>
            </div>
            {seoInsights.byCategory.length > 0 && (
              <SurfaceCard className="p-5 sm:p-6 space-y-4">
                <p className="text-sm font-medium text-zinc-300">Findings by category (30 days)</p>
                <div className="space-y-2">
                  {seoInsights.byCategory.map((row) => {
                    const total = row.critical + row.warning + row.info;
                    return (
                      <div key={row.category} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-300 capitalize">{row.category}</span>
                        <span className="text-zinc-500 tabular-nums">
                          {total} total
                          {row.critical > 0 && (
                            <span className="text-red-400 ml-2">{row.critical} critical</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SurfaceCard>
            )}
            {seoInsights.recentFindings.length > 0 && (
              <SurfaceCard className="mt-4 p-5 sm:p-6 space-y-3">
                <p className="text-sm font-medium text-zinc-300">Recent findings</p>
                <ul className="space-y-2 text-sm">
                  {seoInsights.recentFindings.slice(0, 5).map((finding, index) => (
                    <li key={`${finding.title}-${index}`} className="text-zinc-400">
                      <span
                        className={
                          finding.severity === 'critical'
                            ? 'text-red-400'
                            : finding.severity === 'warning'
                              ? 'text-amber-400'
                              : 'text-zinc-500'
                        }
                      >
                        [{finding.severity}]
                      </span>{' '}
                      {finding.title}
                      <span className="text-zinc-600 ml-2">· {finding.category}</span>
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            )}
            {(seoInsights.persistentFindings?.length ?? 0) > 0 && (
              <SurfaceCard className="mt-4 p-5 sm:p-6 space-y-3">
                <p className="text-sm font-medium text-zinc-300">Issues persisting across re-audits</p>
                <p className="text-xs text-zinc-500">ClickHouse dateDiff + count(DISTINCT audit_id)</p>
                <ul className="space-y-2 text-sm">
                  {seoInsights.persistentFindings!.map((finding) => (
                    <li key={finding.title} className="flex justify-between gap-3 text-zinc-400">
                      <span>
                        <span className={finding.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}>
                          [{finding.severity}]
                        </span>{' '}
                        {finding.title}
                      </span>
                      <span className="text-zinc-500 tabular-nums shrink-0">
                        {finding.daysPersisting}d · {finding.auditCount} audits
                      </span>
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            )}
          </section>
        )}

        {clickhouseShowcase && (
          <section aria-labelledby="ch-showcase-heading">
            <h2 id="ch-showcase-heading" className="text-lg sm:text-xl font-semibold text-white mb-4">
              ClickHouse agent memory
            </h2>
            <div className="grid gap-4 sm:grid-cols-4 mb-4">
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">Analytics events</p>
                <p className="text-2xl font-semibold text-white tabular-nums">
                  {clickhouseShowcase.scale.analyticsEventCount.toLocaleString()}
                </p>
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">SEO insight rows</p>
                <p className="text-2xl font-semibold text-white tabular-nums">
                  {clickhouseShowcase.scale.seoInsightEventCount.toLocaleString()}
                </p>
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">Audits tracked</p>
                <p className="text-2xl font-semibold text-white tabular-nums">
                  {clickhouseShowcase.scale.distinctAudits}
                </p>
              </SurfaceCard>
              <SurfaceCard className="p-5 sm:p-6">
                <p className="text-sm text-zinc-400 mb-1">Leads tracked</p>
                <p className="text-2xl font-semibold text-white tabular-nums">
                  {clickhouseShowcase.scale.distinctLeads}
                </p>
              </SurfaceCard>
            </div>
            {clickhouseShowcase.promptPreview.trendSummary && (
              <SurfaceCard className="p-5 sm:p-6 space-y-2">
                <p className="text-sm font-medium text-violet-200">LLM prompt context (aggregated)</p>
                <p className="text-sm text-zinc-300">{clickhouseShowcase.promptPreview.trendSummary}</p>
                <p className="text-xs text-zinc-500 mt-2">
                  Full block feeds GitHub PR + CRO optimize —{' '}
                  <code className="text-teal-400">GET /api/seo/insights</code>
                </p>
              </SurfaceCard>
            )}
          </section>
        )}

        {/* API spend */}
        <section aria-labelledby="cost-heading">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 id="cost-heading" className="text-lg sm:text-xl font-semibold text-white">
              API spend
            </h2>
            <button
              type="button"
              onClick={() => void loadCostSummary()}
              disabled={isLoadingCost}
              className="text-sm text-teal-400 hover:text-teal-300 disabled:opacity-50 transition-colors"
            >
              Refresh
            </button>
          </div>

          {isLoadingCost ? (
            <CardGridSkeleton count={2} cols={2} />
          ) : costError ? (
            <SurfaceCard className="p-5 text-zinc-400 text-sm">{costError}</SurfaceCard>
          ) : costSummary ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <SurfaceCard className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-400 mb-1">LLM spend (Gemini cap)</p>
                      <p className="text-2xl font-semibold text-white tabular-nums">
                        {formatUsd(costSummary.llmSpendUsd)}
                        <span className="text-base text-zinc-500 font-normal">
                          {' '}
                          / {formatUsd(costSummary.llmCapUsd)}
                        </span>
                      </p>
                    </div>
                    {costSummary.llmCapped && (
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-red-500/15 text-red-300 border border-red-500/25">
                        Capped
                      </span>
                    )}
                    {!costSummary.llmCapped && costSummary.llmSpendUsd >= costSummary.llmCapUsd * 0.8 && (
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        Warning
                      </span>
                    )}
                  </div>
                  <SpendBar
                    spentUsd={costSummary.llmSpendUsd}
                    capUsd={costSummary.llmCapUsd}
                    capped={costSummary.llmCapped}
                    warning={costSummary.llmSpendUsd >= costSummary.llmCapUsd * 0.8}
                  />
                  <p className="text-xs text-zinc-500">
                    Last 7 days: {formatUsd(costSummary.last7DaysUsd)} total across all APIs
                  </p>
                </SurfaceCard>

                <SurfaceCard className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-400 mb-1">Total API spend</p>
                      <p className="text-2xl font-semibold text-white tabular-nums">
                        {formatUsd(costSummary.totalSpendUsd)}
                        {costSummary.globalCapUsd !== null && (
                          <span className="text-base text-zinc-500 font-normal">
                            {' '}
                            / {formatUsd(costSummary.globalCapUsd)}
                          </span>
                        )}
                      </p>
                    </div>
                    {costSummary.globalCapped && (
                      <span className="text-xs font-medium px-2 py-1 rounded-md bg-red-500/15 text-red-300 border border-red-500/25">
                        Capped
                      </span>
                    )}
                  </div>
                  {costSummary.globalCapUsd !== null ? (
                    <SpendBar
                      spentUsd={costSummary.totalSpendUsd}
                      capUsd={costSummary.globalCapUsd}
                      capped={costSummary.globalCapped}
                      warning={costSummary.globalWarning}
                    />
                  ) : (
                    <p className="text-xs text-zinc-500">No global cap set</p>
                  )}
                </SurfaceCard>
              </div>

              <SurfaceCard className="p-5 sm:p-6 space-y-4">
                <p className="text-sm font-medium text-zinc-300">Per provider</p>
                <div className="space-y-3">
                  {displayProviders.map((provider) => (
                    <div key={provider.provider} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-zinc-300">
                          {PROVIDER_LABELS[provider.provider] ?? provider.provider}
                          {provider.callCount > 0 && (
                            <span className="text-zinc-500 ml-2">{provider.callCount} calls</span>
                          )}
                        </span>
                        <span className="text-zinc-400 tabular-nums">
                          {formatUsd(provider.spentUsd)}
                          {provider.capUsd !== null && (
                            <span className="text-zinc-600"> / {formatUsd(provider.capUsd)}</span>
                          )}
                          {provider.capped && (
                            <span className="ml-2 text-red-400 text-xs">capped</span>
                          )}
                        </span>
                      </div>
                      <SpendBar
                        spentUsd={provider.spentUsd}
                        capUsd={provider.capUsd}
                        capped={provider.capped}
                        warning={provider.warning}
                      />
                    </div>
                  ))}
                </div>
              </SurfaceCard>
            </div>
          ) : null}
        </section>

        {/* Activity log */}
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-lg sm:text-xl font-semibold text-white mb-4">
            Recent page updates
          </h2>
          <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1 sm:pr-2">
            {logs.length === 0 ? (
              <SurfaceCard className="p-6 sm:p-8 text-center space-y-3 border-dashed">
                <p className="text-zinc-300 font-medium">No updates yet</p>
                <p className="text-zinc-500 text-sm max-w-md mx-auto leading-relaxed">
                  When SynapseCRO adjusts your homepage copy, the reason and change will appear here.
                </p>
                <Link
                  href="/"
                  className="inline-flex min-h-10 items-center justify-center mt-2 px-5 rounded-xl bg-teal-600/15 text-teal-300 font-medium border border-teal-500/25 hover:bg-teal-500/25 transition-colors"
                >
                  Go to homepage
                </Link>
              </SurfaceCard>
            ) : (
              logs.map((log) => (
                <SurfaceCard key={log.id} className="p-5 sm:p-6 space-y-3">
                  <time
                    dateTime={log.created_at}
                    className="text-xs sm:text-sm text-zinc-500 block"
                  >
                    {new Date(log.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-400 mb-1">Observation</h3>
                    <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">{log.thought_process}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-teal-400/90 mb-1">Change made</h3>
                    <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">{log.action_taken}</p>
                  </div>
                </SurfaceCard>
              ))
            )}
          </div>
        </section>
      </PageContainer>
    </main>
  );
}
