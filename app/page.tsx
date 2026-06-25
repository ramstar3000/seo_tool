'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type CtaState = 'idle' | 'submitting' | 'success';

const DEFAULT_COPY = {
  hero_title: 'Get more customers from your website',
  hero_subtitle:
    'SynapseCRO helps local businesses turn visitors into leads with a landing page that improves itself over time.',
  cta_text: 'Get a free audit',
};

function hasSupabaseConfig(): boolean {
  return createBrowserSupabaseClient() !== null;
}

export default function Home() {
  const [copy, setCopy] = useState<Record<string, string>>({});
  const [isLoadingCopy, setIsLoadingCopy] = useState(hasSupabaseConfig);
  const [ctaState, setCtaState] = useState<CtaState>('idle');

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    supabase
      .from('site_copy')
      .select('*')
      .then(({ data }: { data: { id: string; text_content: string }[] | null }) => {
        if (data) {
          const dict = data.reduce<Record<string, string>>(
            (acc, item) => ({ ...acc, [item.id]: item.text_content }),
            {}
          );
          setCopy(dict);
        }
        setIsLoadingCopy(false);
      });

    supabase.from('analytics_events').insert({ event_type: 'page_view' }).then();

    const channel = supabase
      .channel('live_copy')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_copy' },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { id: string; text_content: string };
          setCopy((prev) => ({ ...prev, [row.id]: row.text_content }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCTAClick = async () => {
    if (ctaState !== 'idle') return;

    setCtaState('submitting');
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setCtaState('idle');
      return;
    }

    await supabase.from('analytics_events').insert({ event_type: 'cta_click' });
    setCtaState('success');
  };

  const heroTitle = copy.hero_title || DEFAULT_COPY.hero_title;
  const heroSubtitle = copy.hero_subtitle || DEFAULT_COPY.hero_subtitle;
  const ctaText = copy.cta_text || DEFAULT_COPY.cta_text;
  const showLoadingHero = isLoadingCopy && !copy.hero_title;

  return (
    <main className="flex-1 bg-slate-950 text-white">
      {/* Hero — value proposition above the fold */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
          <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            Built for local business owners
          </p>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight text-balance">
              {showLoadingHero ? (
                <span className="text-slate-400 font-normal">Loading your page content…</span>
              ) : (
                heroTitle
              )}
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed text-pretty">
              {showLoadingHero ? 'One moment while we load your headline and offer.' : heroSubtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-2">
            {ctaState === 'success' ? (
              <div
                className="inline-flex flex-col items-center gap-2 px-6 py-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30"
                role="status"
                aria-live="polite"
              >
                <span className="flex items-center gap-2 text-emerald-300 font-semibold text-lg">
                  <svg
                    className="w-6 h-6 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Request received — thank you!
                </span>
                <p className="text-sm text-slate-400">
                  Check the{' '}
                  <Link href="/dashboard" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
                    activity dashboard
                  </Link>{' '}
                  to see your click recorded.
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCTAClick}
                  disabled={ctaState === 'submitting' || showLoadingHero}
                  className="min-h-12 px-8 py-3 bg-white text-slate-950 font-semibold rounded-xl transition-all hover:bg-slate-100 active:scale-[0.98] shadow-lg disabled:opacity-60 disabled:cursor-not-allowed text-base sm:text-lg"
                >
                  {ctaState === 'submitting' ? 'Sending your request…' : ctaText}
                </button>
                <Link
                  href="/dashboard"
                  className="min-h-12 inline-flex items-center justify-center px-6 py-3 rounded-xl border border-slate-700 text-slate-200 font-medium hover:bg-slate-800/60 transition-colors text-base"
                >
                  View activity dashboard
                </Link>
              </>
            )}
          </div>

          {ctaState === 'idle' && (
            <p className="text-sm text-slate-500">
              <a href="#how-it-works" className="text-emerald-400/90 hover:text-emerald-300 underline underline-offset-2">
                See how it works
              </a>
              {' · '}
              No credit card required
            </p>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="px-4 sm:px-6 py-14 sm:py-16 border-t border-slate-800/80 bg-slate-900/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Why local businesses use SynapseCRO</h2>
          <p className="text-slate-400 text-center mb-10 text-base sm:text-lg">
            More visibility, clearer messaging, and more people clicking your main button.
          </p>
          <ul className="grid gap-6 sm:grid-cols-3 text-left">
            {[
              {
                title: 'Show up when people search',
                body: 'We tune your headline and offer so nearby customers understand what you do right away.',
              },
              {
                title: 'Turn visits into leads',
                body: 'Your call-to-action is tested and improved based on real visitor behavior — not guesswork.',
              },
              {
                title: 'See what is working',
                body: 'A simple dashboard shows visits, button clicks, and recent page updates in plain English.',
              },
            ].map((item) => (
              <li
                key={item.title}
                className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-950/50 space-y-2"
              >
                <h3 className="font-semibold text-lg text-white">{item.title}</h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process */}
      <section id="how-it-works" className="px-4 sm:px-6 py-14 sm:py-16 border-t border-slate-800/80">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">How it works</h2>
          <p className="text-slate-400 mb-10 text-base sm:text-lg">
            Three simple steps — no technical setup on your end.
          </p>
          <ol className="space-y-6 text-left">
            {[
              { step: '1', title: 'Visitors land on your page', detail: 'We count each visit automatically.' },
              {
                step: '2',
                title: 'They click your main button',
                detail: 'When someone requests an audit, we record that too.',
              },
              {
                step: '3',
                title: 'Your page gets better over time',
                detail: 'SynapseCRO adjusts your headline and button text to improve results.',
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-4 items-start">
                <span
                  className="flex shrink-0 w-10 h-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/25"
                  aria-hidden="true"
                >
                  {item.step}
                </span>
                <div>
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  <p className="text-slate-400 text-sm sm:text-base mt-1">{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Trust */}
      <section className="px-4 sm:px-6 py-14 sm:py-16 border-t border-slate-800/80 bg-slate-900/30">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">Trusted by judges and business owners alike</h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            SynapseCRO is designed for real local businesses — plumbers, salons, clinics, and shops — who
            want a website that works as hard as they do. Every change is logged so you always know what
            happened and why.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center justify-center mt-4 px-6 py-3 rounded-xl border border-slate-600 text-slate-200 font-medium hover:bg-slate-800/60 transition-colors"
          >
            Open activity dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
