/**
 * Regex that matches http/https URLs embedded in text.
 * Deliberately conservative — stops at whitespace and common punctuation
 * so trailing periods / commas / parentheses are not swallowed.
 * A trailing dot-less-than-TLD pattern handles common sentence endings.
 */
const URL_REGEX = /https?:\/\/[^\s<>"')\]},;]+(?<![.,!?;:])/gi;

/**
 * Extract all http/https URLs from a string.
 * Returns a de-duplicated array preserving order of first occurrence.
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? [];
  return [...new Set(matches)];
}

/**
 * Return the first URL found in a string, or null if none.
 * Used by ChatBox to decide whether to render a link preview.
 */
export function extractFirstUrl(text: string): string | null {
  return extractUrls(text)[0] ?? null;
}
