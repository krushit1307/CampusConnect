/**
 * Deterministic Organic Skeleton Utilities (#2328)
 * Ensures SSR-safe, zero-hydration-mismatch jagged paragraph skeleton rendering.
 */

// Stable preset paragraph width sequences (mimics natural human text paragraphs)
export const ORGANIC_LINE_WIDTH_PRESETS: string[][] = [
  ["92%", "85%", "78%", "42%"],
  ["88%", "95%", "82%", "90%", "38%"],
  ["94%", "79%", "86%", "52%"],
  ["90%", "84%", "91%", "76%", "45%"],
  ["86%", "93%", "80%", "35%"],
  ["95%", "88%", "72%", "48%"],
];

/**
 * Simple, fast pseudorandom number generator (PRNG) based on a numeric seed.
 * Returns a float between 0 (inclusive) and 1 (exclusive).
 * Guaranteed to produce 100% identical values on Server (Node SSR) and Client (Browser Hydration).
 */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999 + 12345) * 10000;
  return x - Math.floor(x);
}

/**
 * Converts a string (e.g. post ID, club slug, user handle) into a numeric seed.
 */
export function hashStringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) + 1;
}

/**
 * Generates an organic CSS width percentage for a line of text in a skeleton paragraph.
 * Ensures the final line of a paragraph is always significantly shorter (35% - 55%)
 * to mimic ragged-right paragraph text.
 *
 * @param lineIndex - Index of the line within the paragraph (0-based)
 * @param totalLines - Total number of lines in the paragraph
 * @param seed - Optional numeric or string seed for deterministic randomness
 */
export function getOrganicLineWidth(
  lineIndex: number,
  totalLines: number = 3,
  seed?: number | string,
): string {
  // If it's the last line of a multi-line paragraph, force a short width (35% to 55%)
  const isLastLine = totalLines > 1 && lineIndex === totalLines - 1;

  if (seed !== undefined) {
    const numericSeed = typeof seed === "string" ? hashStringToSeed(seed) : seed;
    const lineSeed = numericSeed + lineIndex * 17;
    const rand = seededRandom(lineSeed);

    if (isLastLine) {
      // Range: 35% to 55%
      const lastLineWidth = Math.floor(35 + rand * 20);
      return `${lastLineWidth}%`;
    }

    // Body lines range: 75% to 96%
    const bodyLineWidth = Math.floor(75 + rand * 21);
    return `${bodyLineWidth}%`;
  }

  // Fallback to preset arrays if no seed provided
  const presetIndex = (lineIndex + (totalLines || 0)) % ORGANIC_LINE_WIDTH_PRESETS.length;
  const presetPattern = ORGANIC_LINE_WIDTH_PRESETS[presetIndex];

  if (isLastLine) {
    return presetPattern[presetPattern.length - 1]; // Short last line (e.g. 42%, 38%)
  }

  return presetPattern[lineIndex % (presetPattern.length - 1)] || "85%";
}

/**
 * Generates an array of organic line widths for an entire paragraph
 */
export function getParagraphLineWidths(lineCount: number = 3, seed?: number | string): string[] {
  const widths: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    widths.push(getOrganicLineWidth(i, lineCount, seed));
  }
  return widths;
}
