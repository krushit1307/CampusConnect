/**
 * Weekly Digest Recommendation Scoring (#2911)
 *
 * Pure, dependency-free scoring helpers for the personalized weekly digest.
 * This module deliberately avoids Deno/network APIs so it can be unit-tested
 * in isolation with `deno test` (see scoring_test.ts, run via
 * `npm run test:edge`).
 */

/** An upcoming event as loaded by the weekly-digest Edge Function. */
export interface DigestEvent {
  id: string;
  title: string;
  event_date: string;
  location: string | null;
  club_id: string | null;
  club_name: string | null;
  /** ltree tag paths attached to the event (from `event_tags`). */
  tag_paths: string[];
}

/** A subscriber eligible for the digest (from `get_digest_subscribers()`). */
export interface DigestUser {
  user_id: string;
  email: string;
  full_name: string;
  unsubscribe_token: string | null;
}

/** Everything needed to score recommendations for a single user. */
export interface DigestContext {
  /** All upcoming events in the digest window. */
  events: DigestEvent[];
  /** Clubs the user is an approved member of ("follows"). */
  followedClubIds: Set<string>;
  /** Tags from events the user previously attended. */
  attendedTagPaths: Set<string>;
  /** Events the user has already RSVP'd to (excluded from recommendations). */
  rsvpedEventIds: Set<string>;
}

/** An event with its computed recommendation score. */
export interface ScoredEvent extends DigestEvent {
  score: number;
  /** Human-readable reasons, useful for logging/debugging. */
  reasons: string[];
}

/** Score boost for events hosted by a club the user follows. */
export const CLUB_BOOST = 50;

/** Score boost per matching tag from events the user previously attended. */
export const TAG_BOOST = 20;

/** Default number of recommendations per digest email. */
export const DEFAULT_TOP_N = 3;

/**
 * Scores every eligible event for the user and returns the top `topN`.
 *
 * - Events the user already RSVP'd to are excluded.
 * - +CLUB_BOOST when the event is hosted by a club the user follows.
 * - +TAG_BOOST per tag matching a tag from an event they previously attended.
 * - Events with no signal still participate (tie-broken by earliest date) so
 *   users without history still get a useful digest, and never a blank one.
 */
export function scoreAndSelectTopEvents(ctx: DigestContext, topN = DEFAULT_TOP_N): ScoredEvent[] {
  const scored: ScoredEvent[] = [];

  for (const event of ctx.events) {
    if (ctx.rsvpedEventIds.has(event.id)) continue;

    const reasons: string[] = [];
    let score = 0;

    if (event.club_id && ctx.followedClubIds.has(event.club_id)) {
      score += CLUB_BOOST;
      reasons.push(`hosted by a club you follow (+${CLUB_BOOST})`);
    }

    const matchingTags = event.tag_paths.filter((tag) => ctx.attendedTagPaths.has(tag));
    if (matchingTags.length > 0) {
      const tagScore = matchingTags.length * TAG_BOOST;
      score += tagScore;
      reasons.push(`matches tags from events you attended (+${tagScore})`);
    }

    scored.push({ ...event, score, reasons });
  }

  // Highest score first; earliest upcoming event as the tie-breaker.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
  });

  return scored.slice(0, topN);
}
