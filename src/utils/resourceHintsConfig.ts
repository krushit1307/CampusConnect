import { ResourceHintConfig } from "../hooks/useResourceHints";

/**
 * Resource Hints Configuration Registry
 *
 * Centralizes the definitions for all external domains that require
 * preconnecting or DNS prefetching. This prevents scattered magic strings
 * across the codebase and makes it easy to audit which external connections
 * the application is holding open.
 *
 * WARNING: Only preconnect to absolute critical domains. Holding open dormant
 * TCP connections wastes browser memory and bandwidth.
 */

/**
 * Core API Domains
 * These are required for the initial application bootstrap and auth flow.
 */
export const CORE_API_HINTS: ResourceHintConfig[] = [
  {
    rel: "preconnect",
    // Fallback to generic Supabase API if project URL isn't available yet
    href: import.meta.env.VITE_SUPABASE_URL || "https://api.supabase.co",
    crossOrigin: "anonymous",
  },
  {
    rel: "dns-prefetch",
    href: import.meta.env.VITE_SUPABASE_URL || "https://api.supabase.co",
  },
];

/**
 * Media & Storage Domains
 * Used for loading club banners, user avatars, and event images.
 */
export const MEDIA_HINTS: ResourceHintConfig[] = [
  {
    rel: "preconnect",
    href: "https://s3.amazonaws.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "dns-prefetch",
    href: "https://s3.amazonaws.com",
  },
  {
    rel: "preconnect",
    href: "https://images.unsplash.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "dns-prefetch",
    href: "https://images.unsplash.com",
  },
];

/**
 * Typography Domains
 * Used if the application relies on Google Fonts or similar web fonts.
 */
export const FONT_HINTS: ResourceHintConfig[] = [
  {
    rel: "preconnect",
    href: "https://fonts.googleapis.com",
    // No crossOrigin needed for standard CSS imports
  },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous", // Required for the actual font file downloads
  },
  {
    rel: "dns-prefetch",
    href: "https://fonts.googleapis.com",
  },
];

/**
 * Third-Party Integration Domains
 * Only preconnect these when the specific feature (e.g., Maps, Payments) is
 * about to be accessed. Do NOT include them in the initial static HTML payload.
 */
export const MAPS_HINTS: ResourceHintConfig[] = [
  {
    rel: "preconnect",
    href: "https://api.mapbox.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "dns-prefetch",
    href: "https://api.mapbox.com",
  },
];

export const PAYMENTS_HINTS: ResourceHintConfig[] = [
  {
    rel: "preconnect",
    href: "https://api.stripe.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "dns-prefetch",
    href: "https://api.stripe.com",
  },
];

/**
 * Aggregates all hints required for the initial application load.
 * This array is used by the root layout to inject static hints.
 */
export const INITIAL_LOAD_HINTS: ResourceHintConfig[] = [
  ...CORE_API_HINTS,
  ...MEDIA_HINTS,
  ...FONT_HINTS,
];

/**
 * Validates a URL to ensure it's safe to use in a resource hint.
 * Prevents injection attacks if URLs are derived from user input.
 *
 * @param url - The URL string to validate
 * @returns True if the URL is a valid HTTP/HTTPS URL
 */
export function isValidHintUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (e) {
    return false;
  }
}

/**
 * Filters an array of hints to only include those with valid URLs.
 *
 * @param hints - Array of ResourceHintConfig objects
 * @returns Filtered array of valid hints
 */
export function filterValidHints(hints: ResourceHintConfig[]): ResourceHintConfig[] {
  return hints.filter((hint) => isValidHintUrl(hint.href));
}
