import { getGooglePageSpeedApiKey } from '@/lib/env';
import { recordApiUsage } from '@/lib/cost/tracker';

export interface PageSpeedMetrics {
  url: string;
  strategy: 'mobile' | 'desktop';
  performanceScore: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  skipped: boolean;
  reason?: string;
}

interface LighthouseAudit {
  numericValue?: number;
  displayValue?: string;
}

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: {
      performance?: { score?: number | null };
    };
    audits?: Record<string, LighthouseAudit>;
  };
  error?: { message?: string };
}

function parseAuditValue(audits: Record<string, LighthouseAudit> | undefined, id: string): number | null {
  const value = audits?.[id]?.numericValue;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function fetchPageSpeedMetrics(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile'
): Promise<PageSpeedMetrics> {
  const apiKey = getGooglePageSpeedApiKey();

  if (!apiKey) {
    return {
      url,
      strategy,
      performanceScore: null,
      lcpMs: null,
      cls: null,
      inpMs: null,
      skipped: true,
      reason: 'GOOGLE_PAGESPEED_API_KEY not configured',
    };
  }

  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);
  endpoint.searchParams.set('category', 'performance');
  endpoint.searchParams.set('key', apiKey);

  try {
    const response = await fetch(endpoint.toString(), {
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      return {
        url,
        strategy,
        performanceScore: null,
        lcpMs: null,
        cls: null,
        inpMs: null,
        skipped: true,
        reason: `PageSpeed API returned ${response.status}`,
      };
    }

    const data = (await response.json()) as PageSpeedApiResponse;

    await recordApiUsage({
      provider: 'pagespeed',
      operation: 'runPagespeed',
      units: 1,
      metadata: { url, strategy },
    });

    if (data.error?.message) {
      return {
        url,
        strategy,
        performanceScore: null,
        lcpMs: null,
        cls: null,
        inpMs: null,
        skipped: true,
        reason: data.error.message,
      };
    }

    const audits = data.lighthouseResult?.audits;
    const rawScore = data.lighthouseResult?.categories?.performance?.score;

    return {
      url,
      strategy,
      performanceScore: typeof rawScore === 'number' ? Math.round(rawScore * 100) : null,
      lcpMs: parseAuditValue(audits, 'largest-contentful-paint'),
      cls: parseAuditValue(audits, 'cumulative-layout-shift'),
      inpMs: parseAuditValue(audits, 'interaction-to-next-paint'),
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PageSpeed request failed';
    return {
      url,
      strategy,
      performanceScore: null,
      lcpMs: null,
      cls: null,
      inpMs: null,
      skipped: true,
      reason: message,
    };
  }
}

export function formatPageSpeedMetrics(metrics: PageSpeedMetrics): string {
  if (metrics.skipped) {
    return metrics.reason ?? 'PageSpeed check skipped';
  }

  const parts = [
    metrics.performanceScore != null ? `Performance ${metrics.performanceScore}/100` : null,
    metrics.lcpMs != null ? `LCP ${(metrics.lcpMs / 1000).toFixed(1)}s` : null,
    metrics.cls != null ? `CLS ${metrics.cls.toFixed(3)}` : null,
    metrics.inpMs != null ? `INP ${Math.round(metrics.inpMs)}ms` : null,
  ].filter(Boolean);

  return parts.join(' · ') || 'No Core Web Vitals data';
}

export function extractPageSpeedFromTrace(
  toolTrace: Array<{ toolName: string; output: unknown }>
): PageSpeedMetrics | null {
  for (let i = toolTrace.length - 1; i >= 0; i -= 1) {
    const entry = toolTrace[i];
    if (entry.toolName !== 'check_page_speed') continue;

    const output = entry.output as { metrics?: PageSpeedMetrics } | null;
    if (output?.metrics && typeof output.metrics === 'object') {
      return output.metrics;
    }
  }

  return null;
}
