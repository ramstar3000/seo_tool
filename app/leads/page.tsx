'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { SeoBestPracticesPanel } from '@/components/SeoBestPracticesPanel';
import { SocialPresencePanel } from '@/components/SocialPresencePanel';
import { getMatchingPractices } from '@/lib/seo/best-practices';
import type { Lead, LeadStatus } from '@/lib/leads/types';
import type { SocialPresenceSnapshot } from '@/lib/research/types';

interface LeadAuditMap {
  [leadId: string]: { auditId: string; status: string };
}

interface AnalyzeState {
  [leadId: string]: 'loading' | 'done' | 'error';
}

function RankBadge({ rank }: { rank: 3 | 4 }) {
  const styles =
    rank === 3
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

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
  const [leadAudits, setLeadAudits] = useState<LeadAuditMap>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await requestLeads(rankFilter, categoryFilter);
        if (!cancelled) setLeads(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load leads');
          setLeads([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rankFilter, categoryFilter]);

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
      setError(err instanceof Error ? err.message : 'Discovery failed');
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

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    }
  };

  const handleAnalyze = async (lead: Lead) => {
    if (!lead.website_url) return;

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
      setAnalyzeState((prev) => ({ ...prev, [lead.id]: 'error' }));
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
  };

  return (
    <main className="flex-1 bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem]">
          <div className="space-y-8 min-w-0">
        <header className="space-y-3 border-b border-slate-800 pb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            London Lead Pipeline — Rank 3 &amp; 4 Prospects
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-3xl leading-relaxed">
            Businesses ranking 3rd or 4th for local keywords are one optimisation push from the top — high-intent
            prospects where CRO and SEO changes can move the needle fast.
          </p>
          <Link
            href="/seo-guide"
            className="inline-flex min-h-11 items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            Full SEO Guide →
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
            <p className="text-sm text-slate-400 mb-1">Total leads</p>
            <p className="text-3xl font-bold tabular-nums">{isLoading ? '…' : stats.total}</p>
          </article>
          <article className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
            <p className="text-sm text-slate-400 mb-1">Rank #3</p>
            <p className="text-3xl font-bold text-emerald-300 tabular-nums">{isLoading ? '…' : stats.rank3}</p>
          </article>
          <article className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
            <p className="text-sm text-slate-400 mb-1">Rank #4</p>
            <p className="text-3xl font-bold text-amber-300 tabular-nums">{isLoading ? '…' : stats.rank4}</p>
          </article>
          <article className="p-5 rounded-xl border border-slate-800 bg-slate-900/50">
            <p className="text-sm text-slate-400 mb-1">With suggestions</p>
            <p className="text-3xl font-bold tabular-nums">{isLoading ? '…' : stats.withRecs}</p>
          </article>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleDiscover}
            disabled={isDiscovering}
            className="inline-flex min-h-11 items-center px-5 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60 transition-colors"
          >
            {isDiscovering ? 'Running discovery…' : 'Run Discovery'}
          </button>
          {/* API download endpoint — not a navigable page */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/leads/export"
            className="inline-flex min-h-11 items-center px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800/60 text-sm font-medium transition-colors"
          >
            Export JSON
          </a>

          <select
            value={rankFilter}
            onChange={(e) => {
              setIsLoading(true);
              setRankFilter(e.target.value as 'all' | '3' | '4');
            }}
            className="min-h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm"
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
            className="min-h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm"
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
          <p className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</p>
        )}

        <section className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/80 text-left text-slate-400 border-b border-slate-800">
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
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Loading leads…
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No leads yet. Click &quot;Run Discovery&quot; to seed 30 London prospects.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const isExpanded = expandedId === lead.id;
                    const practices = getMatchingPractices(lead, 3);
                    const hasSuggestions = Boolean(lead.recommendation) || practices.length > 0;
                    return (
                      <Fragment key={lead.id}>
                        <tr className="border-b border-slate-800/80 hover:bg-slate-900/30">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{lead.business_name}</div>
                            {lead.website_url ? (
                              <a
                                href={lead.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-400 hover:underline"
                              >
                                Website
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500">No website</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-300 capitalize">{lead.category ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-400">{lead.keyword}</td>
                          <td className="px-4 py-3">
                            <RankBadge rank={lead.rank_position} />
                          </td>
                          <td className="px-4 py-3 text-slate-300">{lead.location}</td>
                          <td className="px-4 py-3 tabular-nums text-slate-300">{lead.lead_score}</td>
                          <td className="px-4 py-3">
                            <select
                              value={lead.status}
                              onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs"
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
                            {hasSuggestions ? (
                              <button
                                type="button"
                                onClick={() => void handleToggleExpand(lead.id)}
                                className="block text-xs font-medium text-blue-300 hover:text-blue-200 underline underline-offset-2"
                              >
                                {isExpanded ? 'Hide' : 'Suggested actions'}
                              </button>
                            ) : leadAudits[lead.id] ? (
                              <button
                                type="button"
                                onClick={() => void handleToggleExpand(lead.id)}
                                className="block text-xs font-medium text-violet-300 hover:text-violet-200 underline underline-offset-2"
                              >
                                {isExpanded ? 'Hide' : 'Social presence'}
                              </button>
                            ) : (
                              <span className="block text-xs text-slate-500">—</span>
                            )}
                            {lead.website_url && (
                              <div className="flex flex-col gap-1">
                                {leadAudits[lead.id] ? (
                                  <Link
                                    href={`/research/${leadAudits[lead.id].auditId}`}
                                    className="text-xs font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                                  >
                                    View audit
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAnalyze(lead)}
                                    disabled={analyzeState[lead.id] === 'loading'}
                                    className="text-xs font-medium text-violet-300 hover:text-violet-200 underline underline-offset-2 disabled:opacity-60 text-left"
                                  >
                                    {analyzeState[lead.id] === 'loading'
                                      ? 'Analyzing…'
                                      : analyzeState[lead.id] === 'error'
                                        ? 'Retry analyze'
                                        : 'Analyze'}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (hasSuggestions || leadAudits[lead.id]) && (
                          <tr className="bg-slate-900/50 border-b border-slate-800">
                            <td colSpan={8} className="px-4 py-4 space-y-4">
                              {lead.recommendation && (
                                <div>
                                  <p className="text-xs font-semibold text-blue-300 mb-1">
                                    Tailored suggestion
                                  </p>
                                  <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                                    {lead.recommendation}
                                  </p>
                                </div>
                              )}
                              {practices.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-emerald-300 mb-2">
                                    SEO best practices
                                  </p>
                                  <ul className="space-y-2 max-w-4xl">
                                    {practices.map((p) => (
                                      <li
                                        key={p.id}
                                        className="text-sm text-slate-300 leading-relaxed"
                                      >
                                        <span className="font-medium text-white">{p.title}</span>
                                        <span className="text-slate-500"> ({p.category})</span>
                                        {' — '}
                                        {p.description}
                                        <span className="block text-xs text-slate-500 mt-0.5">
                                          Source: {p.source}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                  <Link
                                    href="/seo-guide"
                                    className="inline-block mt-2 text-xs text-emerald-400 hover:underline"
                                  >
                                    View full SEO guide
                                  </Link>
                                </div>
                              )}
                              {lead.address && (
                                <p className="text-xs text-slate-500">{lead.address}</p>
                              )}
                              {(socialByLead[lead.id] || socialLoadingId === lead.id || leadAudits[lead.id]) && (
                                <div>
                                  <p className="text-xs font-semibold text-violet-300 mb-2">
                                    Social &amp; directory presence
                                  </p>
                                  {socialLoadingId === lead.id ? (
                                    <p className="text-xs text-slate-500">Loading social summary…</p>
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
                                    <p className="text-xs text-slate-500">No social profile data in audit.</p>
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
        </section>

        <p className="text-sm text-slate-500">
          Demo mode loads 30 seeded London businesses when no SerpAPI key is set.{' '}
          <Link href="/seo-guide" className="text-emerald-400 hover:underline">
            SEO best practices guide
          </Link>
          {' · '}
          <Link href="/dashboard" className="text-emerald-400 hover:underline">
            Activity dashboard
          </Link>
        </p>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start space-y-4">
            <SeoBestPracticesPanel compact defaultOpen={false} />
            <p className="text-xs text-slate-500 leading-relaxed px-1">
              Expand a lead&apos;s suggested actions to see 2–3 matching practices from this list.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
