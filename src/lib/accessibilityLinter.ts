// =============================================================================
// Lib: accessibilityLinter
// Issue: #3316 - Automated Accessibility Report for Club Posts
// Description: WCAG accessibility checks run before a club can publish an
// event poster — flags low color contrast (via Canvas API dominant-color
// sampling) and missing/too-short alt text.
// =============================================================================

export const MIN_CONTRAST_RATIO = 4.5;
export const MIN_ALT_TEXT_LENGTH = 5;

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface AccessibilityViolation {
  type: "low_contrast" | "missing_alt_text";
  message: string;
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(color: RGBColor): number {
  const r = srgbChannelToLinear(color.r);
  const g = srgbChannelToLinear(color.g);
  const b = srgbChannelToLinear(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calculateContrastRatio(colorA: RGBColor, colorB: RGBColor): number {
  const luminanceA = getRelativeLuminance(colorA);
  const luminanceB = getRelativeLuminance(colorB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Samples pixels from the image and buckets them into a coarse color grid
 * to find the most common colors (e.g. background vs. overlaid text).
 */
export function extractDominantColors(imageData: ImageData, maxColors = 2): RGBColor[] {
  const buckets = new Map<string, { color: RGBColor; count: number }>();
  const data = imageData.data;
  const pixelStep = 4; // sample every 4th pixel for performance

  for (let i = 0; i < data.length; i += 4 * pixelStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 128) continue; // skip transparent pixels

    const key = `${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
    } else {
      buckets.set(key, { color: { r, g, b }, count: 1 });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((bucket) => bucket.color);
}

export function validateAltText(altText: string): AccessibilityViolation | null {
  if (altText.trim().length < MIN_ALT_TEXT_LENGTH) {
    return {
      type: "missing_alt_text",
      message: `Alt text must be at least ${MIN_ALT_TEXT_LENGTH} characters so screen readers can describe this image.`,
    };
  }
  return null;
}

export function validateContrast(colors: RGBColor[]): AccessibilityViolation | null {
  if (colors.length < 2) return null;
  const ratio = calculateContrastRatio(colors[0], colors[1]);
  if (ratio < MIN_CONTRAST_RATIO) {
    return {
      type: "low_contrast",
      message: `Contrast is too low for readability (${ratio.toFixed(2)}:1). WCAG AA requires at least ${MIN_CONTRAST_RATIO}:1.`,
    };
  }
  return null;
}

export function lintImageAccessibility(
  imageData: ImageData,
  altText: string,
): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  const altViolation = validateAltText(altText);
  if (altViolation) violations.push(altViolation);

  const dominantColors = extractDominantColors(imageData);
  const contrastViolation = validateContrast(dominantColors);
  if (contrastViolation) violations.push(contrastViolation);

  return violations;
}

/**
 * Loads an image File into an offscreen Canvas and returns its pixel data
 * so it can be analyzed for accessibility violations.
 */
export function getImageDataFromFile(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDimension = 200; // downscale for fast sampling
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context is not available."));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(data);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for accessibility analysis."));
    };

    img.src = url;
  });
}