export default async function init() {}

/**
 * Compresses an image byte array to JPEG format with specified max dimensions and quality.
 *
 * @param {Uint8Array} bytes
 * @param {number} width
 * @param {number} height
 * @param {number} quality - 1 to 100
 * @returns {Promise<Uint8Array>}
 */
export async function compress_image(bytes, width, height, quality) {
  try {
    if (typeof createImageBitmap !== "undefined" && typeof OffscreenCanvas !== "undefined") {
      const blob = new Blob([bytes]);
      const img = await createImageBitmap(blob);

      let targetWidth = img.width;
      let targetHeight = img.height;

      if (targetWidth > width || targetHeight > height) {
        const widthRatio = width / targetWidth;
        const heightRatio = height / targetHeight;
        const bestRatio = Math.min(widthRatio, heightRatio);
        targetWidth = Math.round(targetWidth * bestRatio);
        targetHeight = Math.round(targetHeight * bestRatio);
      }

      const canvas = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const q = Math.max(0.1, Math.min(1.0, quality / 100));
        const compressedBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: q });
        const buffer = await compressedBlob.arrayBuffer();
        return new Uint8Array(buffer);
      }
    }
  } catch (err) {
    console.warn("JS image compression fallback failed, returning original bytes:", err);
  }
  return bytes;
}
