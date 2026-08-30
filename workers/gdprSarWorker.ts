// =============================================================================
// Worker: GDPR SAR Compilation Engine (Node.js + BullMQ)
// Issue: #4733 - Fan-out subject access data, encrypt the archive, and email
// a signed download link that expires in 30 days.
// =============================================================================

import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import {
  GDPR_SAR_QUEUE_NAME,
  SAR_DOWNLOAD_TTL_SECONDS,
  buildGdprSarDocument,
  buildGdprSarReadyEmail,
  encryptSarArchive,
  serializeSarArchive,
  type GdprSarTablePayload,
} from "../src/lib/gdprSarArchive";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const queue = new Queue(GDPR_SAR_QUEUE_NAME, { connection });

type GdprSarJobData = {
  requestId: string;
  userId: string;
};

async function processGdprSar(job: Job<GdprSarJobData>) {
  const { requestId, userId } = job.data;

  await supabase.from("gdpr_sar_requests").update({ status: "processing" }).eq("id", requestId);

  try {
    const { data: tables, error: rpcError } = await supabase.rpc("compile_gdpr_sar_dataset", {
      p_user_id: userId,
    });
    if (rpcError) throw rpcError;

    const document = buildGdprSarDocument(userId, (tables || {}) as GdprSarTablePayload);
    const { key, blob } = encryptSarArchive(serializeSarArchive(document));
    const storagePath = `${userId}/${requestId}/sar.enc`;

    const { error: uploadError } = await supabase.storage
      .from("data-exports")
      .upload(storagePath, new Uint8Array(blob), {
        contentType: "application/octet-stream",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: signed, error: signedError } = await supabase.storage
      .from("data-exports")
      .createSignedUrl(storagePath, SAR_DOWNLOAD_TTL_SECONDS);
    if (signedError) throw signedError;

    const expiresAt = new Date(Date.now() + SAR_DOWNLOAD_TTL_SECONDS * 1000);
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const emailTo = userData.user?.email;
    const email = buildGdprSarReadyEmail(signed.signedUrl, expiresAt, key.toString("hex"));
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey && emailTo) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "CampusConnect <notifications@campusconnect.app>",
          to: emailTo,
          subject: email.subject,
          html: email.html,
        }),
      });
    } else {
      console.log("[gdpr-sar] Mock email", { to: emailTo, url: signed.signedUrl });
    }

    const { error: completeError } = await supabase
      .from("gdpr_sar_requests")
      .update({
        status: "completed",
        storage_path: storagePath,
        completed_at: new Date().toISOString(),
        download_expires_at: expiresAt.toISOString(),
      })
      .eq("id", requestId);
    if (completeError) throw completeError;

    await job.updateProgress(100);
    return { success: true, requestId };
  } catch (error) {
    await supabase
      .from("gdpr_sar_requests")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "SAR compilation failed",
      })
      .eq("id", requestId);
    throw error;
  }
}

async function enqueuePendingRequests() {
  const { data: pending, error } = await supabase
    .from("gdpr_sar_requests")
    .select("id, user_id")
    .eq("status", "pending");
  if (error) {
    console.error("[gdpr-sar] pending drain failed", error);
    return;
  }
  for (const row of pending ?? []) {
    await queue.add(
      "compile",
      { requestId: row.id, userId: row.user_id },
      { jobId: row.id, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
    );
  }
}

const worker = new Worker(GDPR_SAR_QUEUE_NAME, processGdprSar, {
  connection,
  concurrency: 1,
});

worker.on("completed", (job) => {
  console.log(`[gdpr-sar] completed ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`[gdpr-sar] failed ${job?.id}`, err);
});

void enqueuePendingRequests();
setInterval(() => {
  void enqueuePendingRequests();
}, 5000);
