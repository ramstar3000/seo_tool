/** Client-safe helper — keep free of server-only imports (SERP, ClickHouse, etc.). */
export function isLightAuditTrace(toolTrace: unknown): boolean {
  if (!Array.isArray(toolTrace)) return false;
  return toolTrace.some(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      'toolName' in entry &&
      (entry as { toolName: string }).toolName === 'light_serp_scan'
  );
}
