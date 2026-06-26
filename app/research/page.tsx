'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ResearchTierGuide } from '@/components/ResearchTierGuide';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/components/Toast';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
import { isLightAuditTrace } from '@/lib/leads/is-light-audit';
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
    <main className="flex-1">
      <PageContainer className="py-10 sm:py-14 space-y-8">
        <header className="space-y-2 border-b border-white/[0.06] pb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Research audits</h1>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            Light research (SERP rank + hooks) and full agent audits (scrape, social, PageSpeed). Run both from{' '}
            <Link href="/leads" className="text-teal-400 hover:underline">
              Leads
            </Link>
            .
          </p>
          <Link
            href="/leads"
            className="inline-flex min-h-10 items-center text-sm font-medium text-teal-400 hover:text-teal-300"
          >
            ← Leads
          </Link>
        </header>

        <ResearchTierGuide compact />

        {error && (
          <p className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{error}</p>
        )}

        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : (
          <SurfaceCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.02] text-left text-zinc-400 border-b border-white/[0.06]">
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium">Keyword</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                        No audits yet. Run one from the leads page.
                      </td>
                    </tr>
                  ) : (
                    audits.map((audit) => (
                      <tr key={audit.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{audit.business_name}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-xs">{audit.target_url}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{audit.keyword}</td>
                        <td className="px-4 py-3">
                          {isLightAuditTrace(audit.tool_trace) ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs bg-sky-500/10 text-sky-300 border border-sky-500/25">
                              Light research
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs bg-teal-500/10 text-teal-300 border border-teal-500/25">
                              Full audit
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize text-zinc-300">{audit.status}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          {new Date(audit.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/research/${audit.id}`}
                            className="text-xs font-medium text-teal-400 hover:text-teal-300"
                          >
                            View report
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        )}
      </PageContainer>
    </main>
  );
}
