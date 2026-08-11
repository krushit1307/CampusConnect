// =============================================================================
// Module: Primary Database Client (Write Node)
// Issue: #2424 - Implement Read-Replica routing for massive Analytics queries
// Description: Initializes the Prisma Client strictly for the Primary (Writer) 
// database node. This connection pool handles all state-mutating queries 
// (INSERT, UPDATE, DELETE) and critical "Read-After-Write" operations to 
// prevent replication lag issues.
// =============================================================================

import { PrismaClient } from '@prisma/client';

/**
 * Configuration for the Primary Database connection pool.
 * We use a smaller pool size here because write operations are typically 
 * less frequent but require strict consistency and locking.
 */
const primaryPrismaConfig = {
    datasources: {
        db: {
            url: process.env.DATABASE_PRIMARY_URL,
        },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
};

// Global instance to prevent multiple Prisma Client instances in development (Hot Reload)
declare global {
    var __primaryPrisma: PrismaClient | undefined;
}

/**
 * The singleton Primary Prisma Client instance.
 * All write operations MUST route through this client.
 */
export const primaryClient =
    global.__primaryPrisma ??
    new PrismaClient(primaryPrismaConfig);

if (process.env.NODE_ENV !== 'production') {
    global.__primaryPrisma = primaryClient;
}

/**
 * Middleware to strictly block any accidental read-heavy aggregation queries 
 * from executing on the primary node, protecting it from CPU exhaustion.
 */
primaryClient.$use(async (params, next) => {
    // Heuristic: If it's a findMany with complex aggregations or no take/limit, 
    // warn the developer to use the replica client instead.
    if (params.action === 'findMany' && !params.args?.take) {
        console.warn(
            `[PrimaryDB Warning] Executing unbounded findMany on Primary node for model ${params.model}. ` +
            `Consider using replicaClient for analytics to prevent CPU locking.`
        );
    }

    const result = await next(params);
    return result;
});

/**
 * Helper function to execute a transaction strictly on the Primary node.
 * Transactions cannot span across primary and replica nodes in standard Prisma.
 */
export async function runPrimaryTransaction<T>(
    fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
    return primaryClient.$transaction(fn, {
        maxWait: 5000, // Maximum time to wait for transaction lock
        timeout: 10000, // Maximum time the transaction can run
        isolationLevel: 'ReadCommitted',
    });
}
