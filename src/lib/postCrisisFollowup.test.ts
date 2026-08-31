import { describe, it, expect } from "vitest";
import {
  calculateFollowupDueDate,
  isFollowupDue,
  buildCrisisFollowupEmail,
  MONITORED_HEALTH_STAFF_EMAIL,
  CrisisInterventionRecord,
} from "./postCrisisFollowup";

describe("Develop Dynamic Mental Health Post-Crisis Follow-up Suite (#4524)", () => {
  const sampleRecord: CrisisInterventionRecord = {
    id: "cr_int_101",
    userId: "usr_student_alex",
    userEmail: "alex@university.edu",
    fullName: "Alex Rivera",
    triggeredAtIso: "2026-08-25T10:00:00Z",
    followupDueAtIso: "2026-08-27T10:00:00Z", // Exactly 48 hours later
    followupStatus: "pending",
  };

  it("calculates accurate 48-hour follow-up due timestamps", () => {
    const triggeredAt = new Date("2026-08-25T10:00:00Z");
    const dueDate = calculateFollowupDueDate(triggeredAt);

    expect(dueDate.toISOString()).toBe("2026-08-27T10:00:00.000Z");
  });

  it("correctly identifies when pending follow-ups are due for cron processing", () => {
    const beforeDue = new Date("2026-08-26T10:00:00Z"); // 24 hours later
    const exactDue = new Date("2026-08-27T10:00:00Z"); // 48 hours later
    const afterDue = new Date("2026-08-27T12:00:00Z"); // 50 hours later

    expect(isFollowupDue(sampleRecord.followupDueAtIso, beforeDue)).toBe(false);
    expect(isFollowupDue(sampleRecord.followupDueAtIso, exactDue)).toBe(true);
    expect(isFollowupDue(sampleRecord.followupDueAtIso, afterDue)).toBe(true);
  });

  it("constructs gentle personalized check-in email with reply-to set to monitored health staff", () => {
    const emailPayload = buildCrisisFollowupEmail(sampleRecord);

    expect(emailPayload.recipientEmail).toBe("alex@university.edu");
    expect(emailPayload.replyToEmail).toBe(MONITORED_HEALTH_STAFF_EMAIL);
    expect(emailPayload.subject).toContain("Checking in - Campus Student Wellness");
    expect(emailPayload.bodyText).toContain("Hi Alex,");
    expect(emailPayload.bodyText).toContain(
      "Were you able to connect with someone at the Counseling Center?",
    );
    expect(emailPayload.bodyText).toContain("you can reply directly to this email for help.");
  });
});
