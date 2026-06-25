'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LinkedRepositoriesPanel } from '@/components/LinkedRepositoriesPanel';
import { ReportSkeleton } from '@/components/LoadingSkeleton';
import { SocialPresencePanel } from '@/components/SocialPresencePanel';
import type { AuditDetail } from '@/lib/research/persist';

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === 'critical'
      ? 'bg-red-500/15 text-red-300 border-red-500/30'
      : severity === 'warning'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-slate-700/50 text-slate-400 border-slate-600/50';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded border text-xs capitalize ${styles}`}>
      {severity}
    </span>
  );
}

export default function ResearchAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const [auditId, setAuditId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setAuditId(p.id));
  }, [params]);

  useEffect(() => {
    if (!auditId) return;

    void (async () => {
      try {
        const response = await fetch(`/api/research/${auditId}`);
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? 'Failed to load audit');
        }
        const body = (await response.json()) as { audit: AuditDetail };
        setAudit(body.audit);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [auditId]);

  const socialFindings = useMemo(
    () => audit?.findings.filter((f) => f.category === 'social') ?? [],
    [audit]
  );

  const seoFindings = useMemo(
    () => audit?.findings.filter((f) => f.category === 'seo' || f.category === 'technical') ?? [],
    [audit]
  );

  const otherFindings = useMemo(
    () =>
      audit?.findings.filter(
        (f) => !['social', 'seo', 'technical'].includes(f.category)
      ) ?? [],
    [audit]
  );

  const socialInconsistencies = useMemo(() => {
    const fromPresence = audit?.socialPresence?.inconsistencies ?? [];
    const fromFindings = socialFindings.map((f) => ({
      type: f.title,
      description: f.description,
      recommendation: '',
      severity: f.severity,
    }));
    return fromFindings.length > 0 ? fromFindings : fromPresence;
  }, [audit, socialFindings]);

  if (isLoading) {
    return (
      <main className="flex-1 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <ReportSkeleton />
        </div>
      </main>
    );
  }

  if (error || !audit) {
    return (
      <main className="flex-1 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <p className="text-red-300" role="alert">{error ?? 'Audit not found'}</p>
          <Link href="/research" className="text-emerald-400 hover:underline text-sm">
            ← Back to research
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        <header className="space-y-3 border-b border-slate-800 pb-8">
          <p className="text-sm text-emerald-400 font-medium">Research audit</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white break-words">
            {audit.business_name}
          </h1>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-slate-400">
            <span>
              Keyword: <span className="text-slate-200">{audit.keyword}</span>
            </span>
            <a
              href={audit.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline break-all"
            >
              {audit.target_url}
            </a>
          </div>
          <Link
            href="/research"
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            ← All audits
          </Link>
        </header>

        {audit.summary && (
          <section className="p-5 sm:p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
            <h2 className="text-lg font-semibold text-white">Executive summary</h2>
            <p className="text-slate-300 leading-relaxed">{audit.summary}</p>
          </section>
        )}

        {audit.recommendations && (
          <section className="p-5 sm:p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
            <h2 className="text-lg font-semibold text-emerald-200">Recommendations</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{audit.recommendations}</p>
          </section>
        )}

        {seoFindings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">SEO &amp; technical</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {seoFindings.map((finding) => (
                <article
                  key={finding.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-2"
                >
                  <SeverityBadge severity={finding.severity} />
                  <h3 className="font-medium text-white">{finding.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{finding.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Social &amp; directory presence</h2>
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <SocialPresencePanel
              profiles={
                audit.socialProfiles.length > 0
                  ? audit.socialProfiles.map((p) => ({
                      platform_id: p.platform_id,
                      platform_name: p.platform_name ?? p.platform_id,
                      status: p.status,
                      profile_url: p.profile_url,
                      bio_text: p.bio_text,
                    }))
                  : []
              }
              inconsistencies={socialInconsistencies}
              searched={audit.socialPresence?.searched ?? false}
            />
          </div>
        </section>

        {audit.competitors.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Competitors</h2>
            <ul className="rounded-xl border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
              {audit.competitors.map((c) => (
                <li key={c.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm bg-slate-900/30">
                  <span className="text-slate-500 font-mono text-xs">#{c.rank_position}</span>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                    {c.business_name}
                  </a>
                  {c.snippet && <span className="text-slate-500 text-xs sm:ml-auto truncate max-w-md">{c.snippet}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {otherFindings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Other findings</h2>
            <div className="space-y-3">
              {otherFindings.map((finding) => (
                <article
                  key={finding.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <SeverityBadge severity={finding.severity} />
                    <span className="text-slate-500 capitalize">{finding.category}</span>
                  </div>
                  <h3 className="font-medium text-white">{finding.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{finding.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {audit.lead_id && (
          <section className="space-y-4">
            <LinkedRepositoriesPanel
              leadId={audit.lead_id}
              auditId={audit.id}
              auditStatus={audit.status}
            />
          </section>
        )}
      </div>
    </main>
  );
}
