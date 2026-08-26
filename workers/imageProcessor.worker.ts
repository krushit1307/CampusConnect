import { parentPort } from "node:worker_threads";
import sharp from "sharp";

// Configure Sharp for isolated Worker Thread execution
sharp.concurrency(1);
sharp.cache(false);

interface WorkerInput {
  arrayBuffer: ArrayBuffer;
  maxWidth?: number;
  quality?: number;
}

const port = parentPort;
if (!port) {
  throw new Error("This file must be executed as a worker thread");
}

port.on("message", async (message: WorkerInput) => {
  try {
    const { arrayBuffer, maxWidth, quality } = message;

    if (!arrayBuffer) {
      throw new Error("Missing arrayBuffer in worker message");
    }

    if (arrayBuffer.byteLength === 0) {
      throw new Error("Incoming arrayBuffer is empty");
    }

    if (maxWidth !== undefined && (!Number.isInteger(maxWidth) || maxWidth <= 0)) {
      throw new Error("maxWidth must be a positive integer");
    }

    if (quality !== undefined && (!Number.isInteger(quality) || quality < 1 || quality > 100)) {
      throw new Error("quality must be an integer between 1 and 100");
    }

    // Convert the incoming ArrayBuffer to a Node.js Buffer
    const inputBuffer = Buffer.from(arrayBuffer);

    // Build the Sharp pipeline
    let pipeline = sharp(inputBuffer, { failOn: "none" });

    // Resize only if maxWidth is provided, preserving aspect ratio, never enlarging
    if (maxWidth && maxWidth > 0) {
      pipeline = pipeline.resize({
        width: maxWidth,
        withoutEnlargement: true,
      });
    }

    const qualityVal = quality || 80;

    // Compress using the supplied quality across multiple supported formats.
    // By setting `force: false`, Sharp preserves the original image format
    // and only applies the compression parameters to the matching format.
    pipeline = pipeline
      .jpeg({ quality: qualityVal, force: false })
      .webp({ quality: qualityVal, force: false })
      .png({ quality: qualityVal, force: false })
      .heif({ quality: qualityVal, force: false });

    // Execute the pipeline
    const processedBuffer = await pipeline.toBuffer();

    // Convert the processed Node.js Buffer back to a clean ArrayBuffer.
    // Buffer.buffer points to the underlying ArrayBuffer pool, so we slice it
    // to ensure we only transfer the exact bytes belonging to this image.
    const outArrayBuffer = processedBuffer.buffer.slice(
      processedBuffer.byteOffset,
      processedBuffer.byteOffset + processedBuffer.byteLength,
    ) as ArrayBuffer;

    // Return the ArrayBuffer using transferList for zero-copy transfer
    port.postMessage(
      {
        success: true,
        arrayBuffer: outArrayBuffer,
      },
      [outArrayBuffer],
    );
  } catch (error) {
    // Never throw outside the message handler; always return the failure contract
    port.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
