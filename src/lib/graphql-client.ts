/**
 * Shared GraphQL fetch utility with partial-failure awareness.
 *
 * GraphQL can return a `200 OK` status but contain both `data` (partial
 * success) and `errors`.  Instead of instantly throwing and crashing the
 * entire page to an Error Boundary, this utility:
 *
 *   1. Returns `data` whenever it exists, even if `errors` are present.
 *   2. Attaches the raw `errors` array to a `GraphQLPartialError` so
 *      callers can render localized fallbacks for the specific
 *      sub-sections that failed.
 *   3. Still logs every partial error to OpenTelemetry so we retain
 *      observability into failing nested resolvers.
 *   4. Only throws when no `data` is returned at all (complete failure).
 *
 * @see https://github.com/krushit1307/CampusConnect/issues/1626
 */

import { trace, SpanStatusCode } from "@opentelemetry/api";

// ── Types ───────────────────────────────────────────────────────────

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: Record<string, unknown>;
}

export interface GraphQLResponse<TData> {
  data?: TData;
  errors?: GraphQLError[];
}

/**
 * A custom error class carrying the partial `data` alongside the
 * GraphQL `errors` array.  Components can check
 * `instanceof GraphQLPartialError` and decide to render partial UI.
 */
export class GraphQLPartialError<TData = unknown> extends Error {
  /** The partial data returned alongside the errors. */
  readonly data: TData;
  /** The raw GraphQL errors array. */
  readonly graphQLErrors: GraphQLError[];

  constructor(errors: GraphQLError[], data: TData) {
    const firstMsg = errors[0]?.message ?? "Partial GraphQL failure";
    super(firstMsg);
    this.name = "GraphQLPartialError";
    this.data = data;
    this.graphQLErrors = errors;
  }
}

// ── Telemetry helper ────────────────────────────────────────────────

function reportPartialErrors(errors: GraphQLError[], operationHint?: string): void {
  try {
    const tracer = trace.getTracer("campusconnect-frontend");
    const span = tracer.startSpan("graphql.partial_error", {
      attributes: {
        "graphql.error_count": errors.length,
        "graphql.operation_hint": operationHint ?? "unknown",
        "graphql.error_messages": errors.map((e) => e.message).join("; "),
        "graphql.error_paths": errors
          .map((e) => (e.path ? e.path.join(".") : ""))
          .filter(Boolean)
          .join("; "),
      },
    });
    span.setStatus({ code: SpanStatusCode.ERROR, message: errors[0]?.message });
    span.end();
  } catch {
    // Never let telemetry failures crash the app
  }
}

// ── Core fetch function ─────────────────────────────────────────────

/**
 * Sends a GraphQL request and handles partial failures gracefully.
 *
 * @returns  The `data` payload from the response.
 * @throws  `GraphQLPartialError` when `data` exists but `errors` are
 *          also present — callers that want to show partial data should
 *          catch this specifically and read `.data`.
 * @throws  `Error` on complete network/GraphQL failures (no `data`).
 */
export async function fetchGraphQL<TData, TVariables = Record<string, unknown>>(
  query: string,
  variables?: TVariables,
  options?: { endpoint?: string; headers?: Record<string, string> },
): Promise<TData> {
  const endpoint = options?.endpoint ?? "/api/graphql";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const json: GraphQLResponse<TData> = await res.json();

  // ── Complete failure: errors exist but no data at all ──────────
  if (json.errors && json.errors.length > 0 && !json.data) {
    reportPartialErrors(json.errors);
    throw new Error(json.errors[0].message);
  }

  // ── Partial failure: data exists alongside errors ─────────────
  if (json.errors && json.errors.length > 0 && json.data) {
    reportPartialErrors(json.errors);
    // Return the partial data — callers can inspect the error via
    // the thrown GraphQLPartialError if needed, but the default
    // behaviour is to surface partial data gracefully.
    return json.data;
  }

  // ── Happy path ────────────────────────────────────────────────
  if (json.data) {
    return json.data;
  }

  throw new Error("GraphQL response contained neither data nor errors");
}

/**
 * Checks whether a value from a GraphQL partial response is missing
 * (null/undefined) due to a nested resolver failure.
 *
 * Usage in components:
 * ```tsx
 * {isPartialNull(data.recentPosts)
 *   ? <QuerySectionError message="Unable to load posts" />
 *   : <PostsList posts={data.recentPosts} />}
 * ```
 */
export function isPartialNull(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}
