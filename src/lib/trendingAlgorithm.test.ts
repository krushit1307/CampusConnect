import { describe, it, expect } from "vitest";
import {
  calculateHackerNewsTrendingScore,
  rankEventsByTrending,
  EventRankingMetrics,
} from "./trendingAlgorithm";

describe("HackerNews Trending Events Ranking Engine Suite (#2722)", () => {
  const now = 1000000000000;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  it("calculates time-decay scores accurately", () => {
    // Fresh event (1 hour old) with 50 RSVPs
    const freshScore = calculateHackerNewsTrendingScore(
      50,
      10,
      new Date(now - oneHour).toISOString(),
      now,
    );

    // Old event (24 hours old) with same 50 RSVPs
    const oldScore = calculateHackerNewsTrendingScore(
      50,
      10,
      new Date(now - oneDay).toISOString(),
      now,
    );

    expect(freshScore).toBeGreaterThan(oldScore);
  });

  it("ranks brand new high-velocity event above an old stagnant event with higher total RSVPs", () => {
    const events: EventRankingMetrics[] = [
      {
        id: "old_event",
        title: "Old Gala 3 Months Ago",
        rsvpCount: 500,
        commentCount: 20,
        createdAt: new Date(now - 90 * oneDay).toISOString(),
      },
      {
        id: "fresh_viral_event",
        title: "Surprise Concert Today",
        rsvpCount: 100,
        commentCount: 30,
        createdAt: new Date(now - 1 * oneHour).toISOString(),
      },
    ];

    const ranked = rankEventsByTrending(events, now);

    expect(ranked[0].id).toBe("fresh_viral_event"); // Fresh event surges to #1
    expect(ranked[0].isRising).toBe(true);
    expect(ranked[1].id).toBe("old_event");
  });
});
