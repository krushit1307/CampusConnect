/**
 * Pure helpers for building OpenGraph + Twitter Card meta tag values
 * (issue #1904).
 *
 * Kept in their own module so the route file can stay focused on rendering
 * and the helpers can be unit-tested in isolation from React / Supabase /
 * react-helmet-async.
 */

/** Maximum characters for og:description / twitter:description per spec. */
const OG_DESCRIPTION_MAX_LENGTH = 200;

/** Required dimensions for og:image per Twitter / Facebook crop heuristics. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Inputs for {@link buildOpenGraphTags}. */
export interface EventMetaInput {
  title: string;
  description?: string | null;
  /** Raw banner URL — may already include query params. */
  bannerUrl?: string | null;
  /** ISO timestamp of the event. */
  eventDate?: string | null;
  location?: string | null;
  /** Absolute URL of the event detail page. */
  url?: string | null;
  /**
   * Event UUID — when provided, `buildOpenGraphTags` prefers the
   * og-image Edge Function URL (#1515) over the raw Storage URL.
   */
  eventId?: string | null;
}

/** Output: bag of strings suitable for Helmet's `<meta>` content attrs. */
export interface OpenGraphTagValues {
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  eventStartTime: string;
  rawBannerUrl: string;
}

/**
 * Strip HTML tags from a string for use as og:description. Most social
 * crawlers don't render HTML in meta descriptions, and we don't want raw
 * `<p>` showing up in the preview.
 */
function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

/**
 * Append a Supabase Storage image transform that resizes the banner to
 * 1200x630 (Twitter / Facebook crop heuristic) without distortion.
 *
 * If the URL already has a query string, append with `&`; otherwise with
 * `?`. If the URL is empty, return empty so the caller can omit the meta
 * tag entirely.
 */
export function buildOgImageUrl(rawBannerUrl: string): string {
  if (!rawBannerUrl) return "";
  const transform = `width=${OG_IMAGE_WIDTH}&height=${OG_IMAGE_HEIGHT}&resize=cover`;
  return rawBannerUrl.includes("?")
    ? `${rawBannerUrl}&${transform}`
    : `${rawBannerUrl}?${transform}`;
}

/**
 * Build the URL for the og-image Edge Function (#1515).
 *
 * The function renders a dynamic 1200×630 PNG card with the event title,
 * date, location, and club branding — no static banner required.
 *
 * Falls back to an empty string when the Supabase project URL is not
 * available in the environment (e.g. during unit tests).
 */
export function buildOgImageEdgeUrl(eventId: string): string {
  if (!eventId) return "";
  const projectUrl =
    typeof import.meta !== "undefined"
      ? (import.meta as Record<string, unknown>).env
        ? (import.meta as { env: Record<string, string> }).env.VITE_SUPABASE_URL
        : ""
      : "";
  if (!projectUrl) return "";
  // Supabase Functions URL pattern:
  //   https://<ref>.supabase.co/functions/v1/og-image?event_id=<uuid>
  const base = projectUrl.replace("/rest/v1", "").replace(/\/$/, "");
  return `${base}/functions/v1/og-image?event_id=${encodeURIComponent(eventId)}`;
}

/**
 * Build the canonical bag of OpenGraph / Twitter Card strings for an event.
 *
 * - Strips HTML and clamps description length.
 * - Falls back to a location-based description if no description is set.
 * - Falls back to a generic line if neither is set.
 * - Returns empty `ogImage` / `ogUrl` / `eventStartTime` if those inputs
 *   are missing so the caller can omit those meta tags.
 */
export function buildOpenGraphTags(input: EventMetaInput): OpenGraphTagValues {
  const rawBannerUrl = input.bannerUrl ?? "";
  const stripped = (input.description ?? "").trim();
  const ogDescription = stripped
    ? stripHtml(stripped).slice(0, OG_DESCRIPTION_MAX_LENGTH).trim()
    : input.location
      ? `Join us at ${input.location}.`
      : "An event on CampusConnect.";

  // Issue #1515: prefer the og-image Edge Function URL when an event ID is
  // available — it generates a rich branded card regardless of whether the
  // event has a banner. Fall back to the Supabase Storage transform URL when
  // no ID is present (e.g. server-side renders without Supabase context).
  const ogImage = input.eventId
    ? buildOgImageEdgeUrl(input.eventId) || buildOgImageUrl(rawBannerUrl)
    : buildOgImageUrl(rawBannerUrl);

  return {
    ogTitle: `${input.title} | CampusConnect`,
    ogDescription,
    ogImage,
    ogUrl: input.url ?? "",
    eventStartTime: input.eventDate ?? "",
    rawBannerUrl,
  };
}
