import { trace, propagation } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { CompositePropagator, W3CTraceContextPropagator } from "@opentelemetry/core";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function initializeTracing() {
  // Create a resource with service name
  const resource = defaultResource().merge(
    resourceFromAttributes({
      [SEMRESATTRS_SERVICE_NAME]: "campusconnect-frontend",
    }),
  );

  // Configure OTLP exporter
  const exporter = new OTLPTraceExporter({
    url: import.meta.env.VITE_OTEL_COLLECTOR_URL || "http://localhost:4318/v1/traces",
  });

  // Create tracer provider
  const tracerProvider = new BasicTracerProvider({
    resource,
    sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });

  // Set up W3C Trace Context propagation
  propagation.setGlobalPropagator(
    new CompositePropagator({
      propagators: [new W3CTraceContextPropagator()],
    }),
  );

  // Register global tracer provider
  trace.setGlobalTracerProvider(tracerProvider);

  return tracerProvider;
}
