import { useEffect, useRef, useState, useCallback } from "react";

/** Shape of a GraphQL Subscription operation. */
interface SubscriptionOperation {
  query: string;
  variables?: Record<string, unknown>;
}

/** State returned by the hook. */
export interface SubscriptionState<T> {
  /** The most recently received subscription data payload. */
  data: T | null;
  /** Any error that occurred during the subscription lifecycle. */
  error: Error | null;
  /** Whether the SSE connection is currently established. */
  connected: boolean;
}

/**
 * useGraphQLSubscription
 *
 * A lightweight React hook for consuming GraphQL Subscriptions over
 * Server-Sent Events (SSE) as served by GraphQL Yoga v5.
 *
 * GraphQL Yoga uses the `graphql-sse` "distinct connections" mode:
 *   - POST the subscription operation to /api/graphql with `Accept: text/event-stream`.
 *   - Yoga responds with an SSE stream; each `data:` event contains a
 *     JSON-encoded `{ data: { … } }` result payload.
 *
 * @param endpoint  GraphQL endpoint URL (defaults to /api/graphql)
 * @param operation GraphQL query string + optional variables
 * @param skip      If true, the subscription is not started (e.g. when userId is unknown)
 *
 * @example
 * ```tsx
 * const { data, connected } = useGraphQLSubscription<{ notificationReceived: Notification }>({
 *   query: NOTIFICATION_SUBSCRIPTION,
 *   variables: { userId: currentUser.id },
 * });
 * ```
 */
export function useGraphQLSubscription<T>(
  operation: SubscriptionOperation | null,
  { endpoint = "/api/graphql", skip = false }: { endpoint?: string; skip?: boolean } = {},
): SubscriptionState<T> {
  const [state, setState] = useState<SubscriptionState<T>>({
    data: null,
    error: null,
    connected: false,
  });

  // Keep a stable ref to avoid closure issues in the cleanup.
  const abortRef = useRef<AbortController | null>(null);

  const subscribe = useCallback(async () => {
    if (!operation || skip) return;

    // Clean up any previous connection.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ data: null, error: null, connected: false });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Signal to GraphQL Yoga that we want an SSE subscription stream.
          Accept: "text/event-stream",
        },
        body: JSON.stringify(operation),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `GraphQL subscription HTTP error: ${response.status} ${response.statusText}`,
        );
      }
      if (!response.body) {
        throw new Error("GraphQL subscription: response body is null");
      }

      setState((prev) => ({ ...prev, connected: true }));

      // Read the SSE stream line-by-line.
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer.
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          // SSE data lines start with "data: ".
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice("data: ".length).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr) as { data?: T; errors?: unknown[] };
            if (parsed.errors?.length) {
              setState((prev) => ({
                ...prev,
                error: new Error(JSON.stringify(parsed.errors)),
              }));
            } else if (parsed.data !== undefined) {
              setState({ data: parsed.data as T, error: null, connected: true });
            }
          } catch {
            // Ignore malformed SSE frames.
          }
        }
      }
    } catch (err: unknown) {
      // AbortError is expected when we deliberately tear down the connection.
      if (err instanceof Error && err.name === "AbortError") return;
      setState({ data: null, error: err as Error, connected: false });
    } finally {
      setState((prev) => ({ ...prev, connected: false }));
    }
  }, [operation, endpoint, skip]);

  useEffect(() => {
    subscribe();
    return () => {
      abortRef.current?.abort();
    };
  }, [subscribe]);

  return state;
}
