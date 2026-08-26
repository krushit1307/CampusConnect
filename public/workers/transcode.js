// Web Worker for client-side multi-threaded video transcoding using FFmpeg.wasm

// Load FFmpeg.wasm from CDN
importScripts("https://unpkg.com/@ffmpeg/ffmpeg@0.11.0/dist/ffmpeg.min.js");

let ffmpegInstance = null;

async function initFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;

  const { createFFmpeg } = self.FFmpeg;

  // Detect SharedArrayBuffer support to decide whether to use multi-threading
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== "undefined";
  console.log("[Transcode Worker] SharedArrayBuffer supported:", hasSharedArrayBuffer);

  const corePath = hasSharedArrayBuffer
    ? "https://unpkg.com/@ffmpeg/core-mt@0.11.0/dist/ffmpeg-core.js"
    : "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js";

  console.log("[Transcode Worker] Initializing FFmpeg with core path:", corePath);

  ffmpegInstance = createFFmpeg({
    log: true,
    corePath: corePath,
  });

  await ffmpegInstance.load();
  console.log("[Transcode Worker] FFmpeg loaded successfully");
  return ffmpegInstance;
}

self.onmessage = async (e) => {
  const { type, fileData, fileName } = e.data;

  if (type === "transcode") {
    try {
      console.log("[Transcode Worker] Starting transcode pipeline for:", fileName);
      const ffmpeg = await initFFmpeg();

      // Write the input raw video file into FFmpeg's virtual file system (MEMFS)
      const inputName = "input_raw";
      const outputName = "output.mp4";

      ffmpeg.FS("writeFile", inputName, new Uint8Array(fileData));

      // Hook progress reporting to post percentage updates back to the main thread
      ffmpeg.setProgress(({ ratio }) => {
        const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
        self.postMessage({
          type: "progress",
          progress: percent,
        });
      });

      console.log("[Transcode Worker] Running FFmpeg transcoding...");
      // Optimize compression parameters:
      // - CRF 28 provides substantial compression (~80-90% reduction) with solid visual quality.
      // - veryfast preset keeps execution speed reasonable in a client-side context.
      // - scale filter resizes width to 1280px if larger, keeping aspect ratio and ensuring height is divisible by 2.
      await ffmpeg.run(
        "-i",
        inputName,
        "-vcodec",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "28",
        "-acodec",
        "aac",
        "-b:a",
        "128k",
        "-vf",
        "scale=min(1280\\,iw):-2",
        outputName,
      );

      console.log("[Transcode Worker] Transcoding finished. Reading output file...");

      // Read transcoded file
      const data = ffmpeg.FS("readFile", outputName);

      // Clean up files in MEMFS to free up memory
      ffmpeg.FS("unlink", inputName);
      ffmpeg.FS("unlink", outputName);

      console.log("[Transcode Worker] Cleaned MEMFS, sending result back to main thread");

      // Transfer the array buffer ownership back to main thread (zero-copy)
      self.postMessage(
        {
          type: "done",
          fileData: data.buffer,
        },
        [data.buffer],
      );
    } catch (error) {
      console.error("[Transcode Worker] Error during transcoding:", error);
      self.postMessage({
        type: "error",
        error: error.message || String(error),
      });
    }
  }
};
