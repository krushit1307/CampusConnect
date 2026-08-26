import { Pool, type PoolConfig } from "pg";

/**
 * Shared Postgres connection pool for GraphQL resolvers that need
 * direct SQL access (heavy/hot read paths). This pool is created
 * ONCE at module load and reused across all requests — never
 * instantiate a new Pool or Client per-request.
 *
 * Connects through Supavisor / pgBouncer (see terraform/pgbouncer.tf,
 * docs/ARCHITECTURE.md) rather than directly against Postgres, so the
 * effective number of upstream Postgres connections stays bounded even
 * if `max` here is scaled up.
 *
 * Required env vars:
 *   DATABASE_URL          - full postgres connection string pointed at
 *                           the Supavisor/pgBouncer endpoint (NOT the
 *                           direct DB host) e.g.
 *                           postgres://user:pass@supavisor-host:6543/postgres
 *   DB_POOL_MAX           - optional, max clients in this pool (default 10)
 *   DB_POOL_IDLE_TIMEOUT  - optional, ms before idle client is closed (default 30000)
 *   DB_POOL_CONN_TIMEOUT  - optional, ms to wait for a connection before erroring (default 5000)
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "[db] DATABASE_URL is not set. It must point at the Supavisor/pgBouncer " +
      "connection string, not the direct Postgres host.",
  );
}

const poolConfig: PoolConfig = {
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT ?? 30_000),
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONN_TIMEOUT ?? 5_000),
};

export const pool = new Pool(poolConfig);

// Surface pool-level errors (e.g. a backend closing an idle connection)
// instead of letting them crash the process silently.
pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle pg client", err);
});

/**
 * Run a parameterized query using the shared pool.
 * Prefer this helper in resolvers over calling pool.query directly,
 * so we have one place to add logging/metrics later.
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;

  if (duration > 200) {
    console.warn(`[db] slow query (${duration}ms): ${text}`);
  }

  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
}

/**
 * Graceful shutdown hook — call this from server teardown/tests so the
 * pool doesn't keep the process alive or leak connections between test runs.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
