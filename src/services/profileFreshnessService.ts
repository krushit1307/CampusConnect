export interface StaleProfileCheckResult {
  isStale: boolean;
  major?: string;
  lastUpdatedAt?: string;
  monthsSinceUpdate?: number;
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Checks if a profile has not been updated in over 12 months.
 */
export function isProfileDataStale(profileLastUpdatedAt?: string | null): boolean {
  if (!profileLastUpdatedAt) {
    return true; // No record -> treat as stale/initial
  }

  const lastUpdated = new Date(profileLastUpdatedAt).getTime();
  if (isNaN(lastUpdated)) {
    return true;
  }

  const now = Date.now();
  return now - lastUpdated >= ONE_YEAR_MS;
}

/**
 * Generates the friendly stale profile prompt text based on user major.
 */
export function getStaleProfilePromptText(major?: string | null): string {
  if (major && major.trim()) {
    return `Are you still a ${major.trim()} Major? Help us give you better recommendations by confirming your profile.`;
  }
  return "It has been over a year since you last updated your profile. Help us give you better recommendations by confirming your details.";
}
