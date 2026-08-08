import { describe, it, expect } from "vitest";
import {
  calculateTotalUserPoints,
  evaluateUnlockedBadges,
  rankLeaderboardUsers,
  PointEntry,
} from "./gamification";

describe("Gamified Student Leaderboard Suite (#2668)", () => {
  it("calculates total user points accurately from points ledger entries", () => {
    const entries: PointEntry[] = [
      { userId: "u1", amount: 10, reason: "RSVP Event" },
      { userId: "u1", amount: 50, reason: "Verified Event Attendance" },
      { userId: "u1", amount: -10, reason: "Canceled RSVP" },
    ];

    expect(calculateTotalUserPoints(entries)).toBe(50);
  });

  it("evaluates unlocked badge thresholds based on points and attended events", () => {
    // 50 points, 0 events -> Unlocks 'first_rsvp' (needs 10 points)
    const tier1Badges = evaluateUnlockedBadges(50, 0);
    expect(tier1Badges).toContain("first_rsvp");
    expect(tier1Badges).not.toContain("event_enthusiast");

    // 300 points, 10 events -> Unlocks all badges including 'campus_legend'
    const tier3Badges = evaluateUnlockedBadges(300, 10);
    expect(tier3Badges).toContain("campus_legend");
  });

  it("ranks users correctly for the student leaderboard view", () => {
    const rawUsers = [
      {
        userId: "u1",
        name: "Alice",
        totalPoints: 120,
        eventsAttendedCount: 3,
        badges: ["first_rsvp"],
      },
      {
        userId: "u2",
        name: "Bob",
        totalPoints: 350,
        eventsAttendedCount: 12,
        badges: ["campus_legend"],
      },
    ];

    const ranked = rankLeaderboardUsers(rawUsers);

    expect(ranked[0].name).toBe("Bob");
    expect(ranked[0].rank).toBe(1);

    expect(ranked[1].name).toBe("Alice");
    expect(ranked[1].rank).toBe(2);
  });
});
