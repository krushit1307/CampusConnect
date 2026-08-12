import { trace, propagation, context, SpanStatusCode, type Span } from "@opentelemetry/api";
import { BasicTracerProvider, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { Plugin } from "graphql-yoga";

let isBackendInitialized = false;
let globalBackendProvider: BasicTracerProvider | null = null;

export function initializeBackendTracing(): BasicTracerProvider | null {
  if (isBackendInitialized && globalBackendProvider) return globalBackendProvider;

  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: "campusconnect-backend",
    }),
  );

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || "http://localhost:4318/v1/traces";

  const exporter = new OTLPTraceExporter({
    url: endpoint,
  });

  const provider = new BasicTracerProvider({
    resource,
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(provider);

  globalBackendProvider = provider;
  isBackendInitialized = true;
  return provider;
}

export function getBackendTracer() {
  return trace.getTracer("campusconnect-backend");
}

/**
 * GraphQL Yoga Plugin for OpenTelemetry distributed tracing.
 * Extracts incoming W3C traceparent headers, creates operation spans,
 * and records attributes & error statuses.
 */
export function openTelemetryPlugin(): Plugin {
  const tracer = getBackendTracer();

  return {
    onRequest({ request, url }) {
      const headersObj: Record<string, string> = {};
      request.headers.forEach((val, key) => {
        headersObj[key.toLowerCase()] = val;
      });

      // Extract incoming W3C trace context from headers
      const parentContext = propagation.extract(context.active(), headersObj);
      const span = tracer.startSpan(
        `graphql.http:${request.method}`,
        {
          attributes: {
            "http.method": request.method,
            "http.url": url.toString(),
            "http.target": url.pathname,
          },
        },
        parentContext,
      );

      // Store span on request context
      (request as unknown as Record<string, unknown>).__otel_span = span;
    },

    onExecute({ args, extendContext }) {
      const operationName = args.operationName || "Anonymous Operation";
      const span = tracer.startSpan(`graphql.execute:${operationName}`, {
        attributes: {
          "graphql.operation.name": operationName,
        },
      });

      extendContext({ __otel_exec_span: span });

      return {
        onExecuteDone({ result }) {
          if (result.errors && result.errors.length > 0) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: result.errors.map((e) => e.message).join("; "),
            });
            result.errors.forEach((err) => span.recordException(err));
          } else {
            span.setStatus({ code: SpanStatusCode.OK });
          }
          span.end();
        },
      };
    },

    onResponse({ response, request }) {
      const reqObj = request as unknown as Record<string, unknown>;
      const span = reqObj.__otel_span as Span | undefined;
      if (span) {
        span.setAttribute("http.status_code", response.status);
        if (response.status >= 400) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.status}` });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.end();
      }
    },
  };
}
