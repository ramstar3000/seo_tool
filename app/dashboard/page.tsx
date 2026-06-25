'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        <header className="space-y-3 border-b border-slate-800 pb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Activity dashboard</h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl leading-relaxed">
            See how people use your landing page — visits, button clicks, and recent updates SynapseCRO
            has made to your copy.
          </p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            ← Back to homepage
          </Link>
        </header>

        {/* Metrics */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="text-lg sm:text-xl font-semibold text-white mb-4">
            Your numbers at a glance
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/50">
              <p className="text-sm font-medium text-slate-400 mb-1">People who visited</p>
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
                {isLoadingMetrics ? '…' : metrics.pageViews}
              </p>
            </article>
            <article className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/50">
              <p className="text-sm font-medium text-slate-400 mb-1">Clicked Get Started</p>
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
                {isLoadingMetrics ? '…' : metrics.ctaClicks}
              </p>
            </article>
            <article className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/50">
              <p className="text-sm font-medium text-slate-400 mb-1">Conversion rate</p>
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
                {isLoadingMetrics
                  ? '…'
                  : metrics.conversionRate === null
                    ? '—'
                    : `${metrics.conversionRate}%`}
              </p>
              {!isLoadingMetrics && metrics.conversionRate !== null && (
                <p className="text-xs text-slate-500 mt-2">Clicks divided by visits</p>
              )}
            </article>
          </div>

          {!isLoadingMetrics && !hasActivity && (
            <p className="mt-4 p-4 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 text-sm sm:text-base">
              No activity yet.{' '}
              <Link href="/" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
                Visit the homepage
              </Link>{' '}
              and click the main button to see numbers appear here.
            </p>
          )}
        </section>

        {/* Activity log */}
        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="text-lg sm:text-xl font-semibold text-white mb-4">
            Recent page updates
          </h2>
          <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1 sm:pr-2">
            {logs.length === 0 ? (
              <div className="p-6 sm:p-8 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-center space-y-3">
                <p className="text-slate-300 font-medium">No updates logged yet</p>
                <p className="text-slate-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                  Visit the homepage and click the button to generate activity. When SynapseCRO improves
                  your page, the reason and change will show up here.
                </p>
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center justify-center mt-2 px-5 py-2.5 rounded-lg bg-emerald-500/15 text-emerald-300 font-medium border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors"
                >
                  Go to homepage
                </Link>
              </div>
            ) : (
              logs.map((log) => (
                <article
                  key={log.id}
                  className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3"
                >
                  <time
                    dateTime={log.created_at}
                    className="text-xs sm:text-sm text-slate-500 block"
                  >
                    {new Date(log.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-300 mb-1">What we noticed</h3>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{log.thought_process}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-300 mb-1">What we changed</h3>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{log.action_taken}</p>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
