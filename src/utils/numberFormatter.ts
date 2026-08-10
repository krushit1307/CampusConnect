/**
 * Formats large row counts into human-readable estimated strings (e.g. "~50.1M", "~15.4K", "950").
 */
export function formatEstimatedCount(count: number, isEstimated = false): string {
  const prefix = isEstimated ? "~" : "";
  if (count >= 1_000_000) {
    const formatted = (count / 1_000_000).toFixed(1);
    return `${prefix}${formatted.replace(/\.0$/, "")}M`;
  }
  if (count >= 1_000) {
    const formatted = (count / 1_000).toFixed(1);
    return `${prefix}${formatted.replace(/\.0$/, "")}K`;
  }
  return `${prefix}${count}`;
}
