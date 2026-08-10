export interface EventRankingMetrics {
  id: string;
  title: string;
  rsvpCount: number;
  commentCount: number;
  createdAt: string; // ISO string
}

export interface RankedEventItem extends EventRankingMetrics {
  trendingScore: number;
  isRising: boolean;
}

export const DEFAULT_GRAVITY = 1.8;

/**
 * Calculates HackerNews time-decay score for an event based on engagement and age.
 * Formula: Score = (RSVPs + Comments * 1.5) / (AgeInHours + 2) ^ Gravity
 */
export function calculateHackerNewsTrendingScore(
  rsvpCount: number,
  commentCount: number,
  createdAtIso: string,
  nowMs: number = Date.now(),
  gravity: number = DEFAULT_GRAVITY,
): number {
  const createdMs = new Date(createdAtIso).getTime();
  const ageInHours = Math.max(0, (nowMs - createdMs) / (1000 * 60 * 60));

  const numerator = Math.max(0, rsvpCount) + Math.max(0, commentCount) * 1.5;
  const denominator = Math.pow(ageInHours + 2, gravity);

  const score = numerator / denominator;
  return Number(score.toFixed(4));
}

/**
 * Ranks an array of events by trending score and tags high-velocity recent events as "Rising".
 */
export function rankEventsByTrending(
  events: EventRankingMetrics[],
  nowMs: number = Date.now(),
  gravity: number = DEFAULT_GRAVITY,
): RankedEventItem[] {
  const scored = events.map((event) => {
    const trendingScore = calculateHackerNewsTrendingScore(
      event.rsvpCount,
      event.commentCount,
      event.createdAt,
      nowMs,
      gravity,
    );

    const createdMs = new Date(event.createdAt).getTime();
    const ageInHours = (nowMs - createdMs) / (1000 * 60 * 60);

    // Event is marked "Rising" if created within 6 hours and score > 5.0
    const isRising = ageInHours <= 6 && trendingScore >= 5.0;

    return {
      ...event,
      trendingScore,
      isRising,
    };
  });

  return scored.sort((a, b) => b.trendingScore - a.trendingScore);
}
