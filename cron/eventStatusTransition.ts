import { query, closePool } from "../graphql/db";

/**
 * Sweeps the database to transition event statuses based on current timestamps.
 * Enforces UTC-alignment since start_date and end_date are timestamptz.
 */
export const transitionEventStatuses = async () => {
  console.log("[SYSTEM] Scanning for event status transitions...");

  try {
    // 1. Transition UPCOMING events to ONGOING when they have started
    const ongoingQuery = `
      UPDATE events
      SET status = 'ONGOING',
          updated_at = NOW()
      WHERE status = 'UPCOMING'
        AND start_date <= NOW()
        AND end_date > NOW();
    `;
    const ongoingRes = await query(ongoingQuery);
    console.log(`[SYSTEM] Transitioned ${ongoingRes.rowCount} events to ONGOING.`);

    // 2. Transition UPCOMING or ONGOING events to COMPLETED when they have ended
    const completedQuery = `
      UPDATE events
      SET status = 'COMPLETED',
          updated_at = NOW()
      WHERE status IN ('UPCOMING', 'ONGOING')
        AND end_date <= NOW();
    `;
    const completedRes = await query(completedQuery);
    console.log(`[SYSTEM] Transitioned ${completedRes.rowCount} events to COMPLETED.`);
  } catch (error) {
    console.error("[SYSTEM ERROR] Event status transition failed:", error);
    throw error;
  }
};

// Self-executing if invoked directly via CLI (e.g. npx tsx cron/eventStatusTransition.ts)
if (
  process.argv[1] &&
  (process.argv[1].endsWith("eventStatusTransition.ts") ||
    process.argv[1].endsWith("eventStatusTransition.js"))
) {
  (async () => {
    try {
      await transitionEventStatuses();
      await closePool();
      process.exit(0);
    } catch (err) {
      console.error("[CLI Execution] Failed:", err);
      try {
        await closePool();
      } catch (e) {
        // ignore
      }
      process.exit(1);
    }
  })();
}
