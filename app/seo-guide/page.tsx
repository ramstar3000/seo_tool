import Link from 'next/link';
import {
  getPracticesByCategory,
  getPracticeCategories,
  SEO_BEST_PRACTICES,
} from '@/lib/seo/best-practices';

export const metadata = {
  title: 'SEO Guide — SynapseCRO',
  description:
    'Actionable SEO best practices for London local businesses: GBP, on-page, technical, CRO, and content.',
};

function priorityBadge(priority: 'high' | 'medium'): string {
  return priority === 'high'
    ? 'bg-red-500/15 text-red-300 border-red-500/30'
    : 'bg-slate-700/50 text-slate-300 border-slate-600';
}

export default function SeoGuidePage() {
  const categories = getPracticeCategories();
  const byCategory = getPracticesByCategory();
  const highCount = SEO_BEST_PRACTICES.filter((p) => p.priority === 'high').length;

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        <header className="space-y-3 border-b border-slate-800 pb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            SEO Best Practices for London Local Businesses
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl leading-relaxed">
            Curated guidance from Google Search Central, Moz, Semrush, and web.dev — synthesised
            for trades, clinics, hospitality, and professional services targeting borough-level
            search.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {SEO_BEST_PRACTICES.length} practices
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/25">
              {highCount} high priority
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {categories.length} categories
            </span>
          </div>
          <Link
            href="/leads"
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            ← Back to leads pipeline
          </Link>
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
                <span className="ml-2 text-sm font-normal text-slate-500">({items.length})</span>
              </h2>
              <ul className="space-y-4">
                {items.map((practice) => (
                  <li
                    key={practice.id}
                    className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{practice.title}</h3>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wide border ${priorityBadge(practice.priority)}`}
                      >
                        {practice.priority}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                      {practice.description}
                    </p>
                    <p className="text-xs text-slate-500">
                      Applies to: {practice.appliesTo.join(', ')} · Source: {practice.source}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
