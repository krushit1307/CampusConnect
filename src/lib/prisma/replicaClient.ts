// =============================================================================
// Module: Replica Database Client (Read-Only Node)
// Issue: #2424 - Implement Read-Replica routing for massive Analytics queries
// Description: Initializes the Prisma Client for the Read-Replica database.
// This node is optimized for heavy, long-running SELECT aggregations.
// It enforces read-only transactions to prevent accidental state mutations.
// =============================================================================

import { PrismaClient } from "@prisma/client";

/**
 * Configuration for the Replica Database connection pool.
 * We use a larger pool size and longer timeouts because analytics queries
 * are heavy, concurrent, and take longer to execute.
 */
const replicaPrismaConfig = {
  datasources: {
    db: {
      url: process.env.DATABASE_REPLICA_URL,
    },
  },
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
};

declare global {
  var __replicaPrisma: PrismaClient | undefined;
}

/**
 * The singleton Replica Prisma Client instance.
 * All heavy analytics and dashboard aggregations MUST route through this client.
 */
export const replicaClient = global.__replicaPrisma ?? new PrismaClient(replicaPrismaConfig);

if (process.env.NODE_ENV !== "production") {
  global.__replicaPrisma = replicaClient;
}

/**
 * CRITICAL SAFETY MIDDLEWARE:
 * Intercepts all Prisma operations on the replica client and throws an error
 * if any state-mutating query (INSERT, UPDATE, DELETE, UPSERT) is attempted.
 * This guarantees the replica node remains strictly read-only.
 */
replicaClient.$use(async (params, next) => {
  const mutatingActions = [
    "create",
    "update",
    "delete",
    "upsert",
    "createMany",
    "updateMany",
    "deleteMany",
  ];

  if (mutatingActions.includes(params.action)) {
    throw new Error(
      `[ReplicaDB FATAL] Attempted to execute mutating action '${params.action}' on Read-Only Replica node. ` +
        `All writes must be routed through primaryClient.`,
    );
  }

  const result = await next(params);
  return result;
});

/**
 * Helper to execute heavy analytics queries with extended timeouts.
 * Analytics queries often take 3-5 seconds; the default Prisma timeout is too short.
 */
export async function runAnalyticsQuery<T>(
  fn: (client: PrismaClient) => Promise<T>,
  timeoutMs: number = 15000,
): Promise<T> {
  return replicaClient.$transaction(async (tx) => fn(tx as PrismaClient), {
    maxWait: 2000,
    timeout: timeoutMs,
    isolationLevel: "ReadCommitted",
  });
}
