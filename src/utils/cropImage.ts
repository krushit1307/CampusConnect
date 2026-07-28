export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous"); // needed to avoid cross-origin issues on canvas
    image.src = url;
  });
}

function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Returns the new bounding area of a rotated rectangle.
 */
function rotateSize(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/** Maximum output dimension for avatar images. */
const MAX_OUTPUT_SIZE = 512;

/**
 * Crop + resize an image using the HTML Canvas API.
 *
 * - Handles EXIF-style rotation via a `rotation` parameter (degrees).
 * - Downscales the cropped region to a maximum of 512×512 pixels.
 * - Outputs a compressed WebP Blob (90 % quality) for small file sizes.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No 2d context");
  }

  const rotRad = getRadianAngle(rotation);

  // Calculate bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  // Set canvas size to match the bounding box
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate canvas context to a central location to allow rotating around the center
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  // Draw the (possibly rotated) source image
  ctx.drawImage(image, 0, 0);

  // Extract the cropped region
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("No 2d context");
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  // Resize down to MAX_OUTPUT_SIZE if the cropped area is larger
  let finalWidth = pixelCrop.width;
  let finalHeight = pixelCrop.height;

  if (finalWidth > MAX_OUTPUT_SIZE || finalHeight > MAX_OUTPUT_SIZE) {
    if (finalWidth >= finalHeight) {
      finalHeight = Math.round((finalHeight / finalWidth) * MAX_OUTPUT_SIZE);
      finalWidth = MAX_OUTPUT_SIZE;
    } else {
      finalWidth = Math.round((finalWidth / finalHeight) * MAX_OUTPUT_SIZE);
      finalHeight = MAX_OUTPUT_SIZE;
    }
  }

  const finalCanvas = document.createElement("canvas");
  const finalCtx = finalCanvas.getContext("2d");

  if (!finalCtx) {
    throw new Error("No 2d context");
  }

  finalCanvas.width = finalWidth;
  finalCanvas.height = finalHeight;

  finalCtx.drawImage(
    croppedCanvas,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    finalWidth,
    finalHeight,
  );

  // Export as WebP at 90 % quality for small file sizes
  return new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      0.9,
    );
  });
}
