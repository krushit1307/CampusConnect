/**
 * Pure helpers for the FeaturedEvents scroll-snap carousel (issue #2006).
 *
 * Kept in their own module so that `FeaturedEvents.tsx` only exports the
 * component itself — this satisfies react-refresh's fast-refresh rule and
 * keeps the sorting logic unit-testable in isolation from React.
 */

export interface FeaturedEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  banner_url?: string | null;
  popularity_score?: number | null;
  is_featured?: boolean | null;
  clubs: { name: string } | { name: string }[] | null;
}

/**
 * Sort events for the carousel: explicitly featured first, then by
 * popularity_score desc, then by soonest event_date, then by id for stability.
 */
export function sortFeaturedEvents(events: FeaturedEvent[]): FeaturedEvent[] {
  return [...events]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const aFeatured = a.e.is_featured ? 1 : 0;
      const bFeatured = b.e.is_featured ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;

      const aScore = typeof a.e.popularity_score === "number" ? a.e.popularity_score : 0;
      const bScore = typeof b.e.popularity_score === "number" ? b.e.popularity_score : 0;
      if (aScore !== bScore) return bScore - aScore;

      const aDate = a.e.event_date ? Date.parse(a.e.event_date) : Number.POSITIVE_INFINITY;
      const bDate = b.e.event_date ? Date.parse(b.e.event_date) : Number.POSITIVE_INFINITY;
      if (aDate !== bDate) return aDate - bDate;

      // Stable tie-breaker: original index (which carries id ordering in tests).
      return a.i - b.i;
    })
    .map(({ e }) => e);
}
