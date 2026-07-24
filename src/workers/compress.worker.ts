// @ts-expect-error - Local WASM pkg is generated at build time
import init, { compress_image } from "../../wasm/image-compressor/pkg/image_compressor";

self.onmessage = async (event: MessageEvent) => {
  try {
    // Initialize WebAssembly module
    await init();

    const { file, width, height, quality } = event.data;

    if (!file || !width || !height || !quality) {
      throw new Error("Missing required parameters: file, width, height, quality");
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Call Rust Wasm function
    const compressedBytes = compress_image(bytes, width, height, quality);

    // Send back the compressed array
    self.postMessage({ success: true, data: compressedBytes });
  } catch (error) {
    console.error("Compression worker error:", error);
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
