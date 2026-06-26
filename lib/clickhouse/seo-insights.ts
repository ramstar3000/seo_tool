import { formatClickHouseDateTime64, getClickHouseClient } from '@/lib/clickhouse/client';
import { recordAgentLoopEvent } from '@/lib/clickhouse/agent-loop';
import { traceResearchAudit } from '@/lib/langfuse/trace-llm';
import { flushLangfuseSpans } from '@/lib/langfuse/otel';
import { ensureClickHouseSchema } from '@/lib/clickhouse/schema';
import type { AuditFinding, SiteAudit } from '@/lib/research/types';

const DESCRIPTION_MAX = 500;
const SNIPPET_MAX = 800;

export interface RecordAuditInsightsParams {
  auditId: string;
  audit: Omit<SiteAudit, 'id' | 'created_at'>;
  findings: AuditFinding[];
  rankPosition?: number | null;
  lcpMs?: number | null;
  competitorCount?: number | null;
}

export interface SeoPromptContext {
  source: 'clickhouse' | 'none';
  auditCount: number;
  findingCount: number;
  criticalByCategory: Record<string, number>;
  warningByCategory: Record<string, number>;
  rankHistory: Array<{ completedAt: string; rankPosition: number | null }>;
  recurringFindings: Array<{ title: string; count: number; category: string }>;
  latestSummary: string | null;
  latestRecommendations: string | null;
  trendSummary: string | null;
  persistentFindings: Array<{
    title: string;
    category: string;
    severity: string;
    auditCount: number;
    daysPersisting: number;
  }>;
  promptBlock: string;
}

export interface PersistentFinding {
  title: string;
  category: string;
  severity: string;
  auditCount: number;
  daysPersisting: number;
  firstSeen: string;
  lastSeen: string;
}

export interface SeoInsightMetrics {
  source: 'clickhouse' | 'none';
  auditCount: number;
  findingCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  byCategory: Array<{ category: string; critical: number; warning: number; info: number }>;
  recentFindings: Array<{ title: string; severity: string; category: string; completedAt: string }>;
  persistentFindings: Array<{
    title: string;
    category: string;
    severity: string;
    auditCount: number;
    daysPersisting: number;
  }>;
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function countBySeverity(findings: AuditFinding[]): {
  critical: number;
  warning: number;
  info: number;
} {
  return findings.reduce(
    (acc, f) => {
      if (f.severity === 'critical') acc.critical += 1;
      else if (f.severity === 'warning') acc.warning += 1;
      else acc.info += 1;
      return acc;
    },
    { critical: 0, warning: 0, info: 0 }
  );
}

export async function recordAuditInsights(params: RecordAuditInsightsParams): Promise<void> {
  const client = getClickHouseClient();
  if (!client) return;

  const ready = await ensureClickHouseSchema();
  if (!ready) return;

  const { auditId, audit, findings, rankPosition, lcpMs, competitorCount } = params;
  const completedAt = formatClickHouseDateTime64(
    audit.completed_at ? new Date(audit.completed_at) : new Date(),
  );
  const severityCounts = countBySeverity(findings);

  const rows: Record<string, unknown>[] = [
    {
      event_type: 'audit_summary',
      audit_id: auditId,
      lead_id: audit.lead_id ?? null,
      business_name: audit.business_name,
      keyword: audit.keyword,
      target_url: audit.target_url,
      rank_position: rankPosition ?? null,
      lcp_ms: lcpMs ?? null,
      competitor_count: competitorCount ?? null,
      severity: '',
      category: '',
      title: '',
      description: '',
      critical_count: severityCounts.critical,
      warning_count: severityCounts.warning,
      info_count: severityCounts.info,
      finding_count: findings.length,
      summary_snippet: truncate(audit.summary, SNIPPET_MAX),
      recommendations_snippet: truncate(audit.recommendations, SNIPPET_MAX),
      completed_at: completedAt,
    },
    ...findings.map((f) => ({
      event_type: 'finding',
      audit_id: auditId,
      lead_id: audit.lead_id ?? null,
      business_name: audit.business_name,
      keyword: audit.keyword,
      target_url: audit.target_url,
      rank_position: rankPosition ?? null,
      lcp_ms: lcpMs ?? null,
      competitor_count: competitorCount ?? null,
      severity: f.severity,
      category: f.category,
      title: f.title,
      description: truncate(f.description, DESCRIPTION_MAX),
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
      finding_count: 0,
      summary_snippet: '',
      recommendations_snippet: '',
      completed_at: completedAt,
    })),
  ];

  try {
    await client.insert({
      table: 'seo_insight_events',
      values: rows,
      format: 'JSONEachRow',
    });
  } catch (error) {
    console.error('[clickhouse] failed to record SEO insight events:', error);
  }

  void recordAgentLoopEvent({
    loopType: 'audit_ingest',
    leadId: audit.lead_id,
    auditId,
    payload: {
      businessName: audit.business_name,
      keyword: audit.keyword,
      findingCount: findings.length,
    },
    metricsSnapshot: {
      rankPosition,
      lcpMs,
      critical: severityCounts.critical,
      warning: severityCounts.warning,
    },
  });

  await traceResearchAudit({
    auditId,
    leadId: audit.lead_id,
    businessName: audit.business_name,
    keyword: audit.keyword,
    targetUrl: audit.target_url,
    findings,
    summary: audit.summary,
    recommendations: audit.recommendations,
    toolTrace: audit.tool_trace,
    rankPosition: rankPosition ?? null,
    lcpMs: lcpMs ?? null,
    competitorCount: competitorCount ?? null,
  });

  await flushLangfuseSpans();
}

function buildWhereClause(params: {
  leadId?: string;
  auditId?: string;
  keyword?: string;
  days: number;
}): { clause: string; queryParams: Record<string, unknown> } {
  const conditions = ['completed_at >= now() - INTERVAL {days:UInt16} DAY'];
  const queryParams: Record<string, unknown> = { days: params.days };

  if (params.leadId) {
    conditions.push('lead_id = {leadId:UUID}');
    queryParams.leadId = params.leadId;
  }
  if (params.auditId) {
    conditions.push('audit_id = {auditId:UUID}');
    queryParams.auditId = params.auditId;
  }
  if (params.keyword) {
    conditions.push('keyword = {keyword:String}');
    queryParams.keyword = params.keyword;
  }

  return { clause: conditions.join(' AND '), queryParams };
}

function buildTrendSummary(params: {
  auditCount: number;
  recurringFindings: Array<{ title: string; count: number; category: string }>;
  criticalByCategory: Record<string, number>;
  warningByCategory: Record<string, number>;
  persistentFindings?: Array<{ title: string; severity: string; daysPersisting: number; auditCount: number }>;
}): string | null {
  const { auditCount, recurringFindings, criticalByCategory, warningByCategory, persistentFindings } =
    params;
  if (auditCount <= 1 && recurringFindings.length === 0 && !persistentFindings?.length) return null;

  const parts: string[] = [];

  const criticalPersistent = (persistentFindings ?? []).filter(
    (f) => f.severity === 'critical' && f.daysPersisting >= 7
  );
  if (criticalPersistent.length > 0) {
    const maxDays = Math.max(...criticalPersistent.map((f) => f.daysPersisting));
    const titles = criticalPersistent
      .slice(0, 3)
      .map((f) => f.title)
      .join('", "');
    parts.push(
      `${criticalPersistent.length} critical ${criticalPersistent.length === 1 ? 'issue' : 'issues'} persisting ${maxDays} days (e.g. "${titles}")`
    );
  }

  const persistent = recurringFindings.filter((f) => f.count >= 2);
  if (persistent.length > 0 && criticalPersistent.length === 0) {
    const top = persistent.slice(0, 3);
    const issueWord = persistent.length === 1 ? 'issue' : 'issues';
    parts.push(
      `${persistent.length} recurring ${issueWord} persisting across ${auditCount} audit${auditCount === 1 ? '' : 's'} (e.g. "${top[0]?.title}")`
    );
  }

  const technicalCritical = criticalByCategory.technical ?? 0;
  const technicalWarning = warningByCategory.technical ?? 0;
  const technicalTotal = technicalCritical + technicalWarning;
  if (technicalTotal > 0 && auditCount >= 2) {
    parts.push(
      `${technicalTotal} technical ${technicalTotal === 1 ? 'issue' : 'issues'} persisting across ${auditCount} re-audits`
    );
  }

  return parts.length > 0 ? parts.join('; ') : null;
}

function buildPromptBlock(
  context: Omit<SeoPromptContext, 'source' | 'promptBlock'>
): string {
  const lines: string[] = ['Historical SEO insight memory (ClickHouse):'];

  if (context.trendSummary) {
    lines.push(`Trend: ${context.trendSummary}`);
  }

  const criticalEntries = Object.entries(context.criticalByCategory).filter(([, n]) => n > 0);
  const warningEntries = Object.entries(context.warningByCategory).filter(([, n]) => n > 0);

  if (criticalEntries.length > 0) {
    lines.push(
      `Unresolved critical by category: ${criticalEntries.map(([cat, n]) => `${cat} (${n})`).join(', ')}`
    );
  }
  if (warningEntries.length > 0) {
    lines.push(
      `Unresolved warnings by category: ${warningEntries.map(([cat, n]) => `${cat} (${n})`).join(', ')}`
    );
  }

  if (context.rankHistory.length > 0) {
    const ranks = context.rankHistory
      .filter((r) => r.rankPosition !== null)
      .map((r) => `#${r.rankPosition}`)
      .join(' → ');
    if (ranks) lines.push(`Rank history: ${ranks}`);
  }

  if (context.recurringFindings.length > 0) {
    lines.push(
      'Top recurring findings:',
      ...context.recurringFindings
        .slice(0, 5)
        .map((f) => `- [${f.category}] ${f.title} (seen ${f.count}x)`)
    );
  }

  if (context.persistentFindings && context.persistentFindings.length > 0) {
    lines.push(
      'Issues persisting across re-audits:',
      ...context.persistentFindings
        .slice(0, 5)
        .map(
          (f) =>
            `- [${f.severity}/${f.category}] ${f.title} — ${f.daysPersisting} days, ${f.auditCount} audits`
        )
    );
  }

  if (context.latestSummary) {
    lines.push(`Latest audit summary: ${context.latestSummary}`);
  }
  if (context.latestRecommendations) {
    lines.push(`Latest recommendations: ${context.latestRecommendations}`);
  }

  return lines.join('\n');
}

const emptyContext = (): SeoPromptContext => ({
  source: 'none',
  auditCount: 0,
  findingCount: 0,
  criticalByCategory: {},
  warningByCategory: {},
  rankHistory: [],
  recurringFindings: [],
  latestSummary: null,
  latestRecommendations: null,
  trendSummary: null,
  persistentFindings: [],
  promptBlock: '',
});

export async function getPersistentFindings(days = 90): Promise<PersistentFinding[]> {
  const client = getClickHouseClient();
  if (!client) return [];

  const ready = await ensureClickHouseSchema();
  if (!ready) return [];

  try {
    const result = await client.query({
      query: `
        SELECT
          title,
          category,
          severity,
          count(DISTINCT audit_id) AS audit_count,
          min(completed_at) AS first_seen,
          max(completed_at) AS last_seen,
          dateDiff('day', min(completed_at), max(completed_at)) AS days_persisting
        FROM seo_insight_events
        WHERE event_type = 'finding'
          AND completed_at >= now() - INTERVAL {days:UInt16} DAY
        GROUP BY title, category, severity
        HAVING audit_count >= 2 OR days_persisting >= 7
        ORDER BY days_persisting DESC, audit_count DESC, severity ASC
        LIMIT 12
      `,
      query_params: { days },
      format: 'JSONEachRow',
    });

    const rows = (await result.json()) as {
      title: string;
      category: string;
      severity: string;
      audit_count: string;
      first_seen: string;
      last_seen: string;
      days_persisting: string;
    }[];

    return rows.map((row) => ({
      title: row.title,
      category: row.category,
      severity: row.severity,
      auditCount: Number(row.audit_count ?? 0),
      daysPersisting: Number(row.days_persisting ?? 0),
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    }));
  } catch (error) {
    console.error('[clickhouse] persistent findings query failed:', error);
    return [];
  }
}

export async function getSeoPromptContext(params: {
  leadId?: string;
  auditId?: string;
  keyword?: string;
  days?: number;
}): Promise<SeoPromptContext> {
  const client = getClickHouseClient();
  if (!client) return emptyContext();

  const ready = await ensureClickHouseSchema();
  if (!ready) return emptyContext();

  const days = params.days ?? 90;
  const { clause, queryParams } = buildWhereClause({ ...params, days });

  try {
    const [categoryRes, recurringRes, latestRes, rankRes, auditCountRes, persistentRes] =
      await Promise.all([
      client.query({
        query: `
          SELECT category, severity, count() AS cnt
          FROM seo_insight_events
          WHERE event_type = 'finding' AND ${clause}
          GROUP BY category, severity
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: `
          SELECT title, category, count() AS cnt
          FROM seo_insight_events
          WHERE event_type = 'finding' AND ${clause}
          GROUP BY title, category
          HAVING cnt >= 2
          ORDER BY cnt DESC
          LIMIT 8
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: `
          SELECT summary_snippet, recommendations_snippet, completed_at
          FROM seo_insight_events
          WHERE event_type = 'audit_summary' AND ${clause}
          ORDER BY completed_at DESC
          LIMIT 1
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: `
          SELECT rank_position, completed_at
          FROM seo_insight_events
          WHERE event_type = 'audit_summary' AND ${clause}
          ORDER BY completed_at ASC
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: `
          SELECT count(DISTINCT audit_id) AS audit_count
          FROM seo_insight_events
          WHERE event_type = 'audit_summary' AND ${clause}
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: `
          SELECT title, category, severity,
            count(DISTINCT audit_id) AS audit_count,
            dateDiff('day', min(completed_at), max(completed_at)) AS days_persisting
          FROM seo_insight_events
          WHERE event_type = 'finding' AND ${clause}
          GROUP BY title, category, severity
          HAVING audit_count >= 2 OR days_persisting >= 7
          ORDER BY days_persisting DESC
          LIMIT 8
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
    ]);

    const categoryRows = (await categoryRes.json()) as {
      category: string;
      severity: string;
      cnt: string;
    }[];
    const recurringRows = (await recurringRes.json()) as {
      title: string;
      category: string;
      cnt: string;
    }[];
    const latestRows = (await latestRes.json()) as {
      summary_snippet: string;
      recommendations_snippet: string;
      completed_at: string;
    }[];
    const rankRows = (await rankRes.json()) as {
      rank_position: string | null;
      completed_at: string;
    }[];
    const auditCountRows = (await auditCountRes.json()) as { audit_count: string }[];
    const persistentRows = (await persistentRes.json()) as {
      title: string;
      category: string;
      severity: string;
      audit_count: string;
      days_persisting: string;
    }[];

    const criticalByCategory: Record<string, number> = {};
    const warningByCategory: Record<string, number> = {};
    let findingCount = 0;

    for (const row of categoryRows) {
      const count = Number(row.cnt ?? 0);
      findingCount += count;
      if (row.severity === 'critical') {
        criticalByCategory[row.category] = (criticalByCategory[row.category] ?? 0) + count;
      } else if (row.severity === 'warning') {
        warningByCategory[row.category] = (warningByCategory[row.category] ?? 0) + count;
      }
    }

    const auditCount = Number(auditCountRows[0]?.audit_count ?? 0);
    const recurringFindings = recurringRows.map((r) => ({
      title: r.title,
      category: r.category,
      count: Number(r.cnt ?? 0),
    }));

    const latest = latestRows[0];
    const rankHistory = rankRows.map((r) => ({
      completedAt: r.completed_at,
      rankPosition: r.rank_position === null ? null : Number(r.rank_position),
    }));

    const persistentFindings = persistentRows.map((r) => ({
      title: r.title,
      category: r.category,
      severity: r.severity,
      auditCount: Number(r.audit_count ?? 0),
      daysPersisting: Number(r.days_persisting ?? 0),
    }));

    const trendSummary = buildTrendSummary({
      auditCount,
      recurringFindings,
      criticalByCategory,
      warningByCategory,
      persistentFindings,
    });

    const base = {
      auditCount,
      findingCount,
      criticalByCategory,
      warningByCategory,
      rankHistory,
      recurringFindings,
      latestSummary: latest?.summary_snippet || null,
      latestRecommendations: latest?.recommendations_snippet || null,
      trendSummary,
      persistentFindings,
    };

    return {
      source: 'clickhouse',
      ...base,
      promptBlock: buildPromptBlock(base),
    };
  } catch (error) {
    console.error('[clickhouse] failed to read SEO prompt context:', error);
    return emptyContext();
  }
}

export async function getSeoInsightMetrics(params: {
  leadId?: string;
  auditId?: string;
  keyword?: string;
  days?: number;
} = {}): Promise<SeoInsightMetrics> {
  const client = getClickHouseClient();
  const empty: SeoInsightMetrics = {
    source: 'none',
    auditCount: 0,
    findingCount: 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    byCategory: [],
    recentFindings: [],
    persistentFindings: [],
  };

  if (!client) return empty;

  const ready = await ensureClickHouseSchema();
  if (!ready) return empty;

  const days = params.days ?? 30;
  const { clause, queryParams } = buildWhereClause({ ...params, days });

  try {
    const [summaryRes, categoryRes, recentRes] = await Promise.all([
      client.query({
        query: `
          SELECT
            count(DISTINCT audit_id) AS audit_count,
            sum(critical_count) AS critical_count,
            sum(warning_count) AS warning_count,
            sum(info_count) AS info_count,
            sum(finding_count) AS finding_count
          FROM seo_insight_events
          WHERE event_type = 'audit_summary' AND ${clause}
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: `
          SELECT category, severity, count() AS cnt
          FROM seo_insight_events
          WHERE event_type = 'finding' AND ${clause}
          GROUP BY category, severity
          ORDER BY category
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
      client.query({
        query: `
          SELECT title, severity, category, completed_at
          FROM seo_insight_events
          WHERE event_type = 'finding' AND ${clause}
          ORDER BY completed_at DESC
          LIMIT 10
        `,
        query_params: queryParams,
        format: 'JSONEachRow',
      }),
    ]);

    const summaryRow = ((await summaryRes.json()) as Record<string, string>[])[0];
    const categoryRows = (await categoryRes.json()) as {
      category: string;
      severity: string;
      cnt: string;
    }[];
    const recentRows = (await recentRes.json()) as {
      title: string;
      severity: string;
      category: string;
      completed_at: string;
    }[];

    const byCategoryMap = new Map<string, { critical: number; warning: number; info: number }>();
    for (const row of categoryRows) {
      const entry = byCategoryMap.get(row.category) ?? { critical: 0, warning: 0, info: 0 };
      const count = Number(row.cnt ?? 0);
      if (row.severity === 'critical') entry.critical += count;
      else if (row.severity === 'warning') entry.warning += count;
      else entry.info += count;
      byCategoryMap.set(row.category, entry);
    }

    return {
      source: 'clickhouse',
      auditCount: Number(summaryRow?.audit_count ?? 0),
      findingCount: Number(summaryRow?.finding_count ?? 0),
      criticalCount: Number(summaryRow?.critical_count ?? 0),
      warningCount: Number(summaryRow?.warning_count ?? 0),
      infoCount: Number(summaryRow?.info_count ?? 0),
      byCategory: [...byCategoryMap.entries()].map(([category, counts]) => ({
        category,
        ...counts,
      })),
      recentFindings: recentRows.map((r) => ({
        title: r.title,
        severity: r.severity,
        category: r.category,
        completedAt: r.completed_at,
      })),
      persistentFindings: (await getPersistentFindings(days)).map((f) => ({
        title: f.title,
        category: f.category,
        severity: f.severity,
        auditCount: f.auditCount,
        daysPersisting: f.daysPersisting,
      })),
    };
  } catch (error) {
    console.error('[clickhouse] failed to read SEO insight metrics:', error);
    return empty;
  }
}
