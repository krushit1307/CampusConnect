// server/services/webhookQueueService.ts
// CRM Webhook Fallback Queue with Exponential Backoff
// Issue #4989

import { Pool } from "pg";
import { createHash } from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ============================================
// TYPES
// ============================================

export interface WebhookPayload {
  eventType: string;
  studentId?: string;
  studentName?: string;
  email?: string;
  resumeUrl?: string;
  jobId?: string;
  jobTitle?: string;
  metadata?: Record<string, unknown>;
}

export interface WebhookQueueItem {
  id: string;
  sponsorId: string;
  crmWebhookUrl: string;
  payload: WebhookPayload;
  payloadHash: string;
  status: "pending" | "retrying" | "dlq" | "delivered" | "expired";
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
}

export interface WebhookAttempt {
  id: string;
  queueId: string;
  attemptNumber: number;
  attemptedAt: Date;
  httpStatus: number | null;
  responseTimeMs: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  workerId: string;
}

// Exponential backoff delays in minutes
// Retry schedule: 1min, 5min, 30min, 2hr, 6hr, 12hr, 24hr, 24hr, 24hr, 24hr
const RETRY_DELAYS_MINUTES = [1, 5, 30, 120, 360, 720, 1440, 1440, 1440, 1440];
const MAX_RETRY_DELAYS = RETRY_DELAYS_MINUTES.length;

// ============================================
// CORE QUEUE OPERATIONS
// ============================================

/**
 * Generate a SHA-256 hash of the payload for deduplication
 */
export function generatePayloadHash(payload: WebhookPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Enqueue a failed webhook payload for retry
 */
export async function enqueueWebhook(
  sponsorId: string,
  crmWebhookUrl: string,
  payload: WebhookPayload,
): Promise<WebhookQueueItem> {
  const payloadHash = generatePayloadHash(payload);

  // Check for duplicate payload within last 5 minutes
  const existing = await pool.query(
    `SELECT id FROM webhook_queue 
         WHERE sponsor_id = $1 AND payload_hash = $2 
         AND created_at > NOW() - INTERVAL '5 minutes'`,
    [sponsorId, payloadHash],
  );

  if (existing.rows.length > 0) {
    console.log(`[WEBHOOK QUEUE] Duplicate payload detected, skipping enqueue`);
    return { ...existing.rows[0], payload, status: "pending" } as WebhookQueueItem;
  }

  const nextRetryAt = calculateNextRetryTime(0);

  const result = await pool.query(
    `INSERT INTO webhook_queue (sponsor_id, crm_webhook_url, payload, payload_hash, next_retry_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
    [sponsorId, crmWebhookUrl, JSON.stringify(payload), payloadHash, nextRetryAt],
  );

  const item = result.rows[0];
  console.log(`[WEBHOOK QUEUE] Enqueued webhook ${item.id} for sponsor ${sponsorId}`);

  return item;
}

/**
 * Calculate next retry time based on attempt number
 * Uses exponential backoff with jitter
 */
export function calculateNextRetryTime(attemptNumber: number): Date {
  const delayMinutes = RETRY_DELAYS_MINUTES[Math.min(attemptNumber, MAX_RETRY_DELAYS - 1)];

  // Add jitter (±10% of delay)
  const jitter = delayMinutes * 0.1 * (Math.random() * 2 - 1);
  const totalMinutes = delayMinutes + jitter;

  const nextRetry = new Date();
  nextRetry.setMinutes(nextRetry.getMinutes() + totalMinutes);

  return nextRetry;
}

/**
 * Get the next batch of webhooks to retry
 */
export async function getPendingRetries(limit: number = 50): Promise<WebhookQueueItem[]> {
  const result = await pool.query(
    `SELECT * FROM webhook_queue 
         WHERE status IN ('pending', 'retrying')
           AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         ORDER BY created_at ASC
         LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    ...row,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
  }));
}

/**
 * Mark a webhook as retrying and update retry state
 */
export async function markRetrying(queueId: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_queue 
         SET status = 'retrying', last_attempt_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
    [queueId],
  );
}

/**
 * Mark a webhook as delivered
 */
export async function markDelivered(queueId: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_queue 
         SET status = 'delivered', updated_at = NOW()
         WHERE id = $1`,
    [queueId],
  );

  console.log(`[WEBHOOK QUEUE] Webhook ${queueId} delivered successfully`);
}

/**
 * Schedule next retry or move to DLQ
 */
export async function scheduleNextRetryOrDLQ(
  queueId: string,
  attemptCount: number,
  errorMessage: string,
): Promise<{ shouldRetry: boolean; moveToDLQ: boolean }> {
  const shouldRetry = attemptCount < MAX_RETRY_DELAYS;

  if (shouldRetry) {
    const nextRetryAt = calculateNextRetryTime(attemptCount);

    await pool.query(
      `UPDATE webhook_queue 
             SET attempt_count = $1, next_retry_at = $2, 
                 status = 'retrying', updated_at = NOW()
             WHERE id = $3`,
      [attemptCount, nextRetryAt, queueId],
    );

    console.log(
      `[WEBHOOK QUEUE] Scheduled retry ${attemptCount + 1} for ${queueId} at ${nextRetryAt}`,
    );

    return { shouldRetry: true, moveToDLQ: false };
  } else {
    // Move to DLQ
    await moveToDeadLetterQueue(queueId, errorMessage);
    return { shouldRetry: false, moveToDLQ: true };
  }
}

/**
 * Move a webhook to the Dead-Letter Queue
 */
export async function moveToDeadLetterQueue(queueId: string, finalError: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get queue item details
    const queueItem = await client.query("SELECT * FROM webhook_queue WHERE id = $1", [queueId]);

    if (queueItem.rows.length === 0) {
      throw new Error(`Queue item ${queueId} not found`);
    }

    const item = queueItem.rows[0];

    // Insert into DLQ
    await client.query(
      `INSERT INTO webhook_dlq 
             (queue_id, final_error, total_attempts, first_attempt_at, last_attempt_at, time_to_dlq)
             VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        queueId,
        finalError,
        item.attempt_count,
        item.created_at,
        item.last_attempt_at || item.created_at,
        new Date().getTime() - new Date(item.created_at).getTime(),
      ],
    );

    // Update queue item status
    await client.query(
      `UPDATE webhook_queue 
             SET status = 'dlq', moved_to_dlq_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
      [queueId],
    );

    await client.query("COMMIT");

    console.log(`[WEBHOOK QUEUE] Moved ${queueId} to DLQ after ${item.attempt_count} attempts`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Log a webhook delivery attempt
 */
export async function logAttempt(
  queueId: string,
  attemptNumber: number,
  httpStatus: number | null,
  responseTimeMs: number | null,
  responseBody: string | null,
  errorMessage: string | null,
  workerId: string = "default",
): Promise<WebhookAttempt> {
  const result = await pool.query(
    `INSERT INTO webhook_attempts 
         (queue_id, attempt_number, http_status, response_time_ms, response_body, error_message, worker_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
    [queueId, attemptNumber, httpStatus, responseTimeMs, responseBody, errorMessage, workerId],
  );

  return result.rows[0];
}

// ============================================
// HTTP DELIVERY
// ============================================

/**
 * Attempt to deliver webhook payload to CRM
 */
export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  attemptNumber: number,
): Promise<{
  success: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  responseBody: string;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CampusConnect-Attempt": String(attemptNumber),
        "X-CampusConnect-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseTimeMs = Date.now() - startTime;
    const responseBody = await response.text().catch(() => "");

    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      httpStatus: response.status,
      responseTimeMs,
      responseBody: responseBody.substring(0, 1000), // Truncate long responses
      error: success ? undefined : `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      httpStatus: null,
      responseTimeMs,
      responseBody: "",
      error: errorMsg,
    };
  }
}

// ============================================
// DLQ OPERATIONS
// ============================================

/**
 * Get all DLQ items for a sponsor (for CSV export)
 */
export async function getDLQItemsForSponsor(sponsorId: string): Promise<WebhookQueueItem[]> {
  const result = await pool.query(
    `SELECT wq.*, wdlq.total_attempts, wdlq.final_error, wdlq.first_attempt_at, wdlq.last_attempt_at
         FROM webhook_queue wq
         JOIN webhook_dlq wdlq ON wdlq.queue_id = wq.id
         WHERE wq.sponsor_id = $1
         ORDER BY wq.created_at ASC`,
    [sponsorId],
  );

  return result.rows.map((row) => ({
    ...row,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
  }));
}

/**
 * Generate CSV content for DLQ items
 */
export function generateDLQCSV(items: WebhookQueueItem[]): string {
  const headers = [
    "ID",
    "Event Type",
    "Student Name",
    "Email",
    "Job Title",
    "Created At",
    "Total Attempts",
    "Final Error",
  ];

  const rows = items.map((item) =>
    [
      item.id,
      item.payload.eventType || "",
      item.payload.studentName || "",
      item.payload.email || "",
      item.payload.jobTitle || "",
      item.createdAt.toISOString(),
      String(item.attemptCount),
      (item as any).finalError || "",
    ]
      .map((val) => `"${val.replace(/"/g, '""')}"`)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Mark DLQ items as exported
 */
export async function markDLQExported(queueIds: string[], csvFilePath: string): Promise<void> {
  await pool.query(
    `UPDATE webhook_dlq 
         SET csv_generated_at = NOW(), csv_file_path = $1
         WHERE queue_id = ANY($2)`,
    [csvFilePath, queueIds],
  );

  await pool.query(
    `UPDATE webhook_queue 
         SET dlq_csv_exported = TRUE, updated_at = NOW()
         WHERE id = ANY($1)`,
    [queueIds],
  );
}

// ============================================
// QUEUE METRICS
// ============================================

export interface QueueMetrics {
  pending: number;
  retrying: number;
  delivered: number;
  dlq: number;
  totalAttempts: number;
  avgResponseTimeMs: number;
}

/**
 * Get queue metrics for monitoring
 */
export async function getQueueMetrics(): Promise<QueueMetrics> {
  const statusResult = await pool.query(
    `SELECT status, COUNT(*) as count
         FROM webhook_queue
         GROUP BY status`,
  );

  const metrics: QueueMetrics = {
    pending: 0,
    retrying: 0,
    delivered: 0,
    dlq: 0,
    totalAttempts: 0,
    avgResponseTimeMs: 0,
  };

  for (const row of statusResult.rows) {
    metrics[row.status as keyof QueueMetrics] = parseInt(row.count);
  }

  const attemptsResult = await pool.query(
    `SELECT COUNT(*) as total, AVG(response_time_ms) as avg_time
         FROM webhook_attempts`,
  );

  if (attemptsResult.rows.length > 0) {
    metrics.totalAttempts = parseInt(attemptsResult.rows[0].total) || 0;
    metrics.avgResponseTimeMs = parseFloat(attemptsResult.rows[0].avg_time) || 0;
  }

  return metrics;
}
