export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0
  mimeType?: string;
}

/**
 * Calculates output dimensions retaining aspect ratio to fit within maxWidth x maxHeight.
 */
export function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (srcWidth <= maxWidth && srcHeight <= maxHeight) {
    return { width: srcWidth, height: srcHeight };
  }

  const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
  return {
    width: Math.round(srcWidth * ratio),
    height: Math.round(srcHeight * ratio),
  };
}

/**
 * Client-side image compression utility (#1435).
 * Resizes large image Files/Blobs to max dimensions (1920x1080) at 80% quality WebP format
 * while handling canvas context scaling.
 */
export async function compressImage(
  file: File | Blob,
  options: ImageCompressionOptions = {},
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.8, mimeType = "image/webp" } = options;

  // Non-image files pass through unchanged
  if (file.type && !file.type.startsWith("image/")) {
    return file instanceof File ? file : new File([file], "upload", { type: file.type });
  }

  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { width, height } = calculateAspectRatioFit(
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        maxWidth,
        maxHeight,
      );

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2d canvas context for image compression"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Image compression failed to generate Blob"));
            return;
          }

          const fileName =
            file instanceof File
              ? file.name.replace(/\.[^/.]+$/, "") + ".webp"
              : "compressed-image.webp";

          const compressedFile = new File([blob], fileName, {
            type: blob.type || mimeType,
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        mimeType,
        quality,
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression: " + String(err)));
    };

    img.src = url;
  });
}
