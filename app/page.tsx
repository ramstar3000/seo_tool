'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type CtaState = 'idle' | 'modal' | 'submitting' | 'success';

const DEFAULT_COPY = {
  hero_title: 'Get more customers from your website',
  hero_subtitle:
    'SynapseCRO is a self-optimizing landing page for local businesses — it learns from visitor clicks, runs free SEO audits, and improves your copy automatically.',
  cta_text: 'Get a free audit',
};

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function validateAuditForm(email: string, websiteUrl: string): string | null {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return 'Please enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return 'Please enter a valid email address.';
  }

  const normalized = normalizeWebsiteUrl(websiteUrl);
  try {
    const parsed = new URL(normalized);
    if (!parsed.hostname.includes('.')) {
      return 'Please enter a full website address (e.g. yourbusiness.com).';
    }
  } catch {
    return 'Please enter a valid website URL (e.g. https://yourbusiness.com).';
  }

  return null;
}

function hasSupabaseConfig(): boolean {
  return createBrowserSupabaseClient() !== null;
}

async function trackAnalytics(eventType: 'page_view' | 'cta_click'): Promise<void> {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType }),
    });
  } catch {
    // Non-blocking analytics
  }
}

export default function Home() {
  const [copy, setCopy] = useState<Record<string, string>>({});
  const [isLoadingCopy, setIsLoadingCopy] = useState(hasSupabaseConfig);
  const [ctaState, setCtaState] = useState<CtaState>('idle');
  const [email, setEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [auditRequestId, setAuditRequestId] = useState<string | null>(null);

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

    void trackAnalytics('page_view');

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

  const handleCTAClick = () => {
    if (ctaState !== 'idle') return;
    setFormError(null);
    setCtaState('modal');
    void trackAnalytics('cta_click');
  };

  const handleAuditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validationError = validateAuditForm(email, websiteUrl);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setCtaState('submitting');

    try {
      const response = await fetch('/api/audit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          websiteUrl: normalizeWebsiteUrl(websiteUrl),
          businessName: businessName.trim() || undefined,
        }),
      });

      const body = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !body.id) {
        throw new Error(body.error ?? 'Failed to submit audit request');
      }

      setAuditRequestId(body.id);
      setCtaState('success');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to submit audit request');
      setCtaState('modal');
    }
  };

  const heroTitle = copy.hero_title || DEFAULT_COPY.hero_title;
  const heroSubtitle = copy.hero_subtitle || DEFAULT_COPY.hero_subtitle;
  const ctaText = copy.cta_text || DEFAULT_COPY.cta_text;
  const showLoadingHero = isLoadingCopy && !copy.hero_title;

  return (
    <main className="flex-1 bg-slate-950 text-white">
      {(ctaState === 'modal' || ctaState === 'submitting') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl space-y-5">
            <header className="space-y-1">
              <h2 id="audit-modal-title" className="text-xl font-bold text-white">
                Get your free website audit
              </h2>
              <p className="text-sm text-slate-400">
                We scan your site, check competitors, and review your online presence — results in about 2 minutes.
              </p>
            </header>

            <form onSubmit={(e) => void handleAuditSubmit(e)} className="space-y-4" noValidate>
              <label className="block space-y-1.5">
                <span id="audit-email-label" className="text-sm font-medium text-slate-300">
                  Email address
                </span>
                <input
                  type="email"
                  required
                  aria-labelledby="audit-email-label"
                  aria-describedby={formError ? 'audit-form-error' : undefined}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                  placeholder="you@yourbusiness.com"
                />
              </label>

              <label className="block space-y-1.5">
                <span id="audit-url-label" className="text-sm font-medium text-slate-300">
                  Website URL
                </span>
                <input
                  type="url"
                  required
                  aria-labelledby="audit-url-label"
                  autoComplete="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                  placeholder="yourbusiness.com or https://yourbusiness.com"
                />
              </label>

              <label className="block space-y-1.5">
                <span id="audit-name-label" className="text-sm font-medium text-slate-300">
                  Business name <span className="text-slate-500 font-normal">(optional)</span>
                </span>
                <input
                  type="text"
                  aria-labelledby="audit-name-label"
                  autoComplete="organization"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full min-h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none"
                  placeholder="Your Business Ltd"
                />
              </label>

              {formError && (
                <p
                  id="audit-form-error"
                  role="alert"
                  className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
                >
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setCtaState('idle')}
                  className="flex-1 min-h-11 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ctaState === 'submitting'}
                  className="flex-1 min-h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-medium transition-colors"
                >
                  {ctaState === 'submitting' ? 'Starting audit…' : 'Start free audit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hero — value proposition above the fold */}
      <section className="px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8">
          <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            Cursor Hackathon — self-optimizing CRO + free audits
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
            {ctaState === 'success' && auditRequestId ? (
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
                  Your audit is running!
                </span>
                <p className="text-sm text-slate-400 max-w-sm">
                  We&apos;ll email you at <span className="text-slate-300">{email}</span> when it&apos;s ready.
                  View progress at{' '}
                  <Link
                    href={`/audit/${auditRequestId}`}
                    className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
                  >
                    /audit/{auditRequestId.slice(0, 8)}…
                  </Link>
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
                  {ctaText}
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
                title: 'They request a free audit',
                detail: 'Enter email and website — we run a real SEO/CRO analysis.',
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
