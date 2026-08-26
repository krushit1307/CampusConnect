import heic2any from "heic2any";

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts HEIC files (from iPhones) to JPEG if necessary.
 */
export const convertHeicIfNeeded = async (file: File): Promise<File | Blob> => {
  const isHeic = file.name.toLowerCase().endsWith(".heic") || file.type === "image/heic";
  if (!isHeic) return file;

  try {
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.8,
    });
    return Array.isArray(converted) ? converted[0] : converted;
  } catch (error) {
    console.error("HEIC conversion failed:", error);
    return file;
  }
};

/**
 * Loads an image URL into an HTMLImageElement safely.
 */
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

/**
 * Extracts the cropped region from an image canvas and compresses it to < 300KB.
 */
export const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  maxWidth = 800,
  quality = 0.8,
): Promise<Blob> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context available");
  }

  // Calculate target canvas size while respecting max-width
  const scale = maxWidth / Math.max(pixelCrop.width, pixelCrop.height);
  const targetWidth = Math.min(pixelCrop.width, pixelCrop.width * scale);
  const targetHeight = Math.min(pixelCrop.height, pixelCrop.height * scale);

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Draw the cropped portion onto the scaled canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
};
