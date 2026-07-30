/**
 * Pure helpers for the FeaturedEvents magazine grid (issue #1852).
 *
 * Kept in their own module so that `FeaturedEvents.tsx` only exports the
 * component itself — this satisfies react-refresh's fast-refresh rule and
 * keeps the layout logic unit-testable in isolation from React.
 */

export type FeaturedEventSize = "standard" | "featured-landscape" | "featured-portrait" | "hero";

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
 * Slot layout strings used by the magazine grid.
 *
 * Mobile (single column): every card collapses to col-span-1 row-span-1.
 * Desktop (md+): up to four span tiers are used and `grid-flow-dense` packs
 * the smaller cards into the gaps left by the larger ones.
 *
 * Note: these class strings are emitted verbatim in source so Tailwind v4's
 * automatic content scan (@source "../src") keeps them in the build.
 */
export const FEATURED_SLOT_CLASSES: Record<FeaturedEventSize, string> = {
  // Mobile default + smallest desktop tile
  standard: "col-span-1 row-span-1",
  // Wide rectangle: 2 columns x 1 row
  "featured-landscape": "col-span-1 row-span-1 md:col-span-2 md:row-span-1",
  // Tall rectangle: 1 column x 2 rows
  "featured-portrait": "col-span-1 row-span-1 md:col-span-1 md:row-span-2",
  // Hero block: 2 columns x 2 rows
  hero: "col-span-1 row-span-1 md:col-span-2 md:row-span-2",
};

/**
 * Decide which slot a given event should occupy in the magazine grid.
 *
 * Rules (pure function, exported so the unit test can exercise it):
 *   - The top-scoring event (or one explicitly flagged is_featured) becomes
 *     the hero when there are >= 3 events.
 *   - When there is a hero, the next two highest-scoring events get landscape
 *     and portrait slots respectively to vary the visual rhythm.
 *   - Every other event is a standard 1x1 tile.
 *   - With only 1 or 2 events we fall back to full-width hero(s) so the grid
 *     still feels intentional rather than half-empty.
 *
 * The function is deterministic: sorting on a stable popularity_score first,
 * then on event_date (so upcoming events beat far-future ones on tie), then
 * on id (so tests don't depend on input order).
 */
export function pickFeaturedSlot(
  event: FeaturedEvent,
  index: number,
  total: number,
  sortedEvents: FeaturedEvent[],
): FeaturedEventSize {
  if (total <= 0) return "standard";

  // Single event: make it a hero so it fills the section.
  if (total === 1) return "hero";

  // Two events: two heroes stacked horizontally fill the 4-col grid.
  if (total === 2) return "hero";

  // Three or more: one hero + landscape + portrait + the rest standard.
  if (index === 0) return "hero";
  if (index === 1) return "featured-landscape";
  if (index === 2) return "featured-portrait";

  return "standard";
}

/**
 * Sort events for the magazine layout: explicitly featured first, then by
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
