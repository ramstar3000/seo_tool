'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LinkedRepositoriesPanel } from '@/components/LinkedRepositoriesPanel';
import { ReportSkeleton } from '@/components/LoadingSkeleton';
import { ResearchTierGuide } from '@/components/ResearchTierGuide';
import { SocialPresencePanel } from '@/components/SocialPresencePanel';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
import { isLightAuditTrace } from '@/lib/leads/is-light-audit';
import type { AuditDetail } from '@/lib/research/types';

function SeverityBadge({ severity }: { severity: string }) {
  const styles =
    severity === 'critical'
      ? 'bg-red-500/10 text-red-300 border-red-500/25'
      : severity === 'warning'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
        : 'bg-white/[0.04] text-zinc-400 border-white/[0.08]';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-xs capitalize ${styles}`}>
      {severity}
    </span>
  );
}

export default function ResearchAuditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [auditId, setAuditId] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

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

  const handleRunFullAudit = async () => {
    if (!audit?.lead_id) return;

    setUpgradeLoading(true);
    setUpgradeError(null);

    try {
      const response = await fetch('/api/research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: audit.lead_id }),
      });
      const body = (await response.json()) as { auditId?: string; error?: string };

      if (!response.ok || !body.auditId) {
        throw new Error(body.error ?? 'Full audit failed');
      }

      router.push(`/research/${body.auditId}`);
    } catch (err) {
      setUpgradeError(err instanceof Error ? err.message : 'Full audit failed');
    } finally {
      setUpgradeLoading(false);
    }
  };

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
        (f) =>
          !['social', 'seo', 'technical'].includes(f.category) &&
          !(f.evidence && typeof f.evidence === 'object' && (f.evidence as { mustDo?: boolean }).mustDo)
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

  const isLightScan = useMemo(
    () => (audit ? isLightAuditTrace(audit.tool_trace) : false),
    [audit]
  );

  const mustDoFindings = useMemo(
    () =>
      audit?.findings.filter(
        (f) => f.evidence && typeof f.evidence === 'object' && (f.evidence as { mustDo?: boolean }).mustDo
      ) ?? [],
    [audit]
  );

  if (isLoading) {
    return (
      <main className="flex-1">
        <PageContainer className="py-10">
          <ReportSkeleton />
        </PageContainer>
      </main>
    );
  }

  if (error || !audit) {
    return (
      <main className="flex-1">
        <PageContainer className="py-10 space-y-4">
          <p className="text-red-300" role="alert">{error ?? 'Audit not found'}</p>
          <Link href="/research" className="text-teal-400 hover:underline text-sm">
            ← All audits
          </Link>
        </PageContainer>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <PageContainer className="py-10 sm:py-14 space-y-10">
        <header className="space-y-2 border-b border-white/[0.06] pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-teal-400 font-medium">Research report</p>
            {isLightScan && (
              <span className="inline-flex px-2 py-0.5 rounded-md border text-xs bg-sky-500/10 text-sky-300 border-sky-500/25">
                Light research
              </span>
            )}
            {!isLightScan && (
              <span className="inline-flex px-2 py-0.5 rounded-md border text-xs bg-teal-500/10 text-teal-300 border-teal-500/25">
                Full audit
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white break-words">
            {audit.business_name}
          </h1>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-zinc-400">
            <span>
              Keyword: <span className="text-zinc-200">{audit.keyword}</span>
            </span>
            <a
              href={audit.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 hover:underline break-all"
            >
              {audit.target_url}
            </a>
          </div>
          <Link
            href="/research"
            className="inline-flex min-h-10 items-center text-sm font-medium text-teal-400 hover:text-teal-300"
          >
            ← All audits
          </Link>
        </header>

        {isLightScan && (
          <SurfaceCard className="p-5 sm:p-6 space-y-4 border-teal-500/25 bg-teal-500/[0.04]">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-teal-200">Want the detailed report?</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                This page is a quick SERP scan only (rank, competitors, outreach hook). A{' '}
                <strong className="font-medium text-white">full audit</strong> scrapes the site, checks social
                profiles, PageSpeed, and saves actionable findings.
              </p>
            </div>
            {audit.lead_id ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleRunFullAudit()}
                  disabled={upgradeLoading}
                  className="inline-flex min-h-10 items-center px-5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                >
                  {upgradeLoading ? 'Running full audit…' : 'Run full audit →'}
                </button>
                <Link
                  href="/leads"
                  className="text-sm text-teal-400 hover:text-teal-300 font-medium"
                >
                  Back to leads
                </Link>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                Link this business on the{' '}
                <Link href="/leads" className="text-teal-400 hover:underline">
                  Leads
                </Link>{' '}
                page, then click <strong className="font-medium text-zinc-300">Run full audit</strong>.
              </p>
            )}
            {upgradeError && (
              <p className="text-sm text-red-300" role="alert">
                {upgradeError}
              </p>
            )}
            <ResearchTierGuide compact />
          </SurfaceCard>
        )}

        {audit.auto_pr?.pr_url && (
          <SurfaceCard className="p-4 sm:p-5 border-teal-500/25 bg-teal-500/[0.04]">
            <p className="text-sm text-teal-200">
              Auto PR created
              {audit.auto_pr.pr_number ? ` (#${audit.auto_pr.pr_number})` : ''}:{' '}
              <a
                href={audit.auto_pr.pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-teal-100 break-all"
              >
                {audit.auto_pr.pr_url}
              </a>
            </p>
          </SurfaceCard>
        )}

        {mustDoFindings.length > 0 && (
          <SurfaceCard className="p-5 sm:p-6 space-y-4 border-amber-500/25 bg-amber-500/[0.04]">
            <h2 className="text-lg font-semibold text-amber-200">MUST_DO</h2>
            <ol className="space-y-3 list-decimal list-inside text-zinc-200">
              {mustDoFindings.map((finding) => (
                <li key={finding.id} className="leading-relaxed">
                  <span className="font-medium text-white">{finding.title}</span>
                  <span className="text-zinc-300"> — {finding.description}</span>
                </li>
              ))}
            </ol>
          </SurfaceCard>
        )}

        {audit.summary && (
          <SurfaceCard className="p-5 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Summary</h2>
            <p className="text-zinc-300 leading-relaxed">{audit.summary}</p>
          </SurfaceCard>
        )}

        {audit.recommendations && (
          <SurfaceCard className="p-5 sm:p-6 space-y-3 border-teal-500/20 bg-teal-500/[0.03]">
            <h2 className="text-lg font-semibold text-teal-200">Recommended fixes</h2>
            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{audit.recommendations}</p>
          </SurfaceCard>
        )}

        {seoFindings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">SEO &amp; technical</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {seoFindings.map((finding) => (
                <SurfaceCard key={finding.id} className="p-4 space-y-2">
                  <SeverityBadge severity={finding.severity} />
                  <h3 className="font-medium text-white">{finding.title}</h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">{finding.description}</p>
                </SurfaceCard>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Social &amp; directory presence</h2>
          <SurfaceCard className="p-5">
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
          </SurfaceCard>
        </section>

        {audit.competitors.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Nearby competitors</h2>
            <SurfaceCard className="divide-y divide-white/[0.06] overflow-hidden">
              {audit.competitors.map((c) => (
                <div key={c.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                  <span className="text-zinc-500 font-mono text-xs">#{c.rank_position}</span>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">
                    {c.business_name}
                  </a>
                  {c.snippet && <span className="text-zinc-500 text-xs sm:ml-auto truncate max-w-md">{c.snippet}</span>}
                </div>
              ))}
            </SurfaceCard>
          </section>
        )}

        {otherFindings.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Other findings</h2>
            <div className="space-y-3">
              {otherFindings.map((finding) => (
                <SurfaceCard key={finding.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <SeverityBadge severity={finding.severity} />
                    <span className="text-zinc-500 capitalize">{finding.category}</span>
                  </div>
                  <h3 className="font-medium text-white">{finding.title}</h3>
                  <p className="text-sm text-zinc-300 leading-relaxed">{finding.description}</p>
                </SurfaceCard>
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
      </PageContainer>
    </main>
  );
}
