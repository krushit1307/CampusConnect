import { describe, it, expect } from "vitest";
import {
  generateCryptographicAnonymityHash,
  processEventFeedbackSubmission,
  EventFeedbackSubmissionInput,
} from "./anonymousEventFeedback";

describe("Implement Automated Event Feedback Anonymity Toggle Suite (#4781)", () => {
  const sampleInput: EventFeedbackSubmissionInput = {
    eventId: "evt_townhall_2026",
    userId: "usr_student_jack",
    rating: 1,
    reviewComment: "The President ignored questions about club funding.",
    isAnonymous: true,
  };

  it("generates deterministic 64-character SHA-256 cryptographic anonymity hashes", () => {
    const hash1 = generateCryptographicAnonymityHash("usr_student_jack", "evt_townhall_2026");
    const hash2 = generateCryptographicAnonymityHash("usr_student_jack", "evt_townhall_2026");

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);
  });

  it("nullifies user_id and generates anonymous payload when toggle is active", () => {
    const payload = processEventFeedbackSubmission(sampleInput, "Jack Vance");

    expect(payload.isAnonymous).toBe(true);
    expect(payload.userId).toBeNull();
    expect(payload.displayAuthorName).toBe("Anonymous Student");
    expect(payload.anonymousUserHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retains raw user_id and author name when anonymity toggle is disabled", () => {
    const publicInput: EventFeedbackSubmissionInput = {
      ...sampleInput,
      isAnonymous: false,
    };

    const payload = processEventFeedbackSubmission(publicInput, "Jack Vance");

    expect(payload.isAnonymous).toBe(false);
    expect(payload.userId).toBe("usr_student_jack");
    expect(payload.displayAuthorName).toBe("Jack Vance");
    expect(payload.anonymousUserHash).toBeNull();
  });
});
