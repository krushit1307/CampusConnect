// =============================================================================
// Edge Function: tarpit
// Issue: #4995 - Dynamic "Early Bird" Rate-Limiting Tarpit
// Description:
//   Implements tarpitting (Slowloris defense) to exhaust bot resources instead of
//   IP banning. Returns 200 OK but streams response at agonizingly slow speed,
//   tying up the bot's thread pool waiting for the request to finish.
//
// Usage:
//   This function should be called when a bot is detected (e.g., via honey pot).
//   The bot will see a successful response but will have its connection held open
//   indefinitely, exhausting its resources.
// =============================================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

interface TarpitConfig {
  bytesPerSecond: number; // How many bytes to send per second
  maxDuration: number; // Maximum duration in seconds (0 = indefinite)
  chunkSize: number; // Size of each chunk in bytes
  initialDelay: number; // Initial delay before sending first chunk (ms)
}

const DEFAULT_CONFIG: TarpitConfig = {
  bytesPerSecond: 0.1, // 1 byte every 10 seconds
  maxDuration: 300, // 5 minutes max (safety limit)
  chunkSize: 1, // Send 1 byte at a time
  initialDelay: 1000, // Wait 1 second before first byte
};

// Generate a large, seemingly legitimate HTML response
const TARPIT_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Loading...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f0f0f0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loader"></div>
    <p style="margin-left: 20px;">Loading content...</p>
</body>
</html>
`.repeat(100); // Repeat to make it larger

async function streamResponse(
  config: TarpitConfig,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const data = encoder.encode(TARPIT_HTML);
  const totalBytes = data.length;

  let bytesSent = 0;
  const startTime = Date.now();

  return new ReadableStream({
    async start(controller) {
      try {
        // Initial delay
        await sleep(config.initialDelay);

        while (bytesSent < totalBytes) {
          // Check for abort signal
          if (signal.aborted) {
            controller.close();
            return;
          }

          // Check max duration
          const elapsed = (Date.now() - startTime) / 1000;
          if (config.maxDuration > 0 && elapsed >= config.maxDuration) {
            controller.close();
            return;
          }

          // Calculate how many bytes to send in this chunk
          const bytesToSend = Math.min(config.chunkSize, totalBytes - bytesSent);

          // Send the chunk
          const chunk = data.slice(bytesSent, bytesSent + bytesToSend);
          controller.enqueue(chunk);
          bytesSent += bytesToSend;

          // Calculate delay based on bytes per second
          const delay = (bytesToSend / config.bytesPerSecond) * 1000;
          await sleep(delay);
        }

        controller.close();
      } catch (error) {
        console.error("Tarpit stream error:", error);
        controller.error(error);
      }
    },

    cancel() {
      console.log("Tarpit stream cancelled");
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  const url = new URL(req.url);

  // Parse config from query parameters
  const config: TarpitConfig = {
    bytesPerSecond: parseFloat(
      url.searchParams.get("bps") || DEFAULT_CONFIG.bytesPerSecond.toString(),
    ),
    maxDuration: parseInt(
      url.searchParams.get("maxDuration") || DEFAULT_CONFIG.maxDuration.toString(),
    ),
    chunkSize: parseInt(url.searchParams.get("chunkSize") || DEFAULT_CONFIG.chunkSize.toString()),
    initialDelay: parseInt(
      url.searchParams.get("initialDelay") || DEFAULT_CONFIG.initialDelay.toString(),
    ),
  };

  // Validate config
  if (config.bytesPerSecond <= 0) config.bytesPerSecond = DEFAULT_CONFIG.bytesPerSecond;
  if (config.chunkSize <= 0) config.chunkSize = DEFAULT_CONFIG.chunkSize;
  if (config.initialDelay < 0) config.initialDelay = DEFAULT_CONFIG.initialDelay;

  // Get client IP for logging
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  const userAgent = req.headers.get("user-agent") || "unknown";

  console.log(`[TARPIT] Bot detected - IP: ${clientIp}, UA: ${userAgent.substring(0, 100)}`);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.maxDuration * 1000);

  try {
    // Create the slow stream
    const stream = await streamResponse(config, controller.signal);

    // Return 200 OK with slow streaming response
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Tarpit-Active": "true",
        "X-Tarpit-Duration": config.maxDuration.toString(),
        "X-Tarpit-BytesPerSecond": config.bytesPerSecond.toString(),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
});
