export interface ClubWebsiteLinkProps {
  shouldRender: boolean;
  sanitizedUrl: string;
  displayLabel: string;
}

/**
 * Validates and sanitizes club website URL string.
 * Returns null if the URL is empty, whitespace-only, or invalid.
 */
export function resolveClubWebsiteLink(
  websiteUrl?: string | null,
  customLabel = "Visit Website",
): ClubWebsiteLinkProps | null {
  if (!websiteUrl || websiteUrl.trim().length === 0) {
    return null;
  }

  const rawUrl = websiteUrl.trim();

  // Ensure valid URL scheme prepending if missing
  const sanitizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  return {
    shouldRender: true,
    sanitizedUrl,
    displayLabel: customLabel,
  };
}
