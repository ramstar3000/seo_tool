import { SurfaceCard } from '@/components/ui/PageContainer';

export function ResearchTierGuide({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-sm text-zinc-400 leading-relaxed">
        <span className="text-sky-300 font-medium">Light research</span> — rank + competitors (auto on{' '}
        <strong className="font-medium text-zinc-300">Find leads</strong>).{' '}
        <span className="text-teal-300 font-medium">Full audit</span> — agent scrape, social, PageSpeed (
        <strong className="font-medium text-zinc-300">Run full audit</strong> on a lead).
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SurfaceCard className="p-4 sm:p-5 space-y-2 border-sky-500/25 bg-sky-500/[0.04]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/25">
            Light research
          </span>
          <span className="text-xs text-zinc-500">~30 sec · no LLM</span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Quick SERP scan: where they rank, who is #1, outreach hook, and MUST_DO bullets.
        </p>
        <p className="text-xs text-sky-200/90">
          How to run: click <strong className="font-medium">Find leads</strong> — runs automatically on each new lead.
        </p>
      </SurfaceCard>

      <SurfaceCard className="p-4 sm:p-5 space-y-2 border-teal-500/25 bg-teal-500/[0.04]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-teal-500/10 text-teal-300 border border-teal-500/25">
            Full audit
          </span>
          <span className="text-xs text-zinc-500">1–3 min · Gemini agent</span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Detailed analysis: page scrape, messaging, social profiles, PageSpeed, findings, and optional auto-PR.
        </p>
        <p className="text-xs text-teal-200/90">
          How to run: on a lead row, click <strong className="font-medium">Run full audit</strong> in Actions.
        </p>
      </SurfaceCard>
    </div>
  );
}
