// supabase/functions/_shared/db.ts
// Centralized connection pooling manager for Deno Edge Functions using deno-postgres.
// Connects via PgBouncer / Supavisor pooler with prepared statements explicitly disabled to prevent Transaction Mode crashes.

// @ts-ignore
import { Client, Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

/**
 * Custom function to construct the pooled database connection string or options.
 * Ensures connection string targets the PgBouncer pooler (e.g. port 6543)
 * and appends `?pgbouncer=true` if not already present.
 */
export function getPooledConnectionString(rawUrl?: string): string {
  const connectionString = rawUrl || Deno.env.get("DATABASE_URL") || "";
  if (!connectionString) {
    throw new Error("[db] DATABASE_URL environment variable is required.");
  }

  let url = connectionString;
  if (!url.includes("pgbouncer=true")) {
    url += url.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
  }
  return url;
}

// Global Pool instance lazily initialized for Edge Functions runtime container
let poolInstance: Pool | null = null;

/**
 * Returns a shared Database Pool instance configured for Edge / Serverless environments.
 * Disables native prepared statements by executing parameterized queries with explicit statement names disabled/cleared.
 */
export function getDbPool(): Pool {
  if (!poolInstance) {
    const connectionString = getPooledConnectionString();
    const maxConnections = Number(Deno.env.get("DB_POOL_MAX") ?? 10);
    poolInstance = new Pool(connectionString, maxConnections, true);
  }
  return poolInstance;
}

/**
 * Helper to execute a query using a connection from the pool without prepared statements.
 * @param queryText SQL query string
 * @param args Query parameters
 */
export async function executePooledQuery<T = Record<string, unknown>>(
  queryText: string,
  args: unknown[] = [],
): Promise<T[]> {
  const pool = getDbPool();
  const client: Client = await pool.connect();
  try {
    // Explicitly pass query with args and no statement name to disable Prepared Statements in PgBouncer mode
    const result = await client.queryObject<T>({
      text: queryText,
      args,
    });
    return result.rows;
  } finally {
    client.release();
  }
}
