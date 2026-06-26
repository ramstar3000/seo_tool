'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SurfaceCard } from '@/components/ui/PageContainer';
import type { AuditFixPack } from '@/lib/fix-pack/types';
import { fixPackToChecklistMarkdown } from '@/lib/fix-pack/checklist-export';

type FixPackTab = 'overview' | 'copy' | 'diff' | 'schema' | 'playbooks' | 'checklist' | 'offpage';

interface FixPackPanelProps {
  auditId: string;
  businessName: string;
  /** When true, emphasize this is the primary delivery path (no GitHub repo). */
  noCodePrimary?: boolean;
}

const TABS: Array<{ id: FixPackTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'copy', label: 'Copy & paste' },
  { id: 'diff', label: 'Before / after' },
  { id: 'schema', label: 'Schema' },
  { id: 'playbooks', label: 'Playbooks' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'offpage', label: 'Off-page' },
];

function EffortBadge({ effort }: { effort: string }) {
  const styles =
    effort === 'quick'
      ? 'bg-teal-500/10 text-teal-300 border-teal-500/25'
      : effort === 'medium'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
        : 'bg-white/[0.04] text-zinc-400 border-white/[0.08]';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-xs capitalize ${styles}`}>
      {effort}
    </span>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex min-h-8 items-center px-3 rounded-lg border border-white/[0.1] bg-white/[0.04] text-xs font-medium text-zinc-300 hover:bg-white/[0.08] transition-colors"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

export function FixPackPanel({ auditId, businessName, noCodePrimary = false }: FixPackPanelProps) {
  const [fixPack, setFixPack] = useState<AuditFixPack | null>(null);
  const [status, setStatus] = useState<'loading' | 'missing' | 'pending' | 'completed' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FixPackTab>('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const loadFixPack = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/research/${auditId}/fix-pack`);
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to load fix pack');
      }
      const body = (await response.json()) as {
        fixPack: AuditFixPack | null;
        status: string;
        error?: string | null;
      };

      if (body.status === 'pending') {
        setStatus('pending');
        setFixPack(null);
        return;
      }

      if (body.status === 'failed') {
        setStatus('failed');
        setError(body.error ?? 'Fix pack generation failed');
        setFixPack(null);
        return;
      }

      if (body.fixPack && Object.keys(body.fixPack).length > 0) {
        setFixPack(body.fixPack);
        setStatus('completed');
      } else {
        setFixPack(null);
        setStatus('missing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fix pack');
      setStatus('failed');
    }
  }, [auditId]);

  useEffect(() => {
    void loadFixPack();
  }, [loadFixPack]);

  useEffect(() => {
    if (status !== 'pending') return;
    const timer = setInterval(() => void loadFixPack(), 8000);
    return () => clearInterval(timer);
  }, [status, loadFixPack]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/research/${auditId}/fix-pack`, { method: 'POST' });
      const body = (await response.json()) as { fixPack?: AuditFixPack; error?: string };
      if (!response.ok || !body.fixPack) {
        throw new Error(body.error ?? 'Generation failed');
      }
      setFixPack(body.fixPack);
      setStatus('completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const checklistMarkdown = useMemo(
    () => (fixPack ? fixPackToChecklistMarkdown(fixPack, businessName) : ''),
    [fixPack, businessName]
  );

  const handleDownloadChecklist = () => {
    if (!checklistMarkdown) return;
    const blob = new Blob([checklistMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${businessName.replace(/\s+/g, '-').toLowerCase()}-seo-checklist.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintChecklist = () => {
    if (!fixPack) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const items = fixPack.checklist
      .map(
        (item) =>
          `<li style="margin-bottom:12px;"><strong>${item.title}</strong> (${item.effort})<br/>${item.description}</li>`
      )
      .join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>SEO Checklist — ${businessName}</title></head><body style="font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto;">
      <h1>SEO Fix Checklist — ${businessName}</h1>
      <p><strong>Platform:</strong> ${fixPack.platformLabel}</p>
      <p>${fixPack.summary}</p>
      <h2>Tasks</h2>
      <ul style="padding-left:20px;line-height:1.5;">${items}</ul>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (status === 'loading') {
    return (
      <div id="fix-pack">
      <SurfaceCard className="p-5 sm:p-6 space-y-3">
        <p className="text-sm text-zinc-400">Loading fix pack…</p>
      </SurfaceCard>
      </div>
    );
  }

  if (status === 'missing' || status === 'failed') {
    return (
      <div id="fix-pack">
      <SurfaceCard
        className={`p-5 sm:p-6 space-y-4 ${noCodePrimary ? 'border-violet-500/25 bg-violet-500/[0.04]' : 'border-white/[0.08]'}`}
      >
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-white">
            {noCodePrimary ? 'Fix pack — apply in your builder' : 'Fix pack'}
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {noCodePrimary
              ? 'No GitHub repo needed. Generate copy-paste values, platform playbooks, schema snippets, and a printable checklist from this audit.'
              : 'Generate copy-paste SEO fixes, platform playbooks, and a checklist — useful when you cannot open a pull request.'}
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          className="inline-flex min-h-10 items-center px-5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors"
        >
          {isGenerating ? 'Generating fix pack…' : 'Generate fix pack'}
        </button>
      </SurfaceCard>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div id="fix-pack">
      <SurfaceCard className="p-5 sm:p-6 space-y-3 border-violet-500/20 bg-violet-500/[0.03]">
        <div className="flex items-center gap-2 text-violet-200">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" aria-hidden="true" />
          <p className="font-medium text-sm">Generating fix pack…</p>
        </div>
        <p className="text-sm text-zinc-400">Copy-paste values, playbooks, and checklist — usually ready in under a minute.</p>
      </SurfaceCard>
      </div>
    );
  }

  if (!fixPack) return null;

  return (
    <div id="fix-pack">
    <SurfaceCard
      className={`overflow-hidden ${noCodePrimary ? 'border-violet-500/25 bg-violet-500/[0.03]' : ''}`}
    >
      <div className="p-5 sm:p-6 space-y-4 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-white">Fix pack</h2>
              <span className="inline-flex px-2 py-0.5 rounded-md text-xs bg-violet-500/10 text-violet-300 border border-violet-500/25">
                {fixPack.platformLabel}
              </span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{fixPack.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={isGenerating}
            className="inline-flex min-h-9 items-center px-3 rounded-lg border border-white/[0.1] text-xs font-medium text-zinc-300 hover:bg-white/[0.06] disabled:opacity-60"
          >
            {isGenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Fix pack sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex min-h-9 items-center px-3 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-4 text-sm text-zinc-300">
            <p>
              Apply these fixes in <strong className="text-white">{fixPack.platformLabel}</strong>
              {fixPack.platformSupportsCodeInjection
                ? ' — including custom code for schema snippets.'
                : ' — use the builder SEO settings for each item.'}
            </p>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <dt className="text-violet-300 font-medium">{fixPack.copyPaste.length}</dt>
                <dd className="text-zinc-400 mt-1">Copy-paste values</dd>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <dt className="text-violet-300 font-medium">{fixPack.playbooks.length}</dt>
                <dd className="text-zinc-400 mt-1">Platform playbooks</dd>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <dt className="text-violet-300 font-medium">{fixPack.schemaSnippets.length}</dt>
                <dd className="text-zinc-400 mt-1">Schema snippets</dd>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <dt className="text-violet-300 font-medium">{fixPack.checklist.length}</dt>
                <dd className="text-zinc-400 mt-1">Checklist items</dd>
              </div>
            </dl>
          </div>
        )}

        {activeTab === 'copy' && (
          <div className="space-y-4">
            {fixPack.copyPaste.length === 0 ? (
              <p className="text-sm text-zinc-500">No copy-paste items generated.</p>
            ) : (
              fixPack.copyPaste.map((item, i) => (
                <div key={`${item.field}-${i}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-white capitalize">{item.field.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-zinc-500 break-all">{item.pageUrl}</p>
                    </div>
                    <CopyButton text={item.recommended} label="Copy recommended" />
                  </div>
                  {item.current && (
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Current</p>
                      <p className="text-sm text-zinc-400">{item.current}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-teal-400/80 mb-1">Recommended</p>
                    <p className="text-sm text-zinc-200">{item.recommended}</p>
                  </div>
                  {item.notes && <p className="text-xs text-zinc-500">{item.notes}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'diff' && (
          <div className="space-y-4">
            {fixPack.diffs.length === 0 ? (
              <p className="text-sm text-zinc-500">No before/after diffs generated.</p>
            ) : (
              fixPack.diffs.map((diff, i) => (
                <div key={`${diff.field}-${i}`} className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white capitalize">{diff.field.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-zinc-500 break-all">{diff.pageUrl}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
                    <div className="p-4 space-y-1">
                      <p className="text-xs font-medium text-red-300/80">Before</p>
                      <p className="text-sm text-zinc-400 whitespace-pre-wrap">{diff.before || '(empty)'}</p>
                    </div>
                    <div className="p-4 space-y-1">
                      <p className="text-xs font-medium text-teal-300/80">After</p>
                      <p className="text-sm text-zinc-200 whitespace-pre-wrap">{diff.after}</p>
                    </div>
                  </div>
                  <p className="px-4 py-2 text-xs text-zinc-500 border-t border-white/[0.06]">{diff.rationale}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="space-y-4">
            {!fixPack.platformSupportsCodeInjection && (
              <p className="text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                This platform may have limited custom code support. Check your builder&apos;s site settings for a Head
                or Custom code section.
              </p>
            )}
            {fixPack.schemaSnippets.length === 0 ? (
              <p className="text-sm text-zinc-500">No schema snippets generated.</p>
            ) : (
              fixPack.schemaSnippets.map((snippet, i) => (
                <div key={`${snippet.name}-${i}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{snippet.name}</p>
                      <p className="text-sm text-zinc-400 mt-1">{snippet.description}</p>
                      <p className="text-xs text-violet-300/80 mt-2">{snippet.injectionPoint}</p>
                    </div>
                    <CopyButton text={snippet.jsonLd} label="Copy JSON-LD" />
                  </div>
                  <pre className="text-xs text-zinc-300 bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {snippet.jsonLd}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'playbooks' && (
          <div className="space-y-4">
            {fixPack.playbooks.length === 0 ? (
              <p className="text-sm text-zinc-500">No playbooks generated.</p>
            ) : (
              fixPack.playbooks.map((playbook, i) => (
                <div key={`${playbook.findingTitle}-${i}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{playbook.findingTitle}</p>
                    <EffortBadge effort={playbook.effort} />
                  </div>
                  <ol className="space-y-2 list-decimal list-inside text-sm text-zinc-300">
                    {playbook.steps
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((step) => (
                        <li key={step.order} className="leading-relaxed">
                          {step.instruction}
                        </li>
                      ))}
                  </ol>
                  {playbook.copyPaste && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
                      <p className="text-xs text-zinc-500 flex-1">{playbook.copyPaste}</p>
                      <CopyButton text={playbook.copyPaste} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadChecklist}
                className="inline-flex min-h-9 items-center px-3 rounded-lg border border-white/[0.1] text-xs font-medium text-zinc-300 hover:bg-white/[0.06]"
              >
                Download .md
              </button>
              <button
                type="button"
                onClick={handlePrintChecklist}
                className="inline-flex min-h-9 items-center px-3 rounded-lg border border-white/[0.1] text-xs font-medium text-zinc-300 hover:bg-white/[0.06]"
              >
                Print checklist
              </button>
            </div>
            <ul className="space-y-2">
              {fixPack.checklist.map((item) => (
                <li key={item.id}>
                  <label className="flex gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 cursor-pointer hover:bg-white/[0.04]">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(item.id)}
                      onChange={() => toggleCheck(item.id)}
                      className="mt-1 shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white text-sm">{item.title}</span>
                        <EffortBadge effort={item.effort} />
                        <span className="text-xs text-zinc-500 capitalize">{item.category.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-sm text-zinc-400">{item.description}</p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'offpage' && (
          <div className="space-y-4">
            {fixPack.offPageActions.length === 0 ? (
              <p className="text-sm text-zinc-500">No off-page actions generated.</p>
            ) : (
              fixPack.offPageActions.map((action, i) => (
                <div key={`${action.title}-${i}`} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-white">{action.title}</p>
                    {action.platform && (
                      <span className="text-xs text-zinc-500">{action.platform}</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">{action.description}</p>
                  {action.template && (
                    <div className="flex flex-wrap items-start gap-2 pt-2">
                      <p className="text-sm text-zinc-300 flex-1 whitespace-pre-wrap">{action.template}</p>
                      <CopyButton text={action.template} label="Copy template" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </SurfaceCard>
    </div>
  );
}
