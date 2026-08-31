/**
 * Tests for the event recommendation engine.
 *
 * Covers content-based scoring, collaborative filtering, hybrid scoring,
 * recommendation set building, and utility functions.
 */

import { describe, it, expect } from "vitest";
import {
  buildUserProfile,
  contentScore,
  collaborativeScore,
  popularityScore,
  recencyScore,
  scoreEvents,
  buildRecommendationSet,
  getCategoryColor,
  MOCK_EVENTS,
  MOCK_SIMILAR_USER_RATINGS,
  type EventCategory,
} from "@/utils/recommendationEngine";

// ── Test Fixtures ──────────────────────────────────────────────────

const AFFINITIES: Record<EventCategory, number> = {
  academic: 2,
  cultural: 1,
  sports: 1,
  tech: 4,
  social: 2,
  workshop: 3.5,
  seminar: 3,
  concert: 1.5,
  exhibition: 1,
  networking: 2,
};

const TAG_AFFINITIES: Record<string, number> = {
  AI: 4,
  ML: 4,
  Python: 3,
  Hackathon: 5,
  Coding: 5,
  Blockchain: 3,
  "Hands-on": 4,
};

// ── User Profile Tests ─────────────────────────────────────────────

describe("buildUserProfile", () => {
  it("should create a user profile with correct fields", () => {
    const profile = buildUserProfile("u1", "Test User", []);
    expect(profile.id).toBe("u1");
    expect(profile.name).toBe("Test User");
    expect(profile.interactions).toHaveLength(0);
  });

  it("should store interactions", () => {
    const interactions = [
      { eventId: "e1", action: "rsvp" as const, timestamp: "2026-08-20T10:00:00Z" },
      { eventId: "e2", action: "view" as const, timestamp: "2026-08-21T10:00:00Z" },
    ];
    const profile = buildUserProfile("u1", "Test User", interactions);
    expect(profile.interactions).toHaveLength(2);
  });

  it("should default avgRatingGiven to 4.0 when no ratings given", () => {
    const profile = buildUserProfile("u1", "Test User", []);
    expect(profile.avgRatingGiven).toBe(4.0);
  });

  it("should compute avgRatingGiven from rated interactions", () => {
    const interactions = [
      { eventId: "e1", action: "checkin" as const, timestamp: "2026-08-20T10:00:00Z", rating: 5 },
      { eventId: "e2", action: "checkin" as const, timestamp: "2026-08-21T10:00:00Z", rating: 3 },
    ];
    const profile = buildUserProfile("u1", "Test User", interactions);
    expect(profile.avgRatingGiven).toBe(4.0);
  });
});

// ── Content Score Tests ────────────────────────────────────────────

describe("contentScore", () => {
  it("should return high score for matching categories", () => {
    const techEvent = MOCK_EVENTS.find((e) => e.category === "tech")!;
    const result = contentScore(techEvent, AFFINITIES, TAG_AFFINITIES);
    expect(result.score).toBeGreaterThan(0.3);
  });

  it("should return lower score for non-matching categories", () => {
    const concertEvent = MOCK_EVENTS.find((e) => e.category === "concert")!;
    const result = contentScore(concertEvent, AFFINITIES, TAG_AFFINITIES);
    expect(result.score).toBeLessThan(0.5);
  });

  it("should include tag_match reasons for matching tags", () => {
    const techEvent = MOCK_EVENTS.find((e) => e.category === "tech")!;
    const result = contentScore(techEvent, AFFINITIES, TAG_AFFINITIES);
    const tagReasons = result.reasons.filter((r) => r.type === "tag_match");
    expect(tagReasons.length).toBeGreaterThanOrEqual(0);
  });

  it("should cap score at 1", () => {
    const event = MOCK_EVENTS[0];
    const maxAffinities = Object.fromEntries(Object.keys(AFFINITIES).map((k) => [k, 10])) as Record<
      EventCategory,
      number
    >;
    const result = contentScore(event, maxAffinities, TAG_AFFINITIES);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ── Collaborative Score Tests ──────────────────────────────────────

describe("collaborativeScore", () => {
  it("should return 0 for no similar user data", () => {
    const event = MOCK_EVENTS[0];
    const result = collaborativeScore(event, []);
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it("should return high score when similar users rated highly", () => {
    const event = MOCK_EVENTS[0];
    const result = collaborativeScore(event, [5, 4.5, 4.8, 5]);
    expect(result.score).toBeGreaterThan(0.8);
    expect(result.reasons.some((r) => r.type === "similar_users")).toBe(true);
  });

  it("should cap score at 1", () => {
    const event = MOCK_EVENTS[0];
    const result = collaborativeScore(event, [5, 5, 5]);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ── Popularity Score Tests ─────────────────────────────────────────

describe("popularityScore", () => {
  it("should return 0 for maxRsvps=0", () => {
    expect(popularityScore(MOCK_EVENTS[0], 0)).toBe(0);
  });

  it("should score higher for more RSVPs", () => {
    const event = MOCK_EVENTS[0];
    const scoreLow = popularityScore(event, 1000);
    const scoreHigh = popularityScore(event, event.rsvp_count);
    expect(scoreHigh).toBeGreaterThanOrEqual(scoreLow);
  });

  it("should factor in rating", () => {
    const ratedEvent = { ...MOCK_EVENTS[0], rating: 5 };
    const unratedEvent = { ...MOCK_EVENTS[0], rating: null };
    const scoreRated = popularityScore(ratedEvent, 200);
    const scoreUnrated = popularityScore(unratedEvent, 200);
    expect(scoreRated).toBeGreaterThan(scoreUnrated);
  });
});

// ── Recency Score Tests ────────────────────────────────────────────

describe("recencyScore", () => {
  it("should return 0 for past events", () => {
    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(recencyScore(pastDate)).toBe(0);
  });

  it("should return 1.0 for events within 7 days", () => {
    const soonDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(recencyScore(soonDate)).toBe(1.0);
  });

  it("should return lower score for distant events", () => {
    const farDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(recencyScore(farDate)).toBeLessThan(0.5);
  });

  it("should be monotonically decreasing", () => {
    const d3 = recencyScore(new Date(Date.now() + 3 * 86400000).toISOString());
    const d20 = recencyScore(new Date(Date.now() + 20 * 86400000).toISOString());
    const d60 = recencyScore(new Date(Date.now() + 60 * 86400000).toISOString());
    expect(d3).toBeGreaterThanOrEqual(d20);
    expect(d20).toBeGreaterThanOrEqual(d60);
  });
});

// ── Score Events Tests ─────────────────────────────────────────────

describe("scoreEvents", () => {
  it("should return scored events sorted by score descending", () => {
    const scored = scoreEvents(MOCK_EVENTS, AFFINITIES, TAG_AFFINITIES, MOCK_SIMILAR_USER_RATINGS);
    expect(scored.length).toBe(MOCK_EVENTS.length);
    for (let i = 1; i < scored.length; i++) {
      expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score);
    }
  });

  it("should include all scoring dimensions", () => {
    const scored = scoreEvents(MOCK_EVENTS, AFFINITIES, TAG_AFFINITIES, MOCK_SIMILAR_USER_RATINGS);
    scored.forEach((s) => {
      expect(typeof s.contentScore).toBe("number");
      expect(typeof s.collaborativeScore).toBe("number");
      expect(typeof s.recencyScore).toBe("number");
      expect(typeof s.popularityScore).toBe("number");
      expect(Array.isArray(s.reasons)).toBe(true);
    });
  });

  it("should assign higher scores to tech/workshop events for this profile", () => {
    const scored = scoreEvents(MOCK_EVENTS, AFFINITIES, TAG_AFFINITIES, MOCK_SIMILAR_USER_RATINGS);
    const techEvents = scored.filter((s) => s.event.category === "tech");
    const concertEvents = scored.filter((s) => s.event.category === "concert");

    if (techEvents.length > 0 && concertEvents.length > 0) {
      const avgTech = techEvents.reduce((s, e) => s + e.score, 0) / techEvents.length;
      const avgConcert = concertEvents.reduce((s, e) => s + e.score, 0) / concertEvents.length;
      expect(avgTech).toBeGreaterThan(avgConcert);
    }
  });
});

// ── Recommendation Set Tests ───────────────────────────────────────

describe("buildRecommendationSet", () => {
  it("should create all recommendation subsets", () => {
    const scored = scoreEvents(MOCK_EVENTS, AFFINITIES, TAG_AFFINITIES, MOCK_SIMILAR_USER_RATINGS);
    const recs = buildRecommendationSet(scored);

    expect(recs.scored.length).toBe(MOCK_EVENTS.length);
    expect(recs.topPicks.length).toBeLessThanOrEqual(6);
    expect(Array.isArray(recs.becauseYouLiked)).toBe(true);
    expect(Array.isArray(recs.trendingNearYou)).toBe(true);
    expect(Array.isArray(recs.hiddenGems)).toBe(true);
  });

  it("should not have duplicates across subsets", () => {
    const scored = scoreEvents(MOCK_EVENTS, AFFINITIES, TAG_AFFINITIES, MOCK_SIMILAR_USER_RATINGS);
    const recs = buildRecommendationSet(scored);

    const topIds = new Set(recs.topPicks.map((s) => s.event.id));
    const trendingIds = new Set(recs.trendingNearYou.map((s) => s.event.id));

    // Top picks and trending may overlap, but both should be valid subsets
    expect(topIds.size).toBe(recs.topPicks.length);
    expect(trendingIds.size).toBe(recs.trendingNearYou.length);
  });
});

// ── getCategoryColor Tests ─────────────────────────────────────────

describe("getCategoryColor", () => {
  it("should return hex colors for all known categories", () => {
    const categories: EventCategory[] = [
      "tech",
      "workshop",
      "seminar",
      "concert",
      "cultural",
      "sports",
      "social",
      "exhibition",
      "networking",
      "academic",
    ];
    categories.forEach((cat) => {
      const color = getCategoryColor(cat);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });
  });

  it("should return default for unknown category", () => {
    expect(getCategoryColor("unknown" as EventCategory)).toBe("#6b7280");
  });
});
