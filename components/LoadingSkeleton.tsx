export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-800/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden" aria-busy="true" aria-label="Loading">
      <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} className="h-4 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-slate-800/80">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={row} className="px-4 py-4 flex gap-4">
            {Array.from({ length: cols }).map((_, col) => (
              <SkeletonLine key={col} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 3, cols = 3 }: { count?: number; cols?: number }) {
  const gridClass =
    cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : cols === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';

  return (
    <div className={`grid gap-4 ${gridClass}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
          <SkeletonLine className="h-3 w-24" />
          <SkeletonLine className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading report">
      <div className="space-y-3">
        <SkeletonLine className="h-8 w-2/3 max-w-md" />
        <SkeletonLine className="h-4 w-1/2 max-w-xs" />
      </div>
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
        <SkeletonLine className="h-16 w-16 rounded-full" />
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-5/6" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg border border-slate-800 space-y-2">
            <SkeletonLine className="h-4 w-1/3" />
            <SkeletonLine className="h-3 w-full" />
            <SkeletonLine className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
