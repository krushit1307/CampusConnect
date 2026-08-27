export interface IncrementalPayload<T> {
  data?: T;
  hasNext: boolean;
  label?: string;
  path?: (string | number)[];
}

/**
 * Validates and formats queries containing @defer or @stream directives.
 */
export function processGraphQLDirectives(query: string): {
  hasDefer: boolean;
  hasStream: boolean;
  optimizedQuery: string;
} {
  const hasDefer = query.includes("@defer");
  const hasStream = query.includes("@stream");

  // Minify query whitespace while preserving directives
  const optimizedQuery = query.replace(/\s+/g, " ").trim();

  return {
    hasDefer,
    hasStream,
    optimizedQuery,
  };
}

/**
 * Merges incremental deferred/stream chunks into a unified response object.
 */
export function mergeIncrementalChunk<T extends Record<string, unknown>>(
  baseData: T,
  chunk: IncrementalPayload<unknown>,
): T & Record<string, unknown> {
  if (!chunk.path || chunk.data === undefined) return baseData;

  const result: Record<string, unknown> = { ...baseData };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < chunk.path.length - 1; i++) {
    const key = String(chunk.path[i]);
    current[key] = { ...(current[key] as Record<string, unknown>) };
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = String(chunk.path[chunk.path.length - 1]);
  if (Array.isArray(current[lastKey]) && Array.isArray(chunk.data)) {
    current[lastKey] = [...(current[lastKey] as unknown[]), ...chunk.data];
  } else {
    current[lastKey] = chunk.data;
  }

  return result as T & Record<string, unknown>;
}
