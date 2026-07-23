self.onmessage = async (event: MessageEvent) => {
  try {
    // Dynamically import the WASM module so the build doesn't fail when the
    // Rust package hasn't been compiled yet (the package is built separately
    // via wasm-pack before deployment).
    const wasmModule = await import(
      /* @vite-ignore */
      "../../wasm/image-compressor/pkg/image_compressor"
    );
    await wasmModule.default();
    const compress_image = wasmModule.compress_image;

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
