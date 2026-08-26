/**
 * Pure utility function to format dates into relative time ago strings.
 * E.g., "Just now", "1 min ago", "5 mins ago", "2 hrs ago", "3 days ago".
 */
export function formatTimeAgo(dateInput: string | Date | number): string {
  if (!dateInput) return "";

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();

  // If future or invalid date
  if (isNaN(diffInMs) || diffInMs < 0) {
    return "Just now";
  }

  const seconds = Math.floor(diffInMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 45) {
    return "Just now";
  }
  if (minutes < 60) {
    return minutes === 1 ? "1 min ago" : `${minutes} mins ago`;
  }
  if (hours < 24) {
    return hours === 1 ? "1 hr ago" : `${hours} hrs ago`;
  }
  if (days < 30) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  if (months < 12) {
    return months === 1 ? "1 mo ago" : `${months} mos ago`;
  }
  return years === 1 ? "1 yr ago" : `${years} yrs ago`;
}

/**
 * Format date for static SSR rendering to prevent hydration mismatches.
 */
export function formatStaticDate(dateInput: string | Date | number): string {
  if (!dateInput) return "";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
