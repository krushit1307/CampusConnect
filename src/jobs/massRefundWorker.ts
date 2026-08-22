import { Queue, Worker, Job } from "bullmq";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16" as any, // specify current api version or let typescript infer if installed
});

// Initialize Supabase with service role key to bypass RLS for background jobs
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Redis connection options
const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// Define job data interface
export interface MassRefundJobData {
  eventId: string;
  reason?: Stripe.RefundCreateParams.Reason;
}

const QUEUE_NAME = "mass-refund-queue";

/**
 * Queue for mass refunds.
 * Use massRefundQueue.add('refund-event', { eventId: '...' }) to enqueue a job.
 */
export const massRefundQueue = new Queue<MassRefundJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3, // Robustness: Retries on failure
    backoff: {
      type: "exponential",
      delay: 5000, // Wait 5s before first retry, then 25s, etc.
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for manual inspection
  },
});

/**
 * Worker that processes the mass refund jobs.
 */
export const massRefundWorker = new Worker<MassRefundJobData>(
  QUEUE_NAME,
  async (job: Job<MassRefundJobData>) => {
    const { eventId, reason } = job.data;

    console.log(`Starting mass refund for event: ${eventId}`);

    // 1. Fetch RSVPs that need to be refunded
    // Assuming status is 'paid' and they have a payment_intent_id
    const { data: rsvps, error: fetchError } = await supabase
      .from("event_rsvps")
      .select("id, user_id, payment_intent_id, paid_amount_cents, status")
      .eq("event_id", eventId)
      .in("status", ["attending", "approved", "waitlisted"]);

    if (fetchError) {
      throw new Error(`Failed to fetch RSVPs for event ${eventId}: ${fetchError.message}`);
    }

    if (!rsvps || rsvps.length === 0) {
      console.log(`No RSVPs found to refund for event ${eventId}`);
      return { status: "completed", refundedCount: 0 };
    }

    let successCount = 0;
    let failCount = 0;

    // 2. Loop over RSVPs and execute refunds
    for (let i = 0; i < rsvps.length; i++) {
      const rsvp = rsvps[i];
      try {
        if (!rsvp.payment_intent_id) {
          throw new Error("Missing payment_intent_id on RSVP");
        }

        // Execute Stripe Refund
        const refund = await stripe.refunds.create({
          payment_intent: rsvp.payment_intent_id,
          reason: reason || "requested_by_customer",
        });

        // Update Supabase refund_logs
        const { error: logError } = await supabase.from("refund_logs").insert({
          rsvp_id: rsvp.id,
          payment_intent_id: rsvp.payment_intent_id,
          stripe_refund_id: refund.id,
          refund_amount_cents: rsvp.paid_amount_cents,
          refund_status: "completed",
        });

        if (logError) {
          console.error(`Failed to log refund for RSVP ${rsvp.id}:`, logError);
          // Proceeding anyway because the refund succeeded on Stripe's end
        }

        // Update RSVP status to 'cancelled'
        await supabase.from("event_rsvps").update({ status: "cancelled" }).eq("id", rsvp.id);

        successCount++;
      } catch (error: any) {
        console.error(`Failed to process refund for RSVP ${rsvp.id}:`, error);
        failCount++;

        // Log failure in Supabase for audit
        await supabase.from("refund_logs").insert({
          rsvp_id: rsvp.id,
          payment_intent_id: rsvp.payment_intent_id,
          refund_amount_cents: rsvp.paid_amount_cents,
          refund_status: "failed",
        });
      }

      // Update job progress based on the number of processed RSVPs
      await job.updateProgress(Math.floor(((i + 1) / rsvps.length) * 100));
    }

    console.log(
      `Mass refund completed for event: ${eventId}. Success: ${successCount}, Failed: ${failCount}`,
    );

    // Fail the job if all refund attempts failed, otherwise consider the batch job partially successful
    if (failCount > 0 && successCount === 0) {
      throw new Error(`All ${failCount} refund attempts failed.`);
    }

    return {
      status: "completed",
      totalProcessed: rsvps.length,
      successCount,
      failCount,
    };
  },
  {
    connection,
    concurrency: 5, // Process up to 5 events concurrently across all worker nodes
    limiter: {
      max: 10, // Max 10 job steps...
      duration: 1000, // ...per second to avoid hitting Stripe/Supabase rate limits
    },
  },
);

// Worker event listeners for monitoring and logging
massRefundWorker.on("completed", (job) => {
  console.log(
    `Job ${job.id} completed successfully! Processed ${job.returnvalue.totalProcessed} RSVPs.`,
  );
});

massRefundWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with error: ${err.message}`);
});
