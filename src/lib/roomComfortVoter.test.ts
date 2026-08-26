import { describe, it, expect } from "vitest";
import {
  evaluateRoomComfortConsensus,
  filterVotesInRollingWindow,
  ComfortVoteRecord,
} from "./roomComfortVoter";

describe("Real-Time Room Temperature Comfort Voter Suite (#3704)", () => {
  const mockNow = 1000000000000;

  const createVote = (
    id: string,
    vote: "TOO_HOT" | "TOO_COLD" | "PERFECT",
    minutesAgo: number,
  ): ComfortVoteRecord => ({
    id,
    eventId: "evt_auditorium_a",
    userId: `usr_${id}`,
    vote,
    createdAt: new Date(mockNow - minutesAgo * 60 * 1000).toISOString(),
  });

  it("filters out comfort votes older than the 15-minute rolling window", () => {
    const votes = [
      createVote("v1", "TOO_HOT", 5), // Within window
      createVote("v2", "TOO_HOT", 10), // Within window
      createVote("v3", "TOO_HOT", 20), // Older than 15 mins (ignored)
    ];

    const active = filterVotesInRollingWindow(votes, mockNow);
    expect(active.length).toBe(2);
  });

  it("triggers Facilities alert when > 30% of checked-in attendees report extreme heat", () => {
    // 100 checked-in attendees, 35 vote TOO_HOT within 15 mins -> 35% > 30%
    const votes: ComfortVoteRecord[] = [];
    for (let i = 0; i < 35; i++) {
      votes.push(createVote(`hot_${i}`, "TOO_HOT", 5));
    }

    const consensus = evaluateRoomComfortConsensus(
      "evt_auditorium_a",
      "Auditorium A",
      100,
      votes,
      mockNow,
    );

    expect(consensus.isAlertTriggered).toBe(true);
    expect(consensus.alertType).toBe("HVAC_TOO_HOT");
    expect(consensus.tooHotPercentage).toBe(35.0);
    expect(consensus.facilitiesWebhookPayload?.message).toContain(
      "35 students (35%) in Auditorium A are reporting extreme heat",
    );
  });

  it("does not trigger alert when vote count remains below 30% threshold", () => {
    // 100 checked-in attendees, 20 vote TOO_HOT -> 20% < 30%
    const votes: ComfortVoteRecord[] = [];
    for (let i = 0; i < 20; i++) {
      votes.push(createVote(`hot_${i}`, "TOO_HOT", 5));
    }

    const consensus = evaluateRoomComfortConsensus(
      "evt_auditorium_a",
      "Auditorium A",
      100,
      votes,
      mockNow,
    );

    expect(consensus.isAlertTriggered).toBe(false);
    expect(consensus.facilitiesWebhookPayload).toBeUndefined();
  });
});
