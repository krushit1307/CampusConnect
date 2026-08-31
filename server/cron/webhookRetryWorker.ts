// server/cron/webhookRetryWorker.ts
// Background worker for processing webhook retry queue
// Issue #4989: Real-Time "Sponsor Lead" CRM Webhook Fallback Queue

import cron from "node-cron";
import {
  getPendingRetries,
  markRetrying,
  deliverWebhook,
  logAttempt,
  scheduleNextRetryOrDLQ,
  markDelivered,
  getDLQItemsForSponsor,
  generateDLQCSV,
  markDLQExported,
  getQueueMetrics,
  WebhookQueueItem,
  WebhookPayload,
} from "../services/webhookQueueService";

const WORKER_ID = `worker-${process.env.HOSTNAME || "local"}-${Date.now()}`;
const BATCH_SIZE = 50;
const PROCESSING_INTERVAL_MS = 60_000; // Process every minute

let isProcessing = false;

/**
 * Initialize the webhook retry worker
 */
export function initWebhookRetryWorker(): void {
  console.log(`[WEBHOOK WORKER] Initializing worker ${WORKER_ID}`);

  // Run every minute
  cron.schedule("* * * * *", async () => {
    if (isProcessing) {
      console.log("[WEBHOOK WORKER] Previous batch still processing, skipping");
      return;
    }

    isProcessing = true;
    try {
      await processRetryBatch();
    } catch (error) {
      console.error("[WEBHOOK WORKER] Error in retry batch:", error);
    } finally {
      isProcessing = false;
    }
  });

  // Daily DLQ check (every day at 2 AM)
  cron.schedule("0 2 * * *", async () => {
    try {
      await processDLQCandidates();
    } catch (error) {
      console.error("[WEBHOOK WORKER] Error in DLQ processing:", error);
    }
  });

  // Daily DLQ CSV export (every day at 3 AM)
  cron.schedule("0 3 * * *", async () => {
    try {
      await exportDLQToCSV();
    } catch (error) {
      console.error("[WEBHOOK WORKER] Error in DLQ export:", error);
    }
  });

  console.log("[WEBHOOK WORKER] Worker initialized successfully");
}

/**
 * Process a batch of pending retries
 */
async function processRetryBatch(): Promise<void> {
  const pendingItems = await getPendingRetries(BATCH_SIZE);

  if (pendingItems.length === 0) {
    return;
  }

  console.log(`[WEBHOOK WORKER] Processing ${pendingItems.length} pending retries`);

  // Process items concurrently (with concurrency limit)
  const CONCURRENCY_LIMIT = 5;
  const chunks: WebhookQueueItem[][] = [];

  for (let i = 0; i < pendingItems.length; i += CONCURRENCY_LIMIT) {
    chunks.push(pendingItems.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map((item) => processWebhookItem(item)));
  }
}

/**
 * Process a single webhook item
 */
async function processWebhookItem(item: WebhookQueueItem): Promise<void> {
  try {
    // Mark as retrying
    await markRetrying(item.id);

    const attemptNumber = item.attemptCount + 1;
    const startTime = Date.now();

    // Attempt delivery
    const result = await deliverWebhook(item.crmWebhookUrl, item.payload, attemptNumber);

    const responseTimeMs = Date.now() - startTime;

    // Log the attempt
    await logAttempt(
      item.id,
      attemptNumber,
      result.httpStatus,
      responseTimeMs,
      result.responseBody,
      result.error,
      WORKER_ID,
    );

    if (result.success) {
      // Mark as delivered
      await markDelivered(item.id);
      console.log(`[WEBHOOK WORKER] Delivered webhook ${item.id} on attempt ${attemptNumber}`);
    } else {
      // Schedule next retry or move to DLQ
      const { shouldRetry, moveToDLQ } = await scheduleNextRetryOrDLQ(
        item.id,
        attemptNumber,
        result.error || "Unknown error",
      );

      if (moveToDLQ) {
        console.log(
          `[WEBHOOK WORKER] Moved webhook ${item.id} to DLQ after ${attemptNumber} attempts`,
        );
      } else {
        console.log(`[WEBHOOK WORKER] Scheduled retry ${attemptNumber + 1} for webhook ${item.id}`);
      }
    }
  } catch (error) {
    console.error(`[WEBHOOK WORKER] Error processing webhook ${item.id}:`, error);
  }
}

/**
 * Process items that have exceeded 48 hours without delivery
 */
async function processDLQCandidates(): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const result = await pool.query(`SELECT * FROM v_webhook_dlq_candidates LIMIT 100`);

    if (result.rows.length === 0) {
      console.log("[WEBHOOK WORKER] No DLQ candidates found");
      return;
    }

    console.log(`[WEBHOOK WORKER] Found ${result.rows.length} DLQ candidates`);

    for (const item of result.rows) {
      await moveToDLQ(
        item.id,
        `Exceeded 48-hour delivery window after ${item.attempt_count} attempts`,
      );
    }
  } finally {
    await pool.end();
  }
}

/**
 * Move item to DLQ (local helper)
 */
async function moveToDLQ(queueId: string, reason: string): Promise<void> {
  const { moveToDeadLetterQueue } = await import("../services/webhookQueueService");
  await moveToDeadLetterQueue(queueId, reason);
}

/**
 * Export DLQ items to CSV and notify sponsors
 */
async function exportDLQToCSV(): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Find sponsors with unexported DLQ items
    const sponsorsResult = await pool.query(
      `SELECT DISTINCT wq.sponsor_id
             FROM webhook_dlq wdlq
             JOIN webhook_queue wq ON wq.id = wdlq.queue_id
             WHERE wdlq.csv_sent_at IS NULL`,
    );

    for (const row of sponsorsResult.rows) {
      const sponsorId = row.sponsor_id;

      // Get DLQ items for this sponsor
      const items = await getDLQItemsForSponsor(sponsorId);

      if (items.length === 0) continue;

      // Generate CSV
      const csvContent = generateDLQCSV(items);
      const filePath = `/tmp/dlq-export-${sponsorId}-${Date.now()}.csv`;

      // In production, write to S3 or similar
      // For now, log it
      console.log(
        `[WEBHOOK WORKER] Generated DLQ CSV for sponsor ${sponsorId} with ${items.length} items`,
      );
      console.log(`[WEBHOOK WORKER] CSV preview:\n${csvContent.substring(0, 500)}`);

      // Mark as exported
      const queueIds = items.map((i) => i.id);
      await markDLQExported(queueIds, filePath);

      // TODO: Send email notification to sponsor with CSV attachment
      console.log(`[WEBHOOK WORKER] Would send email notification to sponsor ${sponsorId}`);
    }
  } finally {
    await pool.end();
  }
}

/**
 * Get current worker status (for monitoring endpoint)
 */
export function getWorkerStatus(): { workerId: string; isProcessing: boolean; uptime: number } {
  return {
    workerId: WORKER_ID,
    isProcessing,
    uptime: process.uptime(),
  };
}
