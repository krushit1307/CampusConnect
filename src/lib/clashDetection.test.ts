import { describe, it, expect } from "vitest";
import {
  evaluateEventClashes,
  areIntervalsOverlapping,
  ExistingEvent,
  ProposedEvent,
} from "./clashDetection";

describe("Event Clash Detection Engine Suite (#2666)", () => {
  const existingEvents: ExistingEvent[] = [
    {
      id: "e1",
      title: "Annual Hackathon",
      startTime: "2026-10-15T10:00:00Z",
      endTime: "2026-10-15T18:00:00Z",
      locationId: "auditorium_a",
      category: "Tech",
    },
    {
      id: "e2",
      title: "AI Workshop",
      startTime: "2026-10-15T14:00:00Z",
      endTime: "2026-10-15T16:00:00Z",
      locationId: "lab_3",
      category: "Tech",
    },
  ];

  it("correctly identifies time interval overlaps", () => {
    expect(
      areIntervalsOverlapping(
        "2026-10-15T09:00:00Z",
        "2026-10-15T11:00:00Z",
        "2026-10-15T10:00:00Z",
        "2026-10-15T12:00:00Z",
      ),
    ).toBe(true);

    expect(
      areIntervalsOverlapping(
        "2026-10-15T08:00:00Z",
        "2026-10-15T09:00:00Z",
        "2026-10-15T10:00:00Z",
        "2026-10-15T12:00:00Z",
      ),
    ).toBe(false);
  });

  it("flags HARD clash when same location is reserved at overlapping time", () => {
    const proposed: ProposedEvent = {
      startTime: "2026-10-15T12:00:00Z",
      endTime: "2026-10-15T15:00:00Z",
      locationId: "auditorium_a", // Matches e1
    };

    const result = evaluateEventClashes(proposed, existingEvents);

    expect(result.hasClash).toBe(true);
    expect(result.severity).toBe("HARD");
    expect(result.hardClashes.length).toBe(1);
    expect(result.message).toContain("Hard Clash");
  });

  it("flags SOFT clash when different room but same demographic/category overlaps", () => {
    const proposed: ProposedEvent = {
      startTime: "2026-10-15T12:00:00Z",
      endTime: "2026-10-15T15:00:00Z",
      locationId: "room_b", // Different room
      category: "Tech", // Matches e1 and e2 category
    };

    const result = evaluateEventClashes(proposed, existingEvents);

    expect(result.hasClash).toBe(true);
    expect(result.severity).toBe("SOFT");
    expect(result.softClashes.length).toBe(2);
    expect(result.message).toContain("Warning:");
  });

  it("returns NONE when time slot and room have no conflicts", () => {
    const proposed: ProposedEvent = {
      startTime: "2026-10-16T10:00:00Z",
      endTime: "2026-10-16T12:00:00Z",
      locationId: "auditorium_a",
      category: "Tech",
    };

    const result = evaluateEventClashes(proposed, existingEvents);

    expect(result.hasClash).toBe(false);
    expect(result.severity).toBe("NONE");
  });
});
