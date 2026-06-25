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
    : 'bg-slate-700/50 text-slate-300 border-slate-600';
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
      className={`rounded-xl border border-slate-800 bg-slate-900/40 ${
        compact ? 'text-sm' : ''
      }`}
      aria-labelledby="seo-practices-heading"
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-slate-800/40 rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        aria-expanded={isOpen}
      >
        <div>
          <h2 id="seo-practices-heading" className="font-semibold text-white">
            SEO Best Practices
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            {SEO_BEST_PRACTICES.length} actions · {highCount} high priority · London local focus
          </p>
        </div>
        <span className="text-slate-400 shrink-0" aria-hidden="true">
          {isOpen ? '−' : '+'}
        </span>
      </button>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-4 space-y-3 border-t border-slate-800/80 pt-3">
          {SEO_PRACTICE_CATEGORIES.map((category) => {
            const practices = byCategory[category];
            const isCategoryOpen = expandedCategory === category;

            return (
              <div key={category} className="rounded-lg border border-slate-800/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isCategoryOpen ? null : category)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-900/60 hover:bg-slate-800/50 text-left transition-colors"
                  aria-expanded={isCategoryOpen}
                >
                  <span className="font-medium text-slate-200">{category}</span>
                  <span className="text-xs text-slate-500">
                    {practices.length} · {isCategoryOpen ? '−' : '+'}
                  </span>
                </button>

                {isCategoryOpen && (
                  <ul className="divide-y divide-slate-800/80">
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
                        <p className="text-slate-400 text-xs leading-relaxed">{practice.description}</p>
                        {practice.source && (
                          <p className="text-slate-600 text-[10px]">Source: {practice.source}</p>
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
