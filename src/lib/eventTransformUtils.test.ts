import { describe, it, expect } from "vitest";
import {
  extractProfile,
  buildPersonName,
  buildKanbanColumns,
  buildRsvpStatus,
  buildFeedbackStatus,
  buildWaitlistInfo,
  buildGoogleMapsSearchUrl,
} from "./eventTransformUtils";

describe("extractProfile", () => {
  it("returns the first element when given an array", () => {
    const profiles = [{ id: "1", first_name: "Alice" }, { id: "2" }];
    expect(extractProfile(profiles)).toEqual({ id: "1", first_name: "Alice" });
  });

  it("returns the profile directly when not an array", () => {
    const profile = { id: "1", first_name: "Bob" };
    expect(extractProfile(profile)).toEqual(profile);
  });

  it("returns null when given null", () => {
    expect(extractProfile(null)).toBeNull();
  });
});

describe("buildPersonName", () => {
  it("combines first and last name", () => {
    expect(buildPersonName({ id: "1", first_name: "John", last_name: "Doe" })).toBe("John Doe");
  });

  it("falls back to full_name", () => {
    expect(buildPersonName({ id: "1", full_name: "Jane Smith" })).toBe("Jane Smith");
  });

  it("returns Unknown User for null", () => {
    expect(buildPersonName(null)).toBe("Unknown User");
  });
});

describe("buildKanbanColumns", () => {
  const baseRsvp = (overrides: Record<string, unknown> = {}) => ({
    id: "r1",
    user_id: "u1",
    status: "approved",
    profiles: [{ id: "u1", first_name: "Alice", last_name: "Smith" }],
    ...overrides,
  });

  it("splits RSVPs into approved, rejected, and waitlisted columns", () => {
    const result = buildKanbanColumns(
      [],
      [
        baseRsvp({ id: "r1", status: "approved" }),
        baseRsvp({ id: "r2", status: "rejected" }),
        baseRsvp({ id: "r3", status: "waitlisted" }),
      ],
    );
    expect(result.approved).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.waitlisted).toHaveLength(1);
  });

  it("includes waitlist entries in waitlisted column", () => {
    const result = buildKanbanColumns(
      [{ id: "w1", user_id: "u2", profiles: [{ id: "u2", first_name: "Bob" }] }],
      [],
    );
    expect(result.waitlisted).toHaveLength(1);
  });

  it("returns empty arrays when no data", () => {
    const result = buildKanbanColumns([], []);
    expect(result.waitlisted).toEqual([]);
    expect(result.approved).toEqual([]);
    expect(result.rejected).toEqual([]);
  });
});

describe("buildRsvpStatus", () => {
  it("identifies hasRsvpd when user has an RSVP", () => {
    const rsvps = [{ id: "r1", user_id: "u1", status: "approved" }];
    expect(buildRsvpStatus(rsvps, "u1", null).hasRsvpd).toBe(true);
    expect(buildRsvpStatus(rsvps, "u1", null).isCheckedIn).toBe(false);
  });

  it("identifies isCheckedIn when user has checked in", () => {
    const rsvps = [{ id: "r1", user_id: "u1", status: "approved", checked_in: true }];
    expect(buildRsvpStatus(rsvps, "u1", null).isCheckedIn).toBe(true);
  });

  it("returns false for unknown user", () => {
    expect(buildRsvpStatus([], "u1", null).hasRsvpd).toBe(false);
  });
});

describe("buildFeedbackStatus", () => {
  it("returns true when user has submitted feedback", () => {
    const feedbacks = [{ user_id: "u1" }, { user_id: "u2" }];
    expect(buildFeedbackStatus(feedbacks, "u1").hasSubmittedFeedback).toBe(true);
  });

  it("returns false when no feedbacks array", () => {
    expect(buildFeedbackStatus(undefined, "u1").hasSubmittedFeedback).toBe(false);
  });
});

describe("buildWaitlistInfo", () => {
  it("sorts waitlist by created_at", () => {
    const raw = [
      { id: "w1", user_id: "u2", created_at: "2026-07-02T10:00:00Z" },
      { id: "w2", user_id: "u1", created_at: "2026-07-01T10:00:00Z" },
    ];
    const result = buildWaitlistInfo(raw, "u1");
    expect(result.waitlist[0].id).toBe("w2");
    expect(result.isOnWaitlist).toBe(true);
    expect(result.waitlistPosition).toBe(1);
  });

  it("returns position 0 when user is not on waitlist", () => {
    expect(buildWaitlistInfo([], "u1").waitlistPosition).toBe(0);
  });
});

describe("buildGoogleMapsSearchUrl", () => {
  it("encodes the location and returns correct URL", () => {
    expect(buildGoogleMapsSearchUrl("123 Main St")).toBe(
      "https://www.google.com/maps/search/?q=123%20Main%20St",
    );
  });

  it("handles special characters", () => {
    expect(buildGoogleMapsSearchUrl("Café & Bakery")).toContain("q=");
  });
});
