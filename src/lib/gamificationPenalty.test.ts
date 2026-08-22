import { describe, it, expect } from "vitest";
import {
  countStrikesInRollingWindow,
  evaluateNoShowPenalty,
  checkAndLiftExpiredRestrictions,
  NoShowStrikeRecord,
  UserPenaltyProfile,
} from "./gamificationPenalty";

describe("Dynamic Gamification Penalty System Suite (#3703)", () => {
  const mockNow = 1000000000000;

  const sampleProfile: UserPenaltyProfile = {
    userId: "usr_flaker",
    email: "flaker@university.edu",
    gamificationPoints: 1200,
    rsvpStatus: "active",
  };

  const sampleStrikes: NoShowStrikeRecord[] = [
    {
      id: "s1",
      userId: "usr_flaker",
      eventId: "e1",
      createdAt: new Date(mockNow - 10 * 86400000).toISOString(),
    },
    {
      id: "s2",
      userId: "usr_flaker",
      eventId: "e2",
      createdAt: new Date(mockNow - 20 * 86400000).toISOString(),
    },
    {
      id: "s3",
      userId: "usr_flaker",
      eventId: "e3",
      createdAt: new Date(mockNow - 30 * 86400000).toISOString(),
    },
  ];

  it("counts strikes within rolling 90-day window and ignores older strikes", () => {
    const oldStrike: NoShowStrikeRecord = {
      id: "s_old",
      userId: "usr_flaker",
      eventId: "e_old",
      createdAt: new Date(mockNow - 100 * 86400000).toISOString(),
    };

    const count = countStrikesInRollingWindow([...sampleStrikes, oldStrike], "usr_flaker", mockNow);
    expect(count).toBe(3);
  });

  it("triggers 500 point deduction and 14-day restriction upon 3 strikes", () => {
    const penalty = evaluateNoShowPenalty(sampleProfile, sampleStrikes, mockNow);

    expect(penalty.isPenaltyTriggered).toBe(true);
    expect(penalty.deductedPoints).toBe(500);
    expect(penalty.newGamificationPoints).toBe(700);
    expect(penalty.newRsvpStatus).toBe("restricted_rsvp");
    expect(penalty.warningEmailPayload?.toEmail).toBe("flaker@university.edu");
    expect(penalty.warningEmailPayload?.bodyHtml).toContain("paused for <strong>14 days</strong>");
  });

  it("automatically lifts restriction after 14-day penalty duration expires", () => {
    const restrictedProfile: UserPenaltyProfile = {
      ...sampleProfile,
      rsvpStatus: "restricted_rsvp",
      rsvpRestrictedUntil: new Date(mockNow - 1000).toISOString(),
    };

    const restored = checkAndLiftExpiredRestrictions(restrictedProfile, mockNow);
    expect(restored.rsvpStatus).toBe("active");
    expect(restored.rsvpRestrictedUntil).toBeUndefined();
  });
});
