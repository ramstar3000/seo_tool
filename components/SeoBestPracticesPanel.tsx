'use client';

import { useMemo, useState } from 'react';
import {
  getPracticesByCategory,
  SEO_BEST_PRACTICES,
  SEO_PRACTICE_CATEGORIES,
  type SeoBestPractice,
  type SeoPracticeCategory,
} from '@/lib/seo/best-practices';

function priorityClass(priority: SeoBestPractice['priority']): string {
  return priority === 'high'
    ? 'bg-red-500/15 text-red-300 border-red-500/30'
    : 'bg-zinc-700/50 text-zinc-300 border-zinc-600';
}

interface SeoBestPracticesPanelProps {
  compact?: boolean;
  defaultOpen?: boolean;
}

export function SeoBestPracticesPanel({
  compact = false,
  defaultOpen = false,
}: SeoBestPracticesPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [expandedCategory, setExpandedCategory] = useState<SeoPracticeCategory | null>(
    compact ? 'Local SEO' : null
  );

  const byCategory = useMemo(() => getPracticesByCategory(), []);
  const highCount = SEO_BEST_PRACTICES.filter((p) => p.priority === 'high').length;

  return (
    <aside
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] ${
        compact ? 'text-sm' : ''
      }`}
      aria-labelledby="seo-practices-heading"
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-white/[0.02] rounded-2xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400"
        aria-expanded={isOpen}
      >
        <div>
          <h2 id="seo-practices-heading" className="font-semibold text-white">
            SEO checklist
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">
            {SEO_BEST_PRACTICES.length} items · {highCount} high priority
          </p>
        </div>
        <span className="text-zinc-400 shrink-0" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
          {SEO_PRACTICE_CATEGORIES.map((category) => {
            const practices = byCategory[category];
            const isCategoryOpen = expandedCategory === category;

            return (
              <div key={category} className="rounded-xl border border-white/[0.06] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isCategoryOpen ? null : category)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] text-left transition-colors"
                  aria-expanded={isCategoryOpen}
                >
                  <span className="font-medium text-zinc-200">{category}</span>
                  <span className="text-xs text-zinc-500">
                    {practices.length} · {isCategoryOpen ? '−' : '+'}
                  </span>
                </button>

                {isCategoryOpen && (
                  <ul className="divide-y divide-white/[0.06]">
                    {practices.map((practice) => (
                      <li key={practice.title} className="px-3 py-3 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-white text-sm">{practice.title}</span>
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${priorityClass(practice.priority)}`}
                          >
                            {practice.priority}
                          </span>
                        </div>
                        <p className="text-zinc-400 text-xs leading-relaxed">{practice.description}</p>
                        {practice.source && (
                          <p className="text-zinc-600 text-[10px]">Source: {practice.source}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
