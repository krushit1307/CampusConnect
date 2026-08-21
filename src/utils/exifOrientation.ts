/**
 * Minimal EXIF orientation handling.
 *
 * Only reads the single EXIF tag we actually need (Orientation, 0x0112)
 * instead of pulling in a full EXIF/image library — the file is small
 * enough that we only need the first ~64KB, and the codebase already
 * hand-rolls its canvas logic in `cropImage.ts` / `imageCompressor.ts`,
 * so this follows the same pattern instead of adding a new dependency.
 */

/**
 * Reads the EXIF Orientation tag (1-8) from a JPEG File.
 * Returns 1 (no rotation needed) for non-JPEGs or files with no EXIF data.
 */
export function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (file.type !== "image/jpeg") {
      resolve(1);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer | null;
      if (!buffer) {
        resolve(1);
        return;
      }
      resolve(parseOrientation(buffer));
    };
    reader.onerror = () => resolve(1);
    // The EXIF header lives near the start of the file, no need to read it all.
    reader.readAsArrayBuffer(file.slice(0, 64 * 1024));
  });
}

function parseOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);

  // Every JPEG starts with the SOI marker 0xFFD8.
  if (view.getUint16(0) !== 0xffd8) return 1;

  let offset = 2;
  const length = view.byteLength;

  while (offset < length - 1) {
    const marker = view.getUint16(offset);
    offset += 2;

    // 0xFFE1 = APP1 marker, which holds EXIF data.
    if (marker === 0xffe1) {
      const exifLength = view.getUint16(offset);
      // "Exif\0\0" signature check
      if (view.getUint32(offset + 2) !== 0x45786966) return 1;

      const tiffOffset = offset + 8;
      const little = view.getUint16(tiffOffset) === 0x4949; // "II" = little-endian

      const firstIfdOffset = view.getUint32(tiffOffset + 4, little);
      const ifdStart = tiffOffset + firstIfdOffset;
      const entryCount = view.getUint16(ifdStart, little);

      for (let i = 0; i < entryCount; i++) {
        const entryOffset = ifdStart + 2 + i * 12;
        const tag = view.getUint16(entryOffset, little);
        if (tag === 0x0112) {
          return view.getUint16(entryOffset + 8, little);
        }
      }
      return 1;
    } else if ((marker & 0xff00) !== 0xff00) {
      break; // not a valid marker, stop scanning
    } else {
      offset += view.getUint16(offset); // skip this segment
    }
  }

  return 1;
}

/**
 * Draws a data URL onto a canvas, undoing the rotation/mirroring implied by
 * an EXIF orientation value, and returns a corrected data URL.
 *
 * Exporting via canvas also strips the original EXIF block, so the
 * corrected image can't be mis-rotated a second time downstream.
 */
export function correctImageOrientation(dataUrl: string, orientation: number): Promise<string> {
  if (orientation <= 1) return Promise.resolve(dataUrl);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const swapDimensions = orientation >= 5 && orientation <= 8;
      canvas.width = swapDimensions ? image.height : image.width;
      canvas.height = swapDimensions ? image.width : image.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No 2d context"));
        return;
      }

      switch (orientation) {
        case 2:
          ctx.transform(-1, 0, 0, 1, image.width, 0);
          break;
        case 3:
          ctx.transform(-1, 0, 0, -1, image.width, image.height);
          break;
        case 4:
          ctx.transform(1, 0, 0, -1, 0, image.height);
          break;
        case 5:
          ctx.transform(0, 1, 1, 0, 0, 0);
          break;
        case 6: // rotated 90deg
          ctx.transform(0, 1, -1, 0, image.height, 0);
          break;
        case 7:
          ctx.transform(0, -1, -1, 0, image.height, image.width);
          break;
        case 8: // rotated 270deg
          ctx.transform(0, -1, 1, 0, 0, image.width);
          break;
        default:
          break;
      }

      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => reject(new Error("Failed to load image for orientation correction"));
    image.src = dataUrl;
  });
}
