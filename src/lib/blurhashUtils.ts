/**
 * Default fallback Blurhash strings for image placeholders
 */
export const DEFAULT_FALLBACK_BLURHASH = "LKO2?_%g~q_3t7t7Rjwb_3%M%MWB";

/**
 * Validates if a given string looks like a valid Blurhash.
 * Blurhashes are typically between 6 and 100 characters using base83 encoding.
 */
export function isValidBlurhash(hash?: string | null): boolean {
  if (!hash || typeof hash !== "string") return false;
  const trimmed = hash.trim();
  if (trimmed.length < 6 || trimmed.length > 100) return false;
  // Base83 character set check — [ and ] are literal inside a char class, no escaping needed
  const base83Regex = /^[0-9a-zA-Z#$%*+,\-.:;=?@[\]^_{|}~]+$/;
  return base83Regex.test(trimmed);
}
