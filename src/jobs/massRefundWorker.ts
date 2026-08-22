import { Queue, Worker, Job } from "bullmq";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2023-10-16" as any,
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

export interface MassRefundJobData {
  eventId: string;
  reason?: string;
}

const QUEUE_NAME = "mass-refund-queue";

export const massRefundQueue = new Queue<MassRefundJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const massRefundWorker = new Worker<MassRefundJobData>(
  QUEUE_NAME,
  async (job: Job<MassRefundJobData>) => {
    const { eventId, reason } = job.data;

    console.log(`Starting mass refund for event: ${eventId}`);

    const { data: rsvps, error: fetchError } = await supabase
      .from("event_rsvps")
      .select("id, user_id, payment_intent_id, paid_amount_cents, status")
      .eq("event_id", eventId)
      .in("status", ["attending", "approved", "waitlisted"]);

    if (fetchError) throw new Error(`Fetch failed: ${fetchError.message}`);
    if (!rsvps || rsvps.length === 0) return { status: "completed", refundedCount: 0 };

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < rsvps.length; i++) {
      const rsvp = rsvps[i];
      try {
        if (!rsvp.payment_intent_id) throw new Error("Missing payment_intent_id");

        const refund = await stripe.refunds.create({
          payment_intent: rsvp.payment_intent_id,
          reason: (reason as Stripe.RefundCreateParams.Reason) || "requested_by_customer",
        });

        await supabase.from("refund_logs").insert({
          rsvp_id: rsvp.id,
          payment_intent_id: rsvp.payment_intent_id,
          stripe_refund_id: refund.id,
          refund_amount_cents: rsvp.paid_amount_cents,
          refund_status: "completed",
        });

        await supabase.from("event_rsvps").update({ status: "cancelled" }).eq("id", rsvp.id);
        successCount++;
      } catch (error: any) {
        failCount++;
        await supabase.from("refund_logs").insert({
          rsvp_id: rsvp.id,
          payment_intent_id: rsvp.payment_intent_id,
          refund_amount_cents: rsvp.paid_amount_cents,
          refund_status: "failed",
        });
      }

      await job.updateProgress(Math.floor(((i + 1) / rsvps.length) * 100));
    }

    if (failCount > 0 && successCount === 0) throw new Error(`All ${failCount} refunds failed.`);
    return { status: "completed", totalProcessed: rsvps.length, successCount, failCount };
  },
  {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  },
);
