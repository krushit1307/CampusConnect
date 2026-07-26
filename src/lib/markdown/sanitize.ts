/**
 * URL sanitization for the Markdown renderer.
 *
 * Only `http:`, `https:`, `mailto:`, and relative URLs are allowed.
 * Everything else (notably `javascript:`, `data:`, `vbscript:`) is replaced
 * with `#` so the link is inert but still renders.
 */

/** Schemes that are safe to allow in href/src attributes. */
const SAFE_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

/**
 * Sanitize a URL for use in an `href` or `src` attribute.
 *
 * Returns the original URL if it uses a safe scheme or is a relative path;
 * returns `"#"` otherwise.
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "#";

  const trimmed = url.trim();

  // Relative URLs (no scheme) are safe.
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    !trimmed.includes(":")
  ) {
    return trimmed;
  }

  // Absolute URLs — check the scheme.
  try {
    const parsed = new URL(trimmed);
    if (SAFE_SCHEMES.includes(parsed.protocol.toLowerCase())) {
      return trimmed;
    }
    return "#";
  } catch {
    // Not a valid URL — treat as relative (safe).
    return trimmed;
  }
}

/**
 * Escape HTML special characters in a text string.
 *
 * This is the primary XSS defense for text nodes. Even though React escapes
 * text content by default, we keep this for any place we might render text
 * outside a React text child (e.g. attributes).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
