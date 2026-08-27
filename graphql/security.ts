import {
  GraphQLError,
  DocumentNode,
  Kind,
  OperationDefinitionNode,
  SelectionSetNode,
} from "graphql";
import type { Plugin } from "graphql-yoga";

export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds (default: 60000)
  maxRequests?: number; // Max requests per IP per window (default: 100)
  maxMutations?: number; // Max mutation requests per window (default: 10)
}

export interface SecurityPluginOptions {
  maxDepth?: number; // Max allowed GraphQL query depth (default: 5)
  rateLimit?: RateLimitConfig;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MAX_MUTATIONS = 10;

// ---------------------------------------------------------------------------
// Query depth limiting
// ---------------------------------------------------------------------------

/**
 * Calculates the maximum depth of a GraphQL operation AST document.
 *
 * Fragment spreads are resolved against the document's fragment definitions
 * so deeply nested recursive queries built with fragments are rejected too
 * (a bare `FRAGMENT_SPREAD` node has no selection set of its own). The
 * `visitedFragments` set guards against infinite recursion on
 * self-referencing fragments.
 */
export function getQueryDepth(
  selectionSet: SelectionSetNode,
  currentDepth = 1,
  fragments: Map<string, FragmentDefinitionNode> = new Map(),
  visitedFragments: Set<string> = new Set(),
): number {
  let maxDepth = currentDepth;

  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      if (selection.selectionSet) {
        const depth = getQueryDepth(
          selection.selectionSet,
          currentDepth + 1,
          fragments,
          visitedFragments,
        );
        if (depth > maxDepth) maxDepth = depth;
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      if (selection.selectionSet) {
        const depth = getQueryDepth(
          selection.selectionSet,
          currentDepth,
          fragments,
          visitedFragments,
        );
        if (depth > maxDepth) maxDepth = depth;
      }
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const fragment = fragments.get(selection.name.value);
      if (fragment && !visitedFragments.has(fragment.name.value)) {
        const nextVisited = new Set(visitedFragments);
        nextVisited.add(fragment.name.value);
        const depth = getQueryDepth(fragment.selectionSet, currentDepth, fragments, nextVisited);
        if (depth > maxDepth) maxDepth = depth;
      }
    }
  }

  return maxDepth;
}

function collectFragments(document: DocumentNode): Map<string, FragmentDefinitionNode> {
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    }
  }
  return fragments;
}

// ---------------------------------------------------------------------------
// Sliding window rate limiter (in-memory, per key)
// ---------------------------------------------------------------------------

const MAX_STORE_ENTRIES = 5000;

// In-memory sliding window rate limiter store
const mutationStore = new Map<string, number[]>();

// Periodically clean up abandoned entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_IDLE_TIME_MS = 15 * 60 * 1000;

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [identifier, timestamps] of mutationStore.entries()) {
    if (timestamps.length === 0 || now - timestamps[timestamps.length - 1] > MAX_IDLE_TIME_MS) {
      mutationStore.delete(identifier);
    }
  }
}, CLEANUP_INTERVAL_MS);

if (typeof cleanupInterval.unref === "function") {
  cleanupInterval.unref();
}

class SlidingWindowCounter {
  private store = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly limit: number,
  ) {}

  /**
   * Records the request and returns whether it is allowed.
   * When blocked, returns the milliseconds until the oldest request in the
   * window expires so callers can set a `Retry-After` header.
   */
  check(key: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    let timestamps = this.store.get(key) ?? [];
    timestamps = timestamps.filter((ts) => now - ts < this.windowMs);

    if (timestamps.length >= this.limit) {
      const oldest = timestamps[0];
      const retryAfterMs = Math.max(1, oldest + this.windowMs - now);
      this.store.set(key, timestamps);
      return { allowed: false, retryAfterMs };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);
    this.pruneIfNeeded(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  clear(): void {
    this.store.clear();
  }

  /** Drops expired/empty entries to keep the store bounded. */
  private pruneIfNeeded(now: number): void {
    if (this.store.size < MAX_STORE_ENTRIES) return;
    for (const [key, timestamps] of this.store) {
      const remaining = timestamps.filter((ts) => now - ts < this.windowMs);
      if (remaining.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, remaining);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Client identification
// ---------------------------------------------------------------------------

/**
 * Extracts the client IP from proxy headers. `x-forwarded-for` is the first
 * (client-originated) address; `x-real-ip` is the fallback for proxies that
 * only set that header.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }
  return "127.0.0.1";
}

// ---------------------------------------------------------------------------
// Security plugin
// ---------------------------------------------------------------------------

const requestWindowStore = new Map<string, SlidingWindowCounter>();
const mutationWindowStore = new Map<string, SlidingWindowCounter>();

export function clearRateLimitStore(): void {
  requestWindowStore.clear();
  mutationWindowStore.clear();
}

/**
 * GraphQL Security Plugin for Yoga:
 * 1. Restricts query depth (fragment-aware) to prevent deeply nested
 *    recursive query attacks.
 * 2. Enforces IP-based sliding-window rate limiting on all requests
 *    (default 100 requests/minute), returning HTTP 429 + Retry-After.
 * 3. Enforces an additional, stricter cap on mutation operations.
 */
export function createGraphQLSecurityPlugin(options: SecurityPluginOptions = {}): Plugin {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const windowMs = options.rateLimit?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.rateLimit?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const maxMutations = options.rateLimit?.maxMutations ?? DEFAULT_MAX_MUTATIONS;

  let requestWindow = requestWindowStore.get(`${windowMs}:${maxRequests}`);
  if (!requestWindow) {
    requestWindow = new SlidingWindowCounter(windowMs, maxRequests);
    requestWindowStore.set(`${windowMs}:${maxRequests}`, requestWindow);
  }

  let mutationWindow = mutationWindowStore.get(`${windowMs}:${maxMutations}`);
  if (!mutationWindow) {
    mutationWindow = new SlidingWindowCounter(windowMs, maxMutations);
    mutationWindowStore.set(`${windowMs}:${maxMutations}`, mutationWindow);
  }

  return {
    // 1. IP-based rate limiting: block early, before parsing the body.
    onRequest({ request }) {
      // Ignore CORS preflights so harmless OPTIONS probing does not consume
      // the request budget.
      if (request.method === "OPTIONS") return;

      const ip = getClientIp(request);
      const { allowed, retryAfterMs } = requestWindow.check(ip);

      if (!allowed) {
        return new Response(
          JSON.stringify({
            errors: [
              {
                message: `Rate limit exceeded. Maximum of ${maxRequests} requests per ${windowMs / 1000} seconds. Please try again later.`,
                extensions: { code: "RATE_LIMIT_EXCEEDED" },
              },
            ],
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
              "X-RateLimit-Limit": String(maxRequests),
            },
          },
        );
      }
    },

    // 2. Depth limiting (fragment-aware).
    onValidate({ document, addValidationError }) {
      const fragments = collectFragments(document);

      for (const definition of document.definitions) {
        if (definition.kind === Kind.OPERATION_DEFINITION) {
          const depth = getQueryDepth(definition.selectionSet, 1, fragments);
          if (depth > maxDepth) {
            addValidationError(
              new GraphQLError(
                `Query exceeds maximum allowed depth of ${maxDepth}. Current query depth is ${depth}.`,
                {
                  extensions: {
                    code: "QUERY_DEPTH_LIMIT_EXCEEDED",
                    maxDepth,
                    actualDepth: depth,
                  },
                },
              ),
            );
          }
        }
      }
    },

    // 3. Stricter mutation cap (defense in depth on top of the IP limit).
    onExecute({ args }) {
      const document = args.document as DocumentNode;
      const context = args.contextValue as Record<string, unknown>;

      const isMutation = document.definitions.some(
        (def): def is OperationDefinitionNode =>
          def.kind === Kind.OPERATION_DEFINITION && def.operation === "mutation",
      );

if (!isMutation) return;

const user = context?.user as
  | { is_impersonated?: boolean }
  | undefined;

if (user?.is_impersonated === true) {
  throw new GraphQLError(
    "Forbidden: Mutations are disabled during impersonation.",
    {
      extensions: {
        code: "IMPERSONATION_READ_ONLY",
        http: { status: 403 },
      },
    },
  );
}

const ip = context?.request instanceof Request ? getClientIp(context.request) : "127.0.0.1";      const { allowed, retryAfterMs } = mutationWindow.check(ip);

      if (!allowed) {
        throw new GraphQLError(
          `Rate limit exceeded for GraphQL mutations. Maximum allowed is ${maxMutations} per ${
            windowMs / 1000
          } seconds. Please try again later.`,
          {
            extensions: {
              code: "RATE_LIMIT_EXCEEDED",
              http: {
                status: 429,
                headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
              },
            },
          },
        );
      }
    },
  };
}
