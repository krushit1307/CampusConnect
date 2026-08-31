import { describe, it, expect } from "vitest";
import {
  calculateStrikeExpiration,
  isStrikeExpired,
  processStrikeForgivenessBatch,
  ClubProbationRecord,
} from "./clubStrikeForgiveness";

describe("Implement Automated Club Strike Forgiveness Suite (#4401)", () => {
  const mockNow = new Date("2026-08-25T00:00:00Z");

  const expiredStrike: ClubProbationRecord = {
    id: "prob_1",
    clubId: "club_party",
    clubName: "Campus Party Club",
    reason: "Noise violation",
    status: "active",
    createdAtIso: "2025-08-20T00:00:00Z",
    expiresAtIso: "2026-08-20T00:00:00Z", // Expired 5 days ago
    presidentEmail: "president@partyclub.edu",
  };

  const activeStrike: ClubProbationRecord = {
    id: "prob_2",
    clubId: "club_robotics",
    clubName: "Robotics Club",
    reason: "Late room clearance",
    status: "active",
    createdAtIso: "2026-01-01T00:00:00Z",
    expiresAtIso: "2027-01-01T00:00:00Z", // Expires next year
    presidentEmail: "president@robotics.edu",
  };

  it("calculates 365-day expiration timestamp by default", () => {
    const issuance = new Date("2026-01-01T00:00:00Z");
    const expiryIso = calculateStrikeExpiration(issuance, 365);

    expect(expiryIso).toContain("2027-01-01");
  });

  it("evaluates strike expiration accurately against current time", () => {
    expect(isStrikeExpired(expiredStrike.expiresAtIso, mockNow)).toBe(true);
    expect(isStrikeExpired(activeStrike.expiresAtIso, mockNow)).toBe(false);
  });

  it("expunges expired strikes in batch and generates notification emails for presidents", () => {
    const batch = [expiredStrike, activeStrike];
    const result = processStrikeForgivenessBatch(batch, mockNow);

    expect(result.expungedCount).toBe(1);
    expect(result.expungedRecords[0].id).toBe("prob_1");
    expect(result.expungedRecords[0].status).toBe("expunged");

    expect(result.notificationsToSend.length).toBe(1);
    expect(result.notificationsToSend[0].recipientEmail).toBe("president@partyclub.edu");
    expect(result.notificationsToSend[0].body).toContain("has been expunged.");
    expect(result.notificationsToSend[0].body).toContain(
      "Campus Party Club is back in good standing",
    );
  });
});
