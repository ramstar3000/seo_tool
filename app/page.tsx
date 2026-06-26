'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { HeroSprayBackground } from '@/components/HeroSprayBackground';
import { formInputClass, PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type CtaState = 'idle' | 'modal' | 'submitting' | 'success';

const DEFAULT_COPY = {
  hero_title: 'Rank higher. Get more visits.',
  hero_subtitle:
    'We improve your SEO and landing page so you show up in search and turn visits into enquiries.',
  cta_text: 'Get a free audit',
};

const BENEFITS = [
  'Rank higher in search',
  'More visibility for your business',
  'Turn visits into customers',
];

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
      body: JSON.stringify({ event_type: eventType, path: window.location.pathname }),
    });
  } catch {
    // Non-blocking
  }
}

const inputClass = formInputClass;

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
    <main className="flex-1">
      {(ctaState === 'modal' || ctaState === 'submitting') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-zinc-950/70 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
        >
          <SurfaceCard className="w-full max-w-md p-6 sm:p-7 shadow-2xl shadow-black/40 space-y-5">
            <header className="space-y-1.5">
              <h2 id="audit-modal-title" className="text-xl font-semibold text-white">
                Free website audit
              </h2>
              <p className="text-sm text-zinc-400">
                We scan your site and email you a report in about two minutes.
              </p>
            </header>

            <form onSubmit={(e) => void handleAuditSubmit(e)} className="space-y-4" noValidate>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-300">Email</span>
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@yourbusiness.com" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-300">Website</span>
                <input type="url" required autoComplete="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={inputClass} placeholder="yourbusiness.com" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-zinc-300">
                  Business name <span className="text-zinc-500 font-normal">(optional)</span>
                </span>
                <input type="text" autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} placeholder="Your Business Ltd" />
              </label>

              {formError && (
                <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setCtaState('idle')} className="flex-1 min-h-11 rounded-xl border border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={ctaState === 'submitting'} className="flex-1 min-h-11 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white font-medium transition-colors">
                  {ctaState === 'submitting' ? 'Starting…' : 'Start audit'}
                </button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      )}

      <section className="hero-bg relative overflow-hidden border-b border-white/[0.06]">
        <HeroSprayBackground />
        <PageContainer narrow className="relative z-10 py-14 sm:py-20 text-center">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] text-balance text-white">
              {showLoadingHero ? <span className="text-zinc-500 font-normal">Loading…</span> : heroTitle}
            </h1>
            <p className="text-base sm:text-lg text-zinc-400 max-w-md mx-auto text-pretty">
              {showLoadingHero ? 'One moment.' : heroSubtitle}
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {ctaState === 'success' && auditRequestId ? (
              <div role="status" aria-live="polite" className="max-w-md w-full">
                <SurfaceCard className="px-6 py-5 text-left sm:text-center">
                  <p className="text-teal-300 font-medium mb-1">Audit started</p>
                  <p className="text-sm text-zinc-400">
                    We&apos;ll email <span className="text-zinc-300">{email}</span> when ready.{' '}
                    <Link href={`/audit/${auditRequestId}`} className="text-teal-400 hover:text-teal-300 underline underline-offset-2">
                      View progress
                    </Link>
                  </p>
                </SurfaceCard>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCTAClick}
                  disabled={ctaState === 'submitting' || showLoadingHero}
                  className="min-h-12 w-full sm:w-auto px-8 rounded-xl bg-white text-zinc-950 font-medium hover:bg-zinc-100 disabled:opacity-60 transition-colors"
                >
                  {ctaText}
                </button>
                <Link
                  href="/dashboard"
                  className="min-h-12 w-full sm:w-auto inline-flex items-center justify-center px-6 rounded-xl border border-white/[0.1] text-zinc-300 font-medium hover:bg-white/[0.04] transition-colors"
                >
                  View dashboard
                </Link>
              </>
            )}
          </div>

          {ctaState === 'idle' && (
            <p className="mt-4 text-sm text-zinc-500">No credit card required</p>
          )}

          <ul className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-x-8 gap-y-2 text-sm text-zinc-400">
            {BENEFITS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-teal-500/70" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </PageContainer>
      </section>
    </main>
  );
}
