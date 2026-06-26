'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { CardGridSkeleton, TableSkeleton } from '@/components/LoadingSkeleton';
import { SeoBestPracticesPanel } from '@/components/SeoBestPracticesPanel';
import { SocialPresencePanel } from '@/components/SocialPresencePanel';
import { useToast } from '@/components/Toast';
import { PageContainer, SurfaceCard } from '@/components/ui/PageContainer';
import { getMatchingPractices } from '@/lib/seo/best-practices';
import { buildOutreachEmail } from '@/lib/leads/outreach-email';
import type { Lead, LeadStatus } from '@/lib/leads/types';
import type { SocialPresenceSnapshot } from '@/lib/research/types';

interface LeadAuditMap {
  [leadId: string]: { auditId: string; status: string };
}

interface AnalyzeState {
  [leadId: string]: 'loading' | 'done' | 'error';
}

interface SendState {
  [leadId: string]: 'loading' | 'done' | 'error';
}

const selectClass =
  'min-h-10 px-3 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm text-zinc-200 focus:border-teal-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500/20';

function AuditStatusBadge({ status, auditId }: { status: string; auditId?: string | null }) {
  const styles =
    status === 'completed'
      ? 'bg-teal-500/10 text-teal-300 border-teal-500/25'
      : status === 'running' || status === 'pending'
        ? 'bg-teal-500/10 text-teal-300 border-teal-500/25'
        : status === 'failed'
          ? 'bg-red-500/10 text-red-300 border-red-500/25'
          : 'bg-white/[0.04] text-zinc-400 border-white/[0.08]';

  const label =
    status === 'completed'
      ? 'Audited'
      : status === 'failed'
        ? 'Failed'
        : status === 'running' || status === 'pending'
          ? 'Running'
          : status;

  if (auditId && status === 'completed') {
    return (
      <Link
        href={`/research/${auditId}`}
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border hover:opacity-90 ${styles}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${styles}`}>
      {label}
    </span>
  );
}

function RankBadge({ rank }: { rank: 3 | 4 }) {
  const styles =
    rank === 3
      ? 'bg-teal-500/10 text-teal-300 border-teal-500/25'
      : 'bg-amber-500/10 text-amber-300 border-amber-500/25';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${styles}`}>
      #{rank}
    </span>
  );
}

const STATUS_OPTIONS: LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'converted',
  'dismissed',
];

async function requestLeads(
  rankFilter: 'all' | '3' | '4',
  categoryFilter: string
): Promise<Lead[]> {
  const params = new URLSearchParams();
  if (rankFilter !== 'all') params.set('rank', rankFilter);
  if (categoryFilter !== 'all') params.set('category', categoryFilter);

  const response = await fetch(`/api/leads?${params.toString()}`);
  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error ?? 'Failed to load leads');
  }

  const body = (await response.json()) as { leads: Lead[] };
  return body.leads;
}

export default function LeadsPage() {
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [rankFilter, setRankFilter] = useState<'all' | '3' | '4'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [socialByLead, setSocialByLead] = useState<Record<string, SocialPresenceSnapshot | null>>({});
  const [socialLoadingId, setSocialLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>({});
  const [sendState, setSendState] = useState<SendState>({});
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [leadAudits, setLeadAudits] = useState<LeadAuditMap>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await requestLeads(rankFilter, categoryFilter);
        if (!cancelled) {
          setLeads(data);
          const audits: LeadAuditMap = {};
          for (const lead of data) {
            if (lead.last_audit_id) {
              audits[lead.id] = {
                auditId: lead.last_audit_id,
                status: lead.audit_status ?? 'completed',
              };
            }
          }
          setLeadAudits(audits);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load leads';
          setError(message);
          showToast(message);
          setLeads([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rankFilter, categoryFilter, showToast]);

  const categories = useMemo(() => {
    const set = new Set(leads.map((l) => l.category).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [leads]);

  const stats = useMemo(() => {
    const rank3 = leads.filter((l) => l.rank_position === 3).length;
    const rank4 = leads.filter((l) => l.rank_position === 4).length;
    const withRecs = leads.filter((l) => l.recommendation).length;
    return { total: leads.length, rank3, rank4, withRecs };
  }, [leads]);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setError(null);

    try {
      const response = await fetch('/api/leads/discover', { method: 'POST' });
      const body = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Discovery failed');
      }
      setIsLoading(true);
      const data = await requestLeads(rankFilter, categoryFilter);
      setLeads(data);
      setIsLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Discovery failed';
      setError(message);
      showToast(message);
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleToggleExpand = async (leadId: string) => {
    if (expandedId === leadId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(leadId);
    await loadSocialSummary(leadId);
  };

  const loadSocialSummary = async (leadId: string) => {
    if (socialByLead[leadId] !== undefined) return;

    setSocialLoadingId(leadId);
    try {
      const response = await fetch(`/api/leads/${leadId}/social-summary`);
      if (response.ok) {
        const body = (await response.json()) as { socialPresence: SocialPresenceSnapshot | null };
        setSocialByLead((prev) => ({ ...prev, [leadId]: body.socialPresence }));
      } else {
        setSocialByLead((prev) => ({ ...prev, [leadId]: null }));
      }
    } catch {
      setSocialByLead((prev) => ({ ...prev, [leadId]: null }));
    } finally {
      setSocialLoadingId(null);
    }
  };

  const handleCopyEmail = async (lead: Lead) => {
    const email = buildOutreachEmail(lead);
    try {
      await navigator.clipboard.writeText(email.full);
      showToast('Outreach email copied');
    } catch {
      showToast('Could not copy to clipboard');
    }
  };

  const handleSendEmail = async (lead: Lead) => {
    setSendState((prev) => ({ ...prev, [lead.id]: 'loading' }));

    try {
      const response = await fetch(`/api/leads/${lead.id}/send-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        testMode?: boolean;
        to?: string;
        lead?: Lead;
      };

      if (!response.ok || !body.success) {
        throw new Error(body.error ?? 'Failed to send outreach email');
      }

      if (body.lead) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, ...body.lead! } : l)));
      } else {
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, status: 'contacted' as const } : l))
        );
      }
      setSendState((prev) => ({ ...prev, [lead.id]: 'done' }));
      showToast(
        body.testMode
          ? `Draft sent to ${body.to ?? 'test inbox'} — forward manually to prospect`
          : `Outreach sent to ${body.to ?? 'prospect'}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send outreach email';
      setSendState((prev) => ({ ...prev, [lead.id]: 'error' }));
      showToast(message);
    }
  };

  const handleBatchSend = async () => {
    const newCount = leads.filter((l) => l.status === 'new').length;
    if (newCount === 0) {
      showToast('No leads with status "new" to send');
      return;
    }

    setIsBatchSending(true);
    setError(null);

    try {
      const response = await fetch('/api/leads/outreach/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max: 5 }),
      });

      const body = (await response.json()) as {
        success?: boolean;
        sent?: number;
        failed?: number;
        attempted?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? 'Batch send failed');
      }

      if ((body.sent ?? 0) > 0) {
        setIsLoading(true);
        const data = await requestLeads(rankFilter, categoryFilter);
        setLeads(data);
        setIsLoading(false);
      }

      showToast(
        `Batch complete: ${body.sent ?? 0} sent${body.failed ? `, ${body.failed} failed` : ''}`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Batch send failed';
      setError(message);
      showToast(message);
    } finally {
      setIsBatchSending(false);
    }
  };

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } else {
      const body = (await response.json()) as { error?: string };
      showToast(body.error ?? 'Failed to update status');
    }
  };

  const handleAnalyze = async (lead: Lead) => {
    if (!lead.website_url) {
      showToast('This lead has no website URL to analyze.');
      return;
    }

    setAnalyzeState((prev) => ({ ...prev, [lead.id]: 'loading' }));
    setError(null);

    try {
      const response = await fetch('/api/research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });

      const body = (await response.json()) as { auditId?: string; error?: string; existing?: boolean };

      if (!response.ok || !body.auditId) {
        throw new Error(body.error ?? 'Analysis failed');
      }

      setLeadAudits((prev) => ({
        ...prev,
        [lead.id]: { auditId: body.auditId as string, status: 'completed' },
      }));
      setAnalyzeState((prev) => ({ ...prev, [lead.id]: 'done' }));
      setSocialByLead((prev) => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
      void loadSocialSummary(lead.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setAnalyzeState((prev) => ({ ...prev, [lead.id]: 'error' }));
      setError(message);
      showToast(message);
      setLeadAudits((prev) => ({
        ...prev,
        [lead.id]: { auditId: prev[lead.id]?.auditId ?? '', status: 'failed' },
      }));
    }
  };

  return (
    <main className="flex-1">
      <PageContainer wide className="py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_18rem] xl:grid-cols-[1fr_20rem]">
          <div className="space-y-8 min-w-0">
            <header className="space-y-2 border-b border-white/[0.06] pb-8">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Leads</h1>
              <p className="text-zinc-400 max-w-2xl leading-relaxed">
                Local businesses ranking #3 or #4 for their keyword — close enough to improve with a
                focused SEO and landing page pass.
              </p>
              <Link
                href="/seo-guide"
                className="inline-flex min-h-10 items-center text-sm font-medium text-teal-400 hover:text-teal-300"
              >
                SEO guide →
              </Link>
            </header>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {isLoading ? (
                <CardGridSkeleton count={4} cols={4} />
              ) : (
                <>
                  <SurfaceCard className="p-5">
                    <p className="text-sm text-zinc-400 mb-1">Total</p>
                    <p className="text-3xl font-semibold tabular-nums">{stats.total}</p>
                  </SurfaceCard>
                  <SurfaceCard className="p-5">
                    <p className="text-sm text-zinc-400 mb-1">Rank #3</p>
                    <p className="text-3xl font-semibold text-teal-300 tabular-nums">{stats.rank3}</p>
                  </SurfaceCard>
                  <SurfaceCard className="p-5">
                    <p className="text-sm text-zinc-400 mb-1">Rank #4</p>
                    <p className="text-3xl font-semibold text-amber-300 tabular-nums">{stats.rank4}</p>
                  </SurfaceCard>
                  <SurfaceCard className="p-5">
                    <p className="text-sm text-zinc-400 mb-1">With notes</p>
                    <p className="text-3xl font-semibold tabular-nums">{stats.withRecs}</p>
                  </SurfaceCard>
                </>
              )}
            </section>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDiscover}
                disabled={isDiscovering}
                className="inline-flex min-h-10 items-center px-5 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
              >
                {isDiscovering ? 'Finding leads…' : 'Find leads'}
              </button>
              <button
                type="button"
                onClick={() => void handleBatchSend()}
                disabled={isBatchSending || isLoading}
                className="inline-flex min-h-10 items-center px-4 rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20 disabled:opacity-60 text-sm font-medium transition-colors"
                title="Send outreach to up to 5 leads with status new (requires login + Resend config)"
              >
                {isBatchSending ? 'Sending…' : 'Send to new leads'}
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/leads/export"
                className="inline-flex min-h-10 items-center px-4 rounded-xl border border-white/[0.08] text-zinc-300 hover:bg-white/[0.04] text-sm font-medium transition-colors"
              >
                Export JSON
              </a>

              <select
                value={rankFilter}
                onChange={(e) => {
                  setIsLoading(true);
                  setRankFilter(e.target.value as 'all' | '3' | '4');
                }}
                className={selectClass}
                aria-label="Filter by rank"
              >
                <option value="all">All ranks</option>
                <option value="3">Rank #3</option>
                <option value="4">Rank #4</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setIsLoading(true);
                  setCategoryFilter(e.target.value);
                }}
                className={selectClass}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{error}</p>
            )}

            {isLoading ? (
              <TableSkeleton rows={6} cols={8} />
            ) : (
              <SurfaceCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-white/[0.02] text-left text-zinc-400 border-b border-white/[0.06]">
                        <th className="px-4 py-3 font-medium">Business</th>
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Keyword</th>
                        <th className="px-4 py-3 font-medium">Rank</th>
                        <th className="px-4 py-3 font-medium">Location</th>
                        <th className="px-4 py-3 font-medium">Score</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                            No leads yet. Click &quot;Find leads&quot; to load London prospects.
                          </td>
                        </tr>
                      ) : (
                        leads.map((lead) => {
                          const isExpanded = expandedId === lead.id;
                          const practices = getMatchingPractices(lead, 3);
                          const hasSuggestions = Boolean(lead.recommendation) || practices.length > 0;
                          return (
                            <Fragment key={lead.id}>
                              <tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-white flex flex-wrap items-center gap-2">
                                    {lead.business_name}
                                    {(lead.audit_status || lead.last_audit_id) && (
                                      <AuditStatusBadge
                                        status={lead.audit_status ?? 'completed'}
                                        auditId={lead.last_audit_id}
                                      />
                                    )}
                                  </div>
                                  {lead.website_url ? (
                                    <a
                                      href={lead.website_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-teal-400 hover:underline"
                                    >
                                      Website
                                    </a>
                                  ) : (
                                    <span className="text-xs text-zinc-500">No website</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-zinc-300 capitalize">{lead.category ?? '—'}</td>
                                <td className="px-4 py-3 text-zinc-400">{lead.keyword}</td>
                                <td className="px-4 py-3">
                                  <RankBadge rank={lead.rank_position} />
                                </td>
                                <td className="px-4 py-3 text-zinc-300">{lead.location}</td>
                                <td className="px-4 py-3 tabular-nums text-zinc-300">{lead.lead_score}</td>
                                <td className="px-4 py-3">
                                  <select
                                    value={lead.status}
                                    onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                                    className="px-2 py-1 rounded-lg bg-zinc-950/80 border border-white/[0.08] text-xs"
                                    aria-label={`Status for ${lead.business_name}`}
                                  >
                                    {STATUS_OPTIONS.map((s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3 space-y-1">
                                  <button
                                    type="button"
                                    onClick={() => void handleSendEmail(lead)}
                                    disabled={sendState[lead.id] === 'loading'}
                                    className="block text-xs font-medium text-teal-400 hover:text-teal-300 disabled:opacity-60 text-left"
                                    title={
                                      lead.status === 'contacted'
                                        ? 'Already contacted — sends again if needed'
                                        : 'Sends via Resend to OUTREACH_TARGET_EMAIL (leads have no prospect email in DB)'
                                    }
                                  >
                                    {sendState[lead.id] === 'loading'
                                      ? 'Sending…'
                                      : sendState[lead.id] === 'error'
                                        ? 'Retry send'
                                        : lead.status === 'contacted'
                                          ? 'Resend email'
                                          : 'Send email'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleCopyEmail(lead)}
                                    className="block text-xs font-medium text-zinc-400 hover:text-zinc-300"
                                  >
                                    Copy email
                                  </button>
                                  {lead.auto_pr?.pr_url && (
                                    <a
                                      href={lead.auto_pr.pr_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-xs font-medium text-teal-400 hover:text-teal-300"
                                      title="Auto-created PR from audit"
                                    >
                                      Auto PR
                                      {lead.auto_pr.pr_number ? ` #${lead.auto_pr.pr_number}` : ''}
                                    </a>
                                  )}
                                  {hasSuggestions || leadAudits[lead.id] ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleToggleExpand(lead.id)}
                                      className="block text-xs font-medium text-teal-400 hover:text-teal-300"
                                    >
                                      {isExpanded ? 'Hide details' : 'View details'}
                                    </button>
                                  ) : (
                                    <span className="block text-xs text-zinc-500">—</span>
                                  )}
                                  {lead.website_url ? (
                                    <div className="flex flex-col gap-1">
                                      {(lead.last_audit_id || leadAudits[lead.id]) &&
                                      (lead.audit_status === 'completed' ||
                                        leadAudits[lead.id]?.status === 'completed') ? (
                                        <Link
                                          href={`/research/${lead.last_audit_id ?? leadAudits[lead.id].auditId}`}
                                          className="text-xs font-medium text-teal-400 hover:text-teal-300"
                                        >
                                          View audit
                                        </Link>
                                      ) : lead.audit_status === 'failed' || leadAudits[lead.id]?.status === 'failed' ? (
                                        <button
                                          type="button"
                                          onClick={() => handleAnalyze(lead)}
                                          disabled={analyzeState[lead.id] === 'loading'}
                                          className="text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-60 text-left"
                                        >
                                          {analyzeState[lead.id] === 'loading' ? 'Retrying…' : 'Retry audit'}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleAnalyze(lead)}
                                          disabled={analyzeState[lead.id] === 'loading'}
                                          className="text-xs font-medium text-zinc-400 hover:text-zinc-300 disabled:opacity-60 text-left"
                                        >
                                          {analyzeState[lead.id] === 'loading'
                                            ? 'Running audit…'
                                            : analyzeState[lead.id] === 'error'
                                              ? 'Retry audit'
                                              : 'Run audit'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-zinc-500" title="Add a website URL to run an audit">
                                      No website
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (hasSuggestions || leadAudits[lead.id]) && (
                                <tr className="bg-white/[0.01] border-b border-white/[0.04]">
                                  <td colSpan={8} className="px-4 py-4 space-y-4">
                                    {lead.recommendation && (
                                      <div>
                                        <p className="text-xs font-medium text-zinc-400 mb-1">Suggested next step</p>
                                        <p className="text-sm text-zinc-300 leading-relaxed max-w-4xl">
                                          {lead.recommendation}
                                        </p>
                                      </div>
                                    )}
                                    {practices.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-zinc-400 mb-2">Matching SEO fixes</p>
                                        <ul className="space-y-2 max-w-4xl">
                                          {practices.map((p) => (
                                            <li key={p.id} className="text-sm text-zinc-300 leading-relaxed">
                                              <span className="font-medium text-white">{p.title}</span>
                                              <span className="text-zinc-500"> ({p.category})</span>
                                              {' — '}
                                              {p.description}
                                            </li>
                                          ))}
                                        </ul>
                                        <Link
                                          href="/seo-guide"
                                          className="inline-block mt-2 text-xs text-teal-400 hover:underline"
                                        >
                                          Full SEO guide
                                        </Link>
                                      </div>
                                    )}
                                    {lead.address && (
                                      <p className="text-xs text-zinc-500">{lead.address}</p>
                                    )}
                                    {(socialByLead[lead.id] || socialLoadingId === lead.id || leadAudits[lead.id]) && (
                                      <div>
                                        <p className="text-xs font-medium text-zinc-400 mb-2">
                                          Social &amp; directory profiles
                                        </p>
                                        {socialLoadingId === lead.id ? (
                                          <p className="text-xs text-zinc-500">Loading…</p>
                                        ) : socialByLead[lead.id] ? (
                                          <SocialPresencePanel
                                            compact
                                            profiles={socialByLead[lead.id]!.profiles.map((p) => ({
                                              platform_id: p.platform_id,
                                              platform_name: p.platform_name,
                                              status: p.status,
                                              profile_url: p.profile_url,
                                              bio_text: p.bio_text,
                                            }))}
                                            inconsistencies={socialByLead[lead.id]!.inconsistencies}
                                            searched={socialByLead[lead.id]!.searched}
                                          />
                                        ) : leadAudits[lead.id] ? (
                                          <p className="text-xs text-zinc-500">No profile data in audit.</p>
                                        ) : null}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </SurfaceCard>
            )}

            <p className="text-sm text-zinc-500">
              Without a Tavily key, demo mode loads 30 seeded London businesses. Leads have no
              prospect email — set <code className="text-zinc-400">OUTREACH_TARGET_EMAIL</code> and{' '}
              <code className="text-zinc-400">RESEND_API_KEY</code> to send drafts via Resend, then
              forward manually.
            </p>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <SeoBestPracticesPanel compact defaultOpen={false} />
          </div>
        </div>
      </PageContainer>
    </main>
  );
}
