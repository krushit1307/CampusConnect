// =============================================================================
// Module: Database Router (Read-After-Write Consistency)
// Issue: #2424 - Implement Read-Replica routing for massive Analytics queries
// Description: Solves the "Replication Lag" edge case. If a user creates an
// Event (Primary) and immediately views it (Replica), the replica might not
// have synced yet (500ms lag), causing a 404. This router tracks recent writes
// and forces reads back to the Primary node for a short TTL.
// =============================================================================

import { PrismaClient } from "@prisma/client";
import { primaryClient } from "./primaryClient";
import { replicaClient } from "./replicaClient";

/**
 * In-memory cache to track recent mutations per entity ID.
 * Key: `${modelName}:${entityId}`
 * Value: Timestamp of the last mutation (ms)
 */
const recentWriteCache = new Map<string, number>();

/**
 * The "Staleness Window" in milliseconds.
 * If a read occurs within this window after a write to the same entity,
 * the router forces the read to the Primary node to guarantee consistency.
 * Set to 5000ms (5 seconds) to safely cover maximum replication lag + buffer.
 */
const STALENESS_WINDOW_MS = 5000;

/**
 * Records a mutation in the cache.
 * Call this immediately after any successful INSERT/UPDATE/DELETE on the Primary node.
 */
export function trackMutation(modelName: string, entityId: string): void {
  const cacheKey = `${modelName.toLowerCase()}:${entityId}`;
  recentWriteCache.set(cacheKey, Date.now());

  // Clean up old entries to prevent memory leaks in long-running Node processes
  cleanupCache();
}

/**
 * Checks if an entity was recently mutated.
 */
function isRecentlyMutated(modelName: string, entityId: string): boolean {
  const cacheKey = `${modelName.toLowerCase()}:${entityId}`;
  const lastMutationTime = recentWriteCache.get(cacheKey);

  if (!lastMutationTime) return false;

  const timeSinceMutation = Date.now() - lastMutationTime;
  if (timeSinceMutation < STALENESS_WINDOW_MS) {
    return true; // Still within the staleness window
  }

  // Expired, remove from cache
  recentWriteCache.delete(cacheKey);
  return false;
}

/**
 * Periodically cleans up expired entries from the cache.
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, timestamp] of recentWriteCache.entries()) {
    if (now - timestamp > STALENESS_WINDOW_MS) {
      recentWriteCache.delete(key);
    }
  }
}

/**
 * The core routing function.
 * Determines whether to send a read query to the Primary or Replica node
 * based on the entity ID and recent mutation history.
 *
 * @param modelName - The Prisma model being queried (e.g., 'Event', 'User')
 * @param entityId - The specific ID being read (if known)
 * @param isHeavyAnalytics - If true, bypasses the cache and strictly uses Replica
 */
export async function routeReadQuery<T>(
  modelName: string,
  entityId: string | null,
  isHeavyAnalytics: boolean,
  queryFn: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  // 1. Heavy Analytics queries ALWAYS go to the Replica node.
  // We don't care about 500ms lag for dashboard charts.
  if (isHeavyAnalytics) {
    console.log(`[DBRouter] Routing heavy analytics for ${modelName} -> REPLICA`);
    return queryFn(replicaClient);
  }

  // 2. If we have a specific entity ID, check if it was recently mutated.
  if (entityId && isRecentlyMutated(modelName, entityId)) {
    console.log(`[DBRouter] Read-After-Write detected for ${modelName}:${entityId} -> PRIMARY`);
    return queryFn(primaryClient);
  }

  // 3. Default route: Standard reads go to the Replica node to save Primary CPU.
  console.log(`[DBRouter] Standard read for ${modelName} -> REPLICA`);
  return queryFn(replicaClient);
}

/**
 * Clears the entire cache (useful for testing or manual sync triggers).
 */
export function clearRouterCache(): void {
  recentWriteCache.clear();
}
