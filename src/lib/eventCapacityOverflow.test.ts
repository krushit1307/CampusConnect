import { describe, it, expect } from "vitest";
import {
  allocateVenueTierForRsvp,
  generateVenueTierQrPayload,
  PrimaryEventCapacityConfig,
  ExistingRsvpTierCount,
} from "./eventCapacityOverflow";

describe("Automated Event Capacity Overflow Handling Suite (#3673)", () => {
  const sampleConfig: PrimaryEventCapacityConfig = {
    eventId: "evt_speaker_99",
    primaryVenueName: "Main Auditorium",
    primaryCapacity: 500,
    overflowVenues: [{ id: "ov_1", venueName: "Video Overflow Room 204", capacity: 100 }],
  };

  it("assigns MAIN tier ticket when main auditorium has open capacity", () => {
    const counts: ExistingRsvpTierCount[] = [
      { tier: "MAIN", venueName: "Main Auditorium", count: 499 },
    ];

    const result = allocateVenueTierForRsvp(sampleConfig, counts);

    expect(result.tier).toBe("MAIN");
    expect(result.assignedVenueName).toBe("Main Auditorium");
    expect(result.isOverflow).toBe(false);
  });

  it("automatically cascades to OVERFLOW tier when main auditorium hits 100% capacity", () => {
    const counts: ExistingRsvpTierCount[] = [
      { tier: "MAIN", venueName: "Main Auditorium", count: 500 }, // Full
      { tier: "OVERFLOW", venueName: "Video Overflow Room 204", count: 10 },
    ];

    const result = allocateVenueTierForRsvp(sampleConfig, counts);

    expect(result.tier).toBe("OVERFLOW");
    expect(result.assignedVenueName).toBe("Video Overflow Room 204");
    expect(result.isOverflow).toBe(true);
    expect(result.displayMessage).toContain("Main Auditorium is Full");
  });

  it("throws error when both primary and overflow rooms are completely full", () => {
    const counts: ExistingRsvpTierCount[] = [
      { tier: "MAIN", venueName: "Main Auditorium", count: 500 },
      { tier: "OVERFLOW", venueName: "Video Overflow Room 204", count: 100 },
    ];

    expect(() => allocateVenueTierForRsvp(sampleConfig, counts)).toThrow(
      "Main room and all overflow rooms are at 100% capacity.",
    );
  });

  it("generates distinct QR signatures for main vs overflow tickets", () => {
    const mainQr = generateVenueTierQrPayload("evt_speaker_99", "usr_1", "MAIN", "Main Auditorium");
    const overflowQr = generateVenueTierQrPayload(
      "evt_speaker_99",
      "usr_2",
      "OVERFLOW",
      "Video Overflow Room 204",
    );

    expect(mainQr.tier).toBe("MAIN");
    expect(overflowQr.tier).toBe("OVERFLOW");
    expect(mainQr.qrSignature).not.toBe(overflowQr.qrSignature);
  });
});
