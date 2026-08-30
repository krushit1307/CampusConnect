// server/routes/sponsorWebhookRoutes.ts
// Sponsor CRM Webhook routes with fallback queue
// Issue #4989

import { Router, Request, Response } from "express";
import {
  enqueueWebhook,
  deliverWebhook,
  logAttempt,
  getQueueMetrics,
  WebhookPayload,
} from "../services/webhookQueueService";
import { Pool } from "pg";

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * POST /api/v1/sponsor-webhooks/send
 * Send a lead payload to a sponsor's CRM
 * Falls back to queue on failure
 */
router.post("/send", async (req: Request, res: Response) => {
  try {
    const { sponsorId, payload } = req.body;

    if (!sponsorId || !payload) {
      return res.status(400).json({
        error: "Missing required fields: sponsorId, payload",
      });
    }

    // Get sponsor's CRM webhook URL
    const sponsorResult = await pool.query(
      "SELECT id, company_name, contact_email FROM sponsors WHERE id = $1 AND is_active = true",
      [sponsorId],
    );

    if (sponsorResult.rows.length === 0) {
      return res.status(404).json({ error: "Sponsor not found or inactive" });
    }

    const sponsor = sponsorResult.rows[0];

    // Get the CRM webhook URL from sponsor settings
    // In production, this would come from a webhook_config table
    const crmWebhookUrl = process.env.CRM_WEBHOOK_URL || "https://httpbin.org/post";

    // Attempt immediate delivery first
    const startTime = Date.now();
    const deliveryResult = await deliverWebhook(crmWebhookUrl, payload as WebhookPayload, 0);
    const responseTimeMs = Date.now() - startTime;

    if (deliveryResult.success) {
      // Log successful attempt
      console.log(`[SPONSOR WEBHOOK] Delivered to ${sponsor.company_name} in ${responseTimeMs}ms`);

      return res.status(200).json({
        success: true,
        message: "Lead delivered to sponsor CRM",
        responseTimeMs,
        sponsorId,
        sponsorName: sponsor.company_name,
      });
    } else {
      // Delivery failed - enqueue for retry
      console.log(
        `[SPONSOR WEBHOOK] Delivery to ${sponsor.company_name} failed, enqueuing for retry`,
      );

      const queueItem = await enqueueWebhook(sponsorId, crmWebhookUrl, payload as WebhookPayload);

      return res.status(202).json({
        success: true,
        message: "Lead received and queued for retry delivery",
        queueId: queueItem.id,
        nextRetryAt: queueItem.nextRetryAt,
        sponsorId,
        sponsorName: sponsor.company_name,
      });
    }
  } catch (error) {
    console.error("[SPONSOR WEBHOOK] Error processing webhook:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/sponsor-webhooks/metrics
 * Get queue metrics for monitoring
 */
router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const metrics = await getQueueMetrics();

    return res.status(200).json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error("[SPONSOR WEBHOOK] Error fetching metrics:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/v1/sponsor-webhooks/status/:queueId
 * Check status of a specific queued webhook
 */
router.get("/status/:queueId", async (req: Request, res: Response) => {
  try {
    const { queueId } = req.params;

    const result = await pool.query(
      `SELECT wq.*, 
                    (SELECT COUNT(*) FROM webhook_attempts WHERE queue_id = wq.id) as attempt_count,
                    (SELECT MAX(http_status) FROM webhook_attempts WHERE queue_id = wq.id) as last_http_status
             FROM webhook_queue wq
             WHERE wq.id = $1`,
      [queueId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Queue item not found" });
    }

    const item = result.rows[0];

    return res.status(200).json({
      success: true,
      status: item.status,
      attemptCount: item.attempt_count,
      lastAttemptAt: item.last_attempt_at,
      nextRetryAt: item.next_retry_at,
      createdAt: item.created_at,
    });
  } catch (error) {
    console.error("[SPONSOR WEBHOOK] Error fetching status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
