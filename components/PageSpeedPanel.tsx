interface PageSpeedPanelProps {
  pageSpeed: {
    url: string;
    strategy: string;
    performanceScore: number | null;
    lcpMs: number | null;
    cls: number | null;
    inpMs: number | null;
    skipped: boolean;
    reason?: string;
  } | null;
}

function metricClass(value: number | null, good: number, poor: number, invert = false): string {
  if (value == null) return 'text-slate-400';
  const isGood = invert ? value >= good : value <= good;
  const isPoor = invert ? value < poor : value > poor;
  if (isGood) return 'text-emerald-400';
  if (isPoor) return 'text-red-300';
  return 'text-amber-300';
}

export function PageSpeedPanel({ pageSpeed }: PageSpeedPanelProps) {
  if (!pageSpeed) {
    return (
      <p className="text-sm text-slate-500">
        Core Web Vitals were not measured for this audit.
      </p>
    );
  }

  if (pageSpeed.skipped) {
    return (
      <p className="text-sm text-slate-500">
        {pageSpeed.reason ?? 'PageSpeed check skipped (set GOOGLE_PAGESPEED_API_KEY to enable).'}
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
      <div>
        <dt className="text-slate-500">Performance</dt>
        <dd className={`font-semibold ${metricClass(pageSpeed.performanceScore, 90, 50, true)}`}>
          {pageSpeed.performanceScore ?? '—'}/100
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">LCP</dt>
        <dd className={`font-semibold ${metricClass(pageSpeed.lcpMs, 2500, 4000)}`}>
          {pageSpeed.lcpMs != null ? `${(pageSpeed.lcpMs / 1000).toFixed(1)}s` : '—'}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">CLS</dt>
        <dd className={`font-semibold ${metricClass(pageSpeed.cls, 0.1, 0.25)}`}>
          {pageSpeed.cls != null ? pageSpeed.cls.toFixed(3) : '—'}
        </dd>
      </div>
      <div>
        <dt className="text-slate-500">INP</dt>
        <dd className={`font-semibold ${metricClass(pageSpeed.inpMs, 200, 500)}`}>
          {pageSpeed.inpMs != null ? `${Math.round(pageSpeed.inpMs)}ms` : '—'}
        </dd>
      </div>
    </dl>
  );
}
