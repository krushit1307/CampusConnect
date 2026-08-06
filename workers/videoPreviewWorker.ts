// =============================================================================
// Worker: Video Preview Generator (Node.js + BullMQ + FFmpeg)
// Issue: #2402 - Async generation of looping video previews via FFmpeg
// Description: Background worker that processes video upload jobs, executes
// ffmpeg to extract 3-second silent 480p webm previews, and uploads to S3.
// Concurrency is strictly set to 1 to prevent CPU exhaustion.
// =============================================================================

import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import ffmpeg from "fluent-ffmpeg";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import os from "os";

// Redis connection for BullMQ
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Supabase client with service role key for storage access
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface VideoPreviewJobData {
  eventId: string;
  videoUrl: string;
  userId: string;
}

/**
 * Processes a single video preview generation job
 */
async function processVideoPreview(job: Job<VideoPreviewJobData>) {
  const { eventId, videoUrl, userId } = job.data;

  console.log(`[Worker] Starting preview generation for event ${eventId}`);

  // Create temporary directory for processing
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "video-preview-"));
  const inputPath = path.join(tempDir, "input.mp4");
  const outputPath = path.join(tempDir, "preview.webm");

  try {
    // Step 1: Download the original video to temp directory
    await job.updateProgress(10);
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error("Failed to download video");

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(buffer));

    // Step 2: Execute ffmpeg to extract 3 seconds, strip audio, scale to 480p, encode as webm
    await job.updateProgress(30);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions(["-ss", "00:00:10"]) // Start 10 seconds in
        .outputOptions([
          "-t",
          "3", // Exactly 3 seconds long
          "-an", // Strip audio track
          "-vf",
          "scale=480:-1", // Scale down to 480p maintaining aspect ratio
          "-c:v",
          "libvpx-vp9", // VP9 codec for webm
          "-crf",
          "30", // High compression
          "-b:v",
          "0", // Variable bitrate
        ])
        .output(outputPath)
        .on("end", () => {
          console.log("[Worker] FFmpeg processing complete");
          resolve();
        })
        .on("error", (err) => {
          console.error("[Worker] FFmpeg error:", err);
          reject(err);
        })
        .run();
    });

    // Step 3: Upload the resulting tiny .webm file to Supabase Storage
    await job.updateProgress(70);
    const fileBuffer = fs.readFileSync(outputPath);
    const fileName = `previews/${eventId}_${Date.now()}.webm`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("event-banners") // Using existing bucket or create dedicated 'previews' bucket
      .upload(fileName, fileBuffer, {
        contentType: "video/webm",
        cacheControl: "31536000", // Cache for 1 year
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Step 4: Get public URL and update database column
    await job.updateProgress(90);
    const {
      data: { publicUrl },
    } = supabase.storage.from("event-banners").getPublicUrl(fileName);

    const { error: dbError } = await supabase
      .from("events")
      .update({ preview_url: publicUrl })
      .eq("id", eventId);

    if (dbError) throw dbError;

    // Cleanup temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
    fs.rmdirSync(tempDir);

    await job.updateProgress(100);
    console.log(`[Worker] Successfully generated preview for event ${eventId}`);
    return { success: true, previewUrl: publicUrl };
  } catch (error) {
    console.error(`[Worker] Failed to process job ${job.id}:`, error);
    // Cleanup on error
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    throw error;
  }
}

// Initialize BullMQ Worker with STRICT concurrency of 1 to protect server CPU
const worker = new Worker("video-preview-queue", processVideoPreview, {
  connection,
  concurrency: 1, // CRITICAL: Force sequential encoding to prevent CPU exhaustion
  limiter: {
    max: 1,
    duration: 60000, // Max 1 job per minute as additional safeguard
  },
});

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
});

console.log("[Worker] Video Preview Worker started and listening for jobs...");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
});
