import type { ReactNode } from 'react';

export const formInputClass =
  'w-full min-h-11 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-3.5 text-white placeholder:text-zinc-500 focus:border-teal-500/40 focus:outline-none focus:ring-2 focus:ring-teal-500/20';

export function PageContainer({
  children,
  className = '',
  narrow = false,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  narrow?: boolean;
  wide?: boolean;
}) {
  const maxWidth = narrow ? 'max-w-2xl' : wide ? 'max-w-6xl' : 'max-w-5xl';

  return (
    <div className={`mx-auto w-full px-4 sm:px-6 ${maxWidth} ${className}`}>
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  align = 'center',
}: {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={`space-y-2 mb-10 ${align === 'center' ? 'text-center mx-auto max-w-2xl' : ''}`}>
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{title}</h2>
      {subtitle && <p className="text-zinc-400 text-base leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export function SurfaceCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}
