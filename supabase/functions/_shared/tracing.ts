/**
 * Supabase Edge Functions OpenTelemetry Tracing & Context Propagation Utilities.
 * Extracts incoming W3C traceparent headers and formats response headers for distributed tracing.
 */

export interface TraceContext {
  traceparent: string | null;
  tracestate: string | null;
}

/**
 * Extract W3C Trace Context headers from an incoming HTTP Request.
 */
export function extractEdgeTraceContext(req: Request): TraceContext {
  return {
    traceparent: req.headers.get("traceparent"),
    tracestate: req.headers.get("tracestate"),
  };
}

/**
 * Inject W3C Trace Context headers into an outgoing HTTP Request header map or object.
 */
export function injectEdgeTraceContext(
  headers: Record<string, string> = {},
  context: TraceContext,
): Record<string, string> {
  if (context.traceparent) {
    headers["traceparent"] = context.traceparent;
  }
  if (context.tracestate) {
    headers["tracestate"] = context.tracestate;
  }
  return headers;
}
