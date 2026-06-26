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

function computeMetrics(events: { event_type: string }[]): Metrics {
  const pageViews = events.filter((e) => e.event_type === 'page_view').length;
  const ctaClicks = events.filter((e) => e.event_type === 'cta_click').length;
  const conversionRate = pageViews > 0 ? Math.round((ctaClicks / pageViews) * 100) : null;

  return { pageViews, ctaClicks, conversionRate };
}

function hasSupabaseConfig(): boolean {
  return createBrowserSupabaseClient() !== null;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<BrainLog[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    pageViews: 0,
    ctaClicks: 0,
    conversionRate: null,
  });
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(hasSupabaseConfig);
  const [isLoadingCost, setIsLoadingCost] = useState(true);
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

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    void supabase
      .from('analytics_events')
      .select('event_type')
      .then(({ data }: { data: { event_type: string }[] | null }) => {
        if (data) setMetrics(computeMetrics(data));
        setIsLoadingMetrics(false);
      });

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
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Activity dashboard</h1>
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
        </section>

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
