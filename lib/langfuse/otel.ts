import { registerTelemetry } from 'ai';
import { LegacyOpenTelemetry } from '@ai-sdk/otel';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { flushLangfuse, hasLangfuseConfig } from '@/lib/langfuse/client';

let spanProcessor: LangfuseSpanProcessor | null = null;
let initialized = false;

/** Register AI SDK telemetry → Langfuse (Next.js instrumentation.ts calls this). */
export function initLangfuseOtel(): void {
  if (initialized || !hasLangfuseConfig()) return;

  registerTelemetry(new LegacyOpenTelemetry());

  spanProcessor = new LangfuseSpanProcessor({
    shouldExportSpan: ({ otelSpan }) => otelSpan.instrumentationScope.name !== 'next.js',
    exportMode: 'immediate',
    release:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.FLY_IMAGE_REF ??
      process.env.FLY_APP_NAME ??
      'local',
    environment: process.env.NODE_ENV ?? 'development',
  });

  const provider = new NodeTracerProvider({
    spanProcessors: [spanProcessor],
  });
  provider.register();

  initialized = true;
}

export async function flushLangfuseSpans(): Promise<void> {
  if (spanProcessor) {
    await spanProcessor.forceFlush();
  }
  await flushLangfuse();
}
