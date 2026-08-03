import { trace, propagation, context, SpanStatusCode, type Span } from "@opentelemetry/api";
import { WebTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { CompositePropagator, W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

let isInitialized = false;
let globalProvider: WebTracerProvider | null = null;

export function initializeTracing(): WebTracerProvider | null {
  if (isInitialized && globalProvider) return globalProvider;

  // Create OpenTelemetry Resource identifying the frontend service
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: "campusconnect-frontend",
    }),
  );

  const collectorUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OTEL_COLLECTOR_URL) ||
    "http://localhost:4318/v1/traces";

  const exporter = new OTLPTraceExporter({
    url: collectorUrl,
  });

  const tracerProvider = new WebTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  // Configure W3C Trace Context propagation
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator()],
    }),
  );

  // Register WebTracerProvider globally
  tracerProvider.register();
  trace.setGlobalTracerProvider(tracerProvider);

  // Register FetchInstrumentation for automatic HTTP fetch tracing and traceparent header injection
  registerInstrumentations({
    tracerProvider,
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [/.*/],
        clearTimingResources: true,
      }),
    ],
  });

  globalProvider = tracerProvider;
  isInitialized = true;
  return tracerProvider;
}

/**
 * Get the OpenTelemetry Tracer instance for frontend instrumentation.
 */
export function getFrontendTracer() {
  return trace.getTracer("campusconnect-frontend");
}

/**
 * Helper to trace an async function execution as a custom OpenTelemetry span.
 */
export async function traceSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, string | number | boolean> = {},
): Promise<T> {
  const tracer = getFrontendTracer();
  const span = tracer.startSpan(name, { attributes });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
