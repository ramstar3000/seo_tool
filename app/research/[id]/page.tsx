'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LinkedRepositoriesPanel } from '@/components/LinkedRepositoriesPanel';
import { SocialPresencePanel } from '@/components/SocialPresencePanel';
import type { AuditDetail } from '@/lib/research/persist';

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
          <p className="text-slate-500">Loading audit…</p>
        </div>
      </main>
    );
  }

  if (error || !audit) {
    return (
      <main className="flex-1 bg-slate-950 text-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-4">
          <p className="text-red-300">{error ?? 'Audit not found'}</p>
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {audit.business_name}
          </h1>
          <p className="text-slate-400">
            Keyword: <span className="text-slate-200">{audit.keyword}</span>
            {' · '}
            <a
              href={audit.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              {audit.target_url}
            </a>
          </p>
          <Link
            href="/research"
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            ← All audits
          </Link>
        </header>

        {audit.summary && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Summary</h2>
            <p className="text-slate-300 leading-relaxed">{audit.summary}</p>
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

        {audit.recommendations && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Recommendations</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{audit.recommendations}</p>
          </section>
        )}

        {audit.findings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Findings</h2>
            <div className="space-y-3">
              {audit.findings.map((finding) => (
                <article
                  key={finding.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded border capitalize ${
                        finding.severity === 'critical'
                          ? 'bg-red-500/15 text-red-300 border-red-500/30'
                          : finding.severity === 'warning'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600/50'
                      }`}
                    >
                      {finding.severity}
                    </span>
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

        {audit.competitors.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Competitors</h2>
            <ul className="space-y-2">
              {audit.competitors.map((c) => (
                <li key={c.id} className="text-sm text-slate-300">
                  <span className="text-slate-500">#{c.rank_position}</span>{' '}
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                    {c.business_name}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
