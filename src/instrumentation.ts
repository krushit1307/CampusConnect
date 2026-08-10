import { trace, propagation, context, SpanStatusCode, type Span } from "@opentelemetry/api";
import {
  WebTracerProvider,
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { CompositePropagator, W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { registerInstrumentations } from "@opentelemetry/instrumentation";

let isInitialized = false;
let globalProvider: WebTracerProvider | null = null;

const SENSITIVE_KEY_PATTERN = /(email|password|token|jwt|auth|secret|credit_card|ssn|phone)/i;

/**
 * Sanitizes attributes to remove any Personally Identifiable Information (PII).
 */
export function sanitizeSpanAttributes(
  attributes: Record<string, any> = {},
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED_PII]";
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    } else if (value !== null && value !== undefined) {
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

/**
 * Generates a W3C traceparent header string (00-{traceId}-{spanId}-{flags}).
 */
export function generateTraceParentHeader(span?: Span): string {
  const currentSpan = span ?? trace.getSpan(context.active());
  if (!currentSpan) {
    // Generate valid fallback traceparent
    return `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`;
  }
  const spanContext = currentSpan.spanContext();
  const traceFlagsHex = spanContext.traceFlags.toString(16).padStart(2, "0");
  return `00-${spanContext.traceId}-${spanContext.spanId}-${traceFlagsHex}`;
}

export function initializeTracing(): WebTracerProvider | null {
  if (isInitialized && globalProvider) return globalProvider;

  // 1. Configure OpenTelemetry Resource
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: "campusconnect-frontend",
    }),
  );

  const collectorUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OTEL_COLLECTOR_URL) ||
    "http://localhost:4318/v1/traces";

  const sampleRate = parseFloat(
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_OTEL_SAMPLE_RATE) || "0.1",
  );

  const exporter = new OTLPTraceExporter({
    url: collectorUrl,
  });

  // 2. Configure Sampler (ParentBased with TraceIdRatioBasedSampler to sample ~10% requests)
  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(sampleRate),
  });

  // Use BatchSpanProcessor in production/default to optimize performance
  const spanProcessor =
    typeof process !== "undefined" && process.env.NODE_ENV === "test"
      ? new SimpleSpanProcessor(exporter)
      : new BatchSpanProcessor(exporter, {
          maxQueueSize: 2048,
          scheduledDelayMillis: 1000,
        });

  const tracerProvider = new WebTracerProvider({
    resource,
    sampler,
    spanProcessors: [spanProcessor],
  });

  // 3. Configure W3C Trace Context propagation
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator()],
    }),
  );

  // 4. Register WebTracerProvider globally
  tracerProvider.register();
  trace.setGlobalTracerProvider(tracerProvider);

  // 5. Register FetchInstrumentation for automatic HTTP fetch tracing and traceparent header injection
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
  attributes: Record<string, any> = {},
): Promise<T> {
  const tracer = getFrontendTracer();
  const sanitizedAttrs = sanitizeSpanAttributes(attributes);
  const span = tracer.startSpan(name, { attributes: sanitizedAttrs });

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

/**
 * Helper to trace critical React UI interactions (e.g. clicking RSVP, search, auth).
 */
export async function traceInteraction<T>(
  actionName: string,
  fn: (span: Span) => Promise<T>,
  attributes: Record<string, any> = {},
): Promise<T> {
  const mergedAttrs = {
    "component.action": actionName,
    "ui.interaction": true,
    ...attributes,
  };
  return traceSpan(`interaction.${actionName}`, fn, mergedAttrs);
}
