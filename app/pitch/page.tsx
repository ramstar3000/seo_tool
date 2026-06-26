'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const SLIDES = [
  {
    id: 'title',
    kicker: 'SynapseCRO',
    title: 'SEO & CRO that ships fixes',
    body: 'Audit local business sites. Find what costs them rankings. Deliver fixes automatically.',
    bullets: [
      'GitHub PRs for code-backed sites',
      'Fix packs for Wix, Webflow, Squarespace',
      'Audit → fix → re-audit, hands-off',
    ],
  },
  {
    id: 'automated',
    kicker: 'What runs hands-off',
    title: 'Automated today',
    body: 'The pipeline runs end-to-end. Humans review; the agent does the work.',
    sections: [
      {
        label: 'Acquisition',
        items: ['Free audit → lead + email', 'SERP discovery + outreach hook'],
      },
      {
        label: 'Diagnosis',
        items: ['Agent scrape, social, PageSpeed', 'Scored report + MUST_DO'],
      },
      {
        label: 'Delivery',
        items: ['Auto GitHub PR', 'No-code fix pack'],
      },
      {
        label: 'Loop',
        items: ['CRO copy from click data', 'Weekly re-audit + prompt improve'],
      },
    ],
  },
  {
    id: 'technical',
    kicker: 'Under the hood',
    title: 'Technical stack',
    body: 'Fly.io · Supabase · Gemini · Langfuse · ClickHouse',
    sections: [
      {
        label: 'App',
        items: ['Next.js 16 · Supabase Realtime', 'Gemini agent + Tavily search'],
      },
      {
        label: 'Fixes',
        items: ['GitHub App auto PR', 'Fix pack API for no-code'],
      },
      {
        label: 'Ops',
        items: ['Resend + Slack alerts', 'Cron: CRO + re-audit'],
      },
    ],
  },
  {
    id: 'demo',
    kicker: 'Live demo',
    title: "Let's walk through it",
    body: 'synapsecro.fly.dev',
    sections: [
      {
        label: '1 · Hook',
        items: ['Homepage → free audit', 'Real URL, live rank check'],
      },
      {
        label: '2 · Report',
        items: ['Score + findings + fix pack', 'GitHub PR if repo linked'],
      },
      {
        label: '3 · Pipeline',
        items: ['/leads → full audit', '/research → MUST_DO'],
      },
      {
        label: '4 · Close',
        items: ['/dashboard → CRO loop', '"Audit Monday, PR Tuesday"'],
      },
    ],
    links: [
      { href: 'https://synapsecro.fly.dev', label: 'Open app' },
      { href: 'https://synapsecro.fly.dev/leads', label: 'Leads' },
    ],
  },
] as const;

export default function PitchPage() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const total = SLIDES.length;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)));
    },
    [total]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
      if (e.key === 'Home') setIndex(0);
      if (e.key === 'End') setIndex(total - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, total]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/[0.06]">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          SynapseCRO
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 tabular-nums">
            {index + 1} / {total}
          </span>
          <div className="flex gap-1.5" aria-hidden="true">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-teal-400' : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-10 sm:py-16 max-w-5xl mx-auto w-full">
        <p className="text-sm font-medium text-teal-400 mb-3">{slide.kicker}</p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-white leading-tight mb-6">
          {slide.title}
        </h1>
        <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl mb-8">{slide.body}</p>

        {'bullets' in slide && slide.bullets && (
          <ul className="space-y-2.5 text-zinc-400 text-base max-w-xl">
            {slide.bullets.map((item) => (
              <li key={item} className="flex gap-3 leading-relaxed">
                <span className="text-teal-500 shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-500" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        )}

        {'sections' in slide && slide.sections && (
          <div className="grid gap-4 sm:grid-cols-2">
            {slide.sections.map((section) => (
              <div
                key={section.label}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2"
              >
                <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{section.label}</h2>
                <ul className="space-y-1.5 text-sm text-zinc-400 leading-snug">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {'links' in slide && slide.links && (
          <div className="flex flex-wrap gap-3 mt-8">
            {slide.links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between gap-4 px-6 py-4 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="inline-flex min-h-10 items-center px-4 rounded-xl border border-white/[0.1] text-sm text-zinc-300 hover:bg-white/[0.04] disabled:opacity-30 disabled:pointer-events-none"
        >
          Previous
        </button>
        <p className="text-xs text-zinc-600 hidden sm:block">Arrow keys · Space · Home / End</p>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === total - 1}
          className="inline-flex min-h-10 items-center px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-sm font-medium text-white disabled:opacity-30 disabled:pointer-events-none"
        >
          {index === total - 1 ? 'Done' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
