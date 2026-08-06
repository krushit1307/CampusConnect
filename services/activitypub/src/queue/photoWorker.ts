/* eslint-disable no-console */
import { Worker } from "bullmq";
import AdmZip from "adm-zip";
import * as fs from "fs";
import { redisConnection } from "./connection";
import { getSupabase } from "../db";

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

// Instantiate the BullMQ Worker
export const photoWorker = new Worker(
  "PhotoProcessing",
  async (job) => {
    const { filePath, eventId, jobId } = job.data as {
      filePath: string;
      eventId: string;
      jobId: string;
    };

    console.log(`[Worker] Started processing job ${job.id} for event ${eventId}`);
    const supabase = getSupabase();

    // 1. Update database job status to PROCESSING
    await supabase
      .from("photo_upload_jobs")
      .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
      .eq("id", jobId);

    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`ZIP file not found at path: ${filePath}`);
      }

      // 2. Read ZIP archive using adm-zip
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      console.log(`[Worker] Found ${zipEntries.length} entries in ZIP file`);

      // 3. Process each entry and upload to Supabase Storage
      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;

        // Skip metadata / OS system files (e.g. __MACOSX, .DS_Store)
        if (entry.entryName.includes("__MACOSX") || entry.entryName.endsWith(".DS_Store")) {
          continue;
        }

        const mimeType = getMimeType(entry.name);
        // Only process image files
        if (!mimeType.startsWith("image/")) {
          console.log(`[Worker] Skipping non-image entry: ${entry.entryName}`);
          continue;
        }

        const buffer = entry.getData();
        const storagePath = `${eventId}/${entry.name}`;

        console.log(`[Worker] Uploading ${entry.name} to storage bucket: event-gallery`);

        const { error: uploadError } = await supabase.storage
          .from("event-gallery")
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Failed to upload ${entry.name}: ${uploadError.message}`);
        }
      }

      // 4. Update database job status to COMPLETED
      await supabase
        .from("photo_upload_jobs")
        .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
        .eq("id", jobId);

      console.log(`[Worker] Job ${job.id} completed successfully`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Worker] Job ${job.id} failed:`, error);

      // Update database job status to FAILED
      await supabase
        .from("photo_upload_jobs")
        .update({
          status: "FAILED",
          error_message: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw error; // Re-throw to let BullMQ handle attempts/retries
    } finally {
      // 5. Clean up the temporary ZIP file
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`[Worker] Temporary file deleted: ${filePath}`);
        }
      } catch (cleanupError) {
        console.error(`[Worker] Failed to clean up temporary file ${filePath}:`, cleanupError);
      }
    }
  },
  {
    connection: redisConnection,
    lockDuration: 30000, // 30 seconds lock
    stalledInterval: 10000, // Check for stalled jobs every 10 seconds
    maxStalledCount: 3, // Allow up to 3 stalls before failure
  },
);

// Graceful shutdown on process exit
photoWorker.on("error", (err) => {
  console.error("[Worker] Global worker error:", err);
});
