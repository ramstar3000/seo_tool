export async function register() {
  const { initLangfuseOtel } = await import('@/lib/langfuse/otel');
  initLangfuseOtel();
}
