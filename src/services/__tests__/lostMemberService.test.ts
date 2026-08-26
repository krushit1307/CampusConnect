import { describe, it, expect } from "vitest";
import {
  analyzeMemberAttendanceVelocity,
  generateLostMemberReengagementDraft,
} from "../lostMemberService";

describe("lostMemberService - Churn Detection & Re-engagement", () => {
  const referenceDate = new Date("2026-11-01T12:00:00Z");

  it("detects a lost member who attended > 3 events previously and 0 events in the last 60 days", () => {
    const rsvps = [
      { eventDate: "2026-08-01T10:00:00Z", status: "attended" }, // 92 days ago
      { eventDate: "2026-08-10T10:00:00Z", status: "attended" }, // 83 days ago
      { eventDate: "2026-08-20T10:00:00Z", status: "attended" }, // 73 days ago
      { eventDate: "2026-08-30T10:00:00Z", status: "attended" }, // 63 days ago
    ];

    const result = analyzeMemberAttendanceVelocity(rsvps, referenceDate);
    expect(result.totalPastAttended).toBe(4);
    expect(result.daysSinceLastAttended).toBeGreaterThanOrEqual(60);
    expect(result.isLostMember).toBe(true);
  });

  it("does NOT mark a member as lost if they attended an event within the last 60 days", () => {
    const rsvps = [
      { eventDate: "2026-08-01T10:00:00Z", status: "attended" },
      { eventDate: "2026-08-10T10:00:00Z", status: "attended" },
      { eventDate: "2026-08-20T10:00:00Z", status: "attended" },
      { eventDate: "2026-08-30T10:00:00Z", status: "attended" },
      { eventDate: "2026-10-15T10:00:00Z", status: "attended" }, // 17 days ago
    ];

    const result = analyzeMemberAttendanceVelocity(rsvps, referenceDate);
    expect(result.totalPastAttended).toBe(5);
    expect(result.daysSinceLastAttended).toBeLessThan(60);
    expect(result.isLostMember).toBe(false);
  });

  it("does NOT mark a member as lost if they have attended <= 3 events in total", () => {
    const rsvps = [
      { eventDate: "2026-07-01T10:00:00Z", status: "attended" },
      { eventDate: "2026-07-15T10:00:00Z", status: "attended" },
      { eventDate: "2026-08-01T10:00:00Z", status: "attended" },
    ];

    const result = analyzeMemberAttendanceVelocity(rsvps, referenceDate);
    expect(result.totalPastAttended).toBe(3);
    expect(result.isLostMember).toBe(false);
  });

  it("ignores non-attended RSVP statuses (e.g. cancelled, registered)", () => {
    const rsvps = [
      { eventDate: "2026-07-01T10:00:00Z", status: "attended" },
      { eventDate: "2026-07-15T10:00:00Z", status: "registered" },
      { eventDate: "2026-08-01T10:00:00Z", status: "cancelled" },
    ];

    const result = analyzeMemberAttendanceVelocity(rsvps, referenceDate);
    expect(result.totalPastAttended).toBe(1);
    expect(result.isLostMember).toBe(false);
  });

  it("correctly generates draft email content with president and club personalization", () => {
    const draft = generateLostMemberReengagementDraft({
      memberName: "Alex Rivera",
      clubName: "Robotics Club",
      presidentName: "Sarah Chen",
    });

    expect(draft.subject).toContain("Robotics Club");
    expect(draft.body).toContain("Hey Alex Rivera");
    expect(draft.body).toContain("Sarah Chen");
    expect(draft.body).toContain("missed you at the last few Robotics Club meetings");
  });
});
