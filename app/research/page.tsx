'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/components/Toast';
import type { SiteAudit } from '@/lib/research/types';

export default function ResearchListPage() {
  const { showToast } = useToast();
  const [audits, setAudits] = useState<SiteAudit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/research');
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? 'Failed to load audits');
        }
        const body = (await response.json()) as { audits: SiteAudit[] };
        setAudits(body.audits);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load audits';
        setError(message);
        showToast(message);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [showToast]);

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <header className="space-y-3 border-b border-slate-800 pb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Research audits</h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl leading-relaxed">
            Site audits with SEO signals, competitor analysis, and social &amp; directory presence checks.
          </p>
          <Link
            href="/leads"
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            ← Back to leads
          </Link>
        </header>

        {error && (
          <p className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</p>
        )}

        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : (
        <section className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/80 text-left text-slate-400 border-b border-slate-800">
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Keyword</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No audits yet. Run analysis from the leads page.
                    </td>
                  </tr>
                ) : (
                  audits.map((audit) => (
                    <tr key={audit.id} className="border-b border-slate-800/80 hover:bg-slate-900/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{audit.business_name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{audit.target_url}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{audit.keyword}</td>
                      <td className="px-4 py-3 capitalize text-slate-300">{audit.status}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(audit.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/research/${audit.id}`}
                          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                        >
                          View audit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>
    </main>
  );
}
