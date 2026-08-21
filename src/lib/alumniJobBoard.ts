export interface ClubJobPosting {
  id: string;
  club_id: string;
  alumni_user_id: string;
  title: string;
  company: string;
  company_domain?: string | null;
  description: string;
  location: string;
  job_type: "Full-time" | "Part-time" | "Internship" | "Contract";
  apply_url: string;
  expires_at: string;
  is_renewed?: boolean;
  created_at: string;
  alumni_name?: string;
}

/**
 * Returns company logo image URL using Clearbit API (#2992).
 * Falls back to clean UI SVG avatar if domain is omitted or empty.
 */
export function getCompanyLogoUrl(domainOrName?: string | null): string {
  if (!domainOrName || !domainOrName.trim()) {
    return "https://api.dicebear.com/7.x/identicon/svg?seed=Company";
  }

  let cleanDomain = domainOrName.trim().toLowerCase();

  // Strip protocol
  cleanDomain = cleanDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  // If simple company name passed without domain suffix, append .com
  if (!cleanDomain.includes(".")) {
    cleanDomain = `${cleanDomain}.com`;
  }

  return `https://logo.clearbit.com/${cleanDomain}`;
}

/**
 * Checks whether a job posting has passed its 30-day expiration window (#2992).
 */
export function isJobPostingExpired(expiresAt: string, referenceTimeMs = Date.now()): boolean {
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) return false;
  return expiryTime <= referenceTimeMs;
}

/**
 * Calculates remaining days until job posting expires (#2992).
 */
export function getDaysUntilExpiration(expiresAt: string, referenceTimeMs = Date.now()): number {
  if (!expiresAt) return 0;
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) return 0;

  const diffMs = expiryTime - referenceTimeMs;
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Extends job posting expiration by 30 days upon alumni/leader renewal (#2992).
 */
export function calculateRenewedExpirationDate(currentExpiresAt?: string): string {
  const base = currentExpiresAt && !isJobPostingExpired(currentExpiresAt)
    ? new Date(currentExpiresAt)
    : new Date();
  base.setDate(base.getDate() + 30);
  return base.toISOString();
}
