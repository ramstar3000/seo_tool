import Link from 'next/link';
import {
  getPracticesByCategory,
  getPracticeCategories,
  SEO_BEST_PRACTICES,
} from '@/lib/seo/best-practices';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';

export const metadata = {
  title: 'SEO Guide for London Local Businesses — SynapseCRO',
  description:
    'Practical SEO checklist for London local businesses: Google Business Profile, on-page, technical, and content.',
};

function priorityBadge(priority: 'high' | 'medium'): string {
  return priority === 'high'
    ? 'bg-red-500/10 text-red-300 border-red-500/25'
    : 'bg-white/[0.04] text-zinc-300 border-white/[0.08]';
}

export default function SeoGuidePage() {
  const categories = getPracticeCategories();
  const byCategory = getPracticesByCategory();
  const highCount = SEO_BEST_PRACTICES.filter((p) => p.priority === 'high').length;

  return (
    <main className="flex-1">
      <PageContainer className="py-10 sm:py-14 space-y-10">
        <header className="space-y-3 border-b border-white/[0.06] pb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            SEO guide for local businesses
          </h1>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            A practical checklist drawn from Google Search Central, Moz, and web.dev — focused on
            trades, clinics, hospitality, and services targeting local search.
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
              {SEO_BEST_PRACTICES.length} items
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/25">
              {highCount} high priority
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] text-zinc-300 border border-white/[0.08]">
              {categories.length} categories
            </span>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/audit"
              className="inline-flex min-h-11 items-center px-6 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-base font-medium transition-colors"
            >
              Get Your Free SEO Audit
            </Link>
            <Link
              href="/leads"
              className="inline-flex min-h-10 items-center text-sm font-medium text-zinc-400 hover:text-zinc-200"
            >
              ← All Leads
            </Link>
          </div>
        </header>

        {categories.map((category) => {
          const items = byCategory[category as keyof typeof byCategory] ?? [];

          return (
            <section key={category} aria-labelledby={`category-${category}`}>
              <h2
                id={`category-${category}`}
                className="text-lg sm:text-xl font-semibold text-white mb-4"
              >
                {category}
                <span className="ml-2 text-sm font-normal text-zinc-500">({items.length})</span>
              </h2>
              <ul className="space-y-3">
                {items.map((practice) => (
                  <li key={practice.id}>
                    <SurfaceCard className="p-5 sm:p-6 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-white">{practice.title}</h3>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide border ${priorityBadge(practice.priority)}`}
                        >
                          {practice.priority}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
                        {practice.description}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Applies to: {practice.appliesTo.join(', ')} · Source: {practice.source}
                      </p>
                    </SurfaceCard>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </PageContainer>
    </main>
  );
}
