// =============================================================================
// Worker: Image Compression Generator (Node.js + BullMQ)
// Issue: #2207 - Offload heavy image compression to Worker Threads
// Description: Background worker that processes image upload jobs, executes
// compression, and uploads to S3.
// Concurrency is strictly set to 1 to prevent CPU exhaustion.
// =============================================================================

import { Worker as NodeWorker } from "node:worker_threads";
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";

// Redis connection for BullMQ
const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Supabase client with service role key for storage access
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface ImageCompressionJobData {
  bucket: string;
  filePath: string;
  maxWidth?: number;
  quality?: number;
}

const WORKER_TIMEOUT_MS = 30000;

interface WorkerResponseSuccess {
  success: true;
  arrayBuffer: ArrayBuffer;
}

interface WorkerResponseError {
  success: false;
  error: string;
}

type WorkerResponse = WorkerResponseSuccess | WorkerResponseError;

/**
 * Executes image processing in a separate worker thread.
 */
function processInWorker(
  arrayBuffer: ArrayBuffer,
  maxWidth?: number,
  quality?: number,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    let isDone = false;
    const workerUrl = new URL("./imageProcessor.worker.ts", import.meta.url);
    const worker = new NodeWorker(workerUrl);

    const cleanup = () => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timeout);
      worker.terminate();
    };

    const timeout = setTimeout(() => {
      if (isDone) return;
      cleanup();
      reject(new Error(`Worker thread timed out after ${WORKER_TIMEOUT_MS}ms`));
    }, WORKER_TIMEOUT_MS);

    worker.on("message", (message: WorkerResponse) => {
      if (isDone) return;
      cleanup();
      if (!message.success) {
        reject(new Error(`Worker returned error payload: ${message.error}`));
      } else {
        resolve(message.arrayBuffer);
      }
    });

    worker.on("error", (err) => {
      if (isDone) return;
      cleanup();
      reject(err);
    });

    worker.on("exit", (code) => {
      if (isDone) return;
      cleanup();
      if (code === 0) {
        reject(new Error("Worker exited before sending a response."));
        return;
      }

      reject(new Error(`Worker exited with code ${code}`));
    });

    // Use transferList for zero-copy transfer of the ArrayBuffer
    worker.postMessage({ arrayBuffer, maxWidth, quality }, [arrayBuffer]);
  });
}

/**
 * Processes a single image compression job
 */
async function processImageCompression(job: Job<ImageCompressionJobData>) {
  const { bucket, filePath, maxWidth, quality } = job.data;

  if (typeof bucket !== "string" || bucket.trim() === "") {
    throw new Error("Invalid job payload: bucket must be a non-empty string");
  }

  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new Error("Invalid job payload: filePath must be a non-empty string");
  }

  if (maxWidth !== undefined && (!Number.isInteger(maxWidth) || maxWidth <= 0)) {
    throw new Error("Invalid job payload: maxWidth must be a positive integer");
  }

  if (quality !== undefined && (!Number.isInteger(quality) || quality < 1 || quality > 100)) {
    throw new Error("Invalid job payload: quality must be an integer between 1 and 100");
  }

  console.log(`[Worker] Starting compression for image: ${filePath} in bucket: ${bucket}`);

  try {
    await job.updateProgress(10);

    // Step 1: Download original image buffer from Supabase Storage
    const { data, error: downloadError } = await supabase.storage.from(bucket).download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download image from storage: ${downloadError.message}`);
    }

    if (!data) {
      throw new Error("Downloaded image data is null");
    }

    const arrayBuffer = await data.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      throw new Error("Downloaded image array buffer is empty");
    }

    await job.updateProgress(30);
    const processedBuffer = await processInWorker(arrayBuffer, maxWidth, quality);

    await job.updateProgress(70);

    const uploadBuffer = Buffer.from(processedBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, uploadBuffer, {
        contentType: data.type,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload processed image to storage: ${uploadError.message}`);
    }

    // TODO: Get public URL and update database column if necessary

    await job.updateProgress(100);
    console.log(`[Worker] Successfully compressed image: ${filePath}`);

    return {
      success: true,
      bucket,
      filePath,
    };
  } catch (error) {
    console.error(`[Worker] Failed to process job ${job.id}:`, error);

    // TODO: Cleanup temporary files or resources if applicable

    throw error;
  }
}

// Initialize BullMQ Worker with STRICT concurrency of 1 to protect server CPU
const worker = new Worker("image-compression-queue", processImageCompression, {
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

console.log("[Worker] Image Compression Worker started and listening for jobs...");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
});
