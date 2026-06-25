'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(hasSupabaseConfig);

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

  const hasActivity = metrics.pageViews > 0 || metrics.ctaClicks > 0;

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
