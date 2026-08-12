/**
 * Extract W3C Trace Context from incoming request headers
 * Format: "version-trace-id-parent-id-trace-flags"
 * Example: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
 */
export function extractTraceContext(request: Request) {
  const traceparent = request.headers.get("traceparent");
  const tracestate = request.headers.get("tracestate");

  if (!traceparent) {
    return null;
  }

  // Parse traceparent header
  const parts = traceparent.split("-");
  if (parts.length !== 4) {
    console.warn(`Invalid traceparent format: ${traceparent}`);
    return null;
  }

  const [version, traceId, parentId, traceFlags] = parts;

  return {
    version,
    traceId,
    parentId,
    traceFlags,
    tracestate,
    traceparent, // Keep original for propagation
  };
}

/**
 * Create a simple span with attributes
 */
export function createSpanAttributes(
  operationName: string,
  traceContext: ReturnType<typeof extractTraceContext> | null,
  customAttributes?: Record<string, string | number>,
) {
  return {
    "span.name": operationName,
    ...(traceContext && {
      "trace.id": traceContext.traceId,
      "trace.parent_id": traceContext.parentId,
    }),
    ...customAttributes,
  };
}

/**
 * Log structured trace data
 */
export function logSpan(
  operationName: string,
  startTime: number,
  endTime: number,
  traceContext: ReturnType<typeof extractTraceContext> | null,
  attributes?: Record<string, string | number>,
  error?: Error,
) {
  const duration = endTime - startTime;

  const spanData = {
    timestamp: new Date().toISOString(),
    operationName,
    duration_ms: duration,
    ...(traceContext && {
      trace_id: traceContext.traceId,
      parent_id: traceContext.parentId,
      traceparent: traceContext.traceparent,
    }),
    attributes,
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack,
      },
    }),
  };

  console.log(JSON.stringify(spanData));
  return spanData;
}
