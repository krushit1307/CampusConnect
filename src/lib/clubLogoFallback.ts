export const DEFAULT_CLUB_LOGO_PLACEHOLDER = "/images/default-club.png";

export interface ClubLogoOptions {
  logoUrl?: string | null;
  clubName?: string;
  fallbackPlaceholder?: string;
}

/**
 * Resolves valid image src URL or returns the default placeholder image.
 */
export function resolveClubLogoUrl(options: ClubLogoOptions): string {
  const defaultFallback = options.fallbackPlaceholder || DEFAULT_CLUB_LOGO_PLACEHOLDER;

  if (!options.logoUrl || options.logoUrl.trim().length === 0) {
    return defaultFallback;
  }

  return options.logoUrl.trim();
}

/**
 * Generates an SVG data URI or initials string for avatar fallbacks when images fail to load.
 */
export function getClubInitials(clubName?: string): string {
  if (!clubName || clubName.trim().length === 0) return "CC";

  const words = clubName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }

  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Event handler logic for image `onError` events.
 * Swaps broken image source with default placeholder and prevents infinite looping if placeholder fails.
 */
export function handleClubLogoError(
  target: { src: string },
  fallbackUrl: string = DEFAULT_CLUB_LOGO_PLACEHOLDER,
): boolean {
  if (target.src !== fallbackUrl) {
    target.src = fallbackUrl;
    return true; // Successfully swapped to fallback
  }
  return false; // Already on fallback; prevented infinite loop
}
