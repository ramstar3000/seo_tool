'use client';

import type { SocialProfileStatus } from '@/lib/research/types';

export interface SocialProfileDisplay {
  platform_id: string;
  platform_name: string;
  status: SocialProfileStatus;
  profile_url: string | null;
  bio_text?: string | null;
}

export interface SocialInconsistencyDisplay {
  type: string;
  description: string;
  recommendation?: string;
  severity?: string;
}

interface SocialPresencePanelProps {
  profiles: SocialProfileDisplay[];
  inconsistencies: SocialInconsistencyDisplay[];
  searched: boolean;
  compact?: boolean;
}

function statusStyles(status: SocialProfileStatus): string {
  switch (status) {
    case 'found':
      return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
    case 'missing':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'error':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50';
  }
}

function statusLabel(status: SocialProfileStatus): string {
  switch (status) {
    case 'found':
      return 'Found';
    case 'missing':
      return 'Missing';
    case 'error':
      return 'Error';
    default:
      return 'Not searched';
  }
}

export function SocialPresencePanel({
  profiles,
  inconsistencies,
  searched,
  compact = false,
}: SocialPresencePanelProps) {
  const foundCount = profiles.filter((p) => p.status === 'found').length;
  const missingCount = profiles.filter((p) => p.status === 'missing').length;

  if (profiles.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No social presence data. Run a research audit to check directory profiles.
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <span>{foundCount} found</span>
        <span aria-hidden>·</span>
        <span>{missingCount} missing</span>
        {!searched && (
          <>
            <span aria-hidden>·</span>
            <span className="text-zinc-500">SerpAPI not used — checklist only</span>
          </>
        )}
      </div>

      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'gap-3'}`}>
        {profiles.map((profile) => (
          <div
            key={profile.platform_id}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${statusStyles(profile.status)}`}
          >
            <span>{profile.platform_name}</span>
            <span className="opacity-70">{statusLabel(profile.status)}</span>
            {profile.profile_url && (
              <a
                href={profile.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                ↗
              </a>
            )}
          </div>
        ))}
      </div>

      {!compact &&
        profiles
          .filter((p) => p.bio_text && p.status === 'found')
          .slice(0, 4)
          .map((p) => (
            <div key={`bio-${p.platform_id}`} className="text-xs text-zinc-400">
              <span className="text-zinc-300 font-medium">{p.platform_name}:</span>{' '}
              {p.bio_text!.slice(0, 160)}
              {p.bio_text!.length > 160 ? '…' : ''}
            </div>
          ))}

      {inconsistencies.length > 0 && (
        <div className="space-y-2">
          <p className={`font-semibold text-amber-300 ${compact ? 'text-xs' : 'text-sm'}`}>
            Consistency warnings
          </p>
          <ul className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
            {inconsistencies.map((issue, i) => (
              <li
                key={`${issue.type}-${i}`}
                className="text-zinc-300 leading-relaxed pl-3 border-l-2 border-amber-500/40"
              >
                {issue.description}
                {issue.recommendation && !compact && (
                  <span className="block text-xs text-zinc-500 mt-0.5">{issue.recommendation}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
