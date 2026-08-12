/**
 * DataLoader Batching Utility & Query Depth Protection
 * Solves N+1 query problem and enforces security depth limits (#2652).
 */

export type BatchLoadFn<K, V> = (keys: readonly K[]) => Promise<Array<V | null | Error>>;

export class BatchDataLoader<K extends string | number, V> {
  private batchLoadFn: BatchLoadFn<K, V>;
  private cache = new Map<K, Promise<V | null>>();
  private queue: K[] = [];
  private pendingCallbacks = new Map<
    K,
    Array<{ resolve: (val: V | null) => void; reject: (err: any) => void }>
  >();
  private scheduled = false;

  constructor(batchLoadFn: BatchLoadFn<K, V>) {
    this.batchLoadFn = batchLoadFn;
  }

  /**
   * Loads a key, batching multiple calls in the same event loop tick.
   */
  load(key: K): Promise<V | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const promise = new Promise<V | null>((resolve, reject) => {
      if (!this.pendingCallbacks.has(key)) {
        this.pendingCallbacks.set(key, []);
        this.queue.push(key);
      }
      this.pendingCallbacks.get(key)!.push({ resolve, reject });

      if (!this.scheduled) {
        this.scheduled = true;
        setTimeout(() => this.dispatchBatch(), 0);
      }
    });

    this.cache.set(key, promise);
    return promise;
  }

  private async dispatchBatch() {
    const keysToLoad = [...this.queue];
    const callbacksToProcess = new Map(this.pendingCallbacks);

    this.queue = [];
    this.pendingCallbacks.clear();
    this.scheduled = false;

    if (keysToLoad.length === 0) return;

    try {
      const results = await this.batchLoadFn(keysToLoad);
      for (let i = 0; i < keysToLoad.length; i++) {
        const key = keysToLoad[i];
        const val = results[i] ?? null;
        const cbs = callbacksToProcess.get(key) || [];
        for (const cb of cbs) {
          if (val instanceof Error) {
            cb.reject(val);
          } else {
            cb.resolve(val);
          }
        }
      }
    } catch (err) {
      for (const key of keysToLoad) {
        const cbs = callbacksToProcess.get(key) || [];
        for (const cb of cbs) {
          cb.reject(err);
        }
      }
    }
  }

  /**
   * Clears the cache for a given key or all keys.
   */
  clear(key?: K): this {
    if (key !== undefined) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    return this;
  }
}

/**
 * Validates GraphQL query depth to prevent deeply nested query attacks.
 */
export function validateQueryDepth(query: string, maxDepth = 5): { valid: boolean; depth: number } {
  if (!query || typeof query !== "string") {
    return { valid: true, depth: 0 };
  }

  let currentDepth = 0;
  let maxQueryDepth = 0;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    if (char === "{") {
      currentDepth++;
      if (currentDepth > maxQueryDepth) {
        maxQueryDepth = currentDepth;
      }
    } else if (char === "}") {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  const adjustedDepth = Math.max(0, maxQueryDepth - 1);
  return {
    valid: adjustedDepth <= maxDepth,
    depth: adjustedDepth,
  };
}
