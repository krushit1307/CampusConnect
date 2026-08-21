import { describe, it, expect } from "vitest";
import {
  generateAccessibilityChecklist,
  evaluateAuditCompletion,
  shouldDisplayPendingWarningBadge,
  EventVenueContext,
  AccessibilityChecklistItem,
} from "./accessibilityAudit";

describe("Dynamic Event Accessibility Audit Engine Suite (#3665)", () => {
  const baseContext: EventVenueContext = {
    eventId: "evt_3001",
    eventCategory: "lecture",
    venueType: "historic",
    hasAudioSystem: true,
    isMultiLevel: true,
  };

  it("dynamically generates checklist items tailored to event and venue context", () => {
    const checklist = generateAccessibilityChecklist(baseContext);

    const questions = checklist.map((i) => i.question.toLowerCase());
    expect(questions.some((q) => q.includes("ramp placement"))).toBe(true); // Historic / multi-level
    expect(questions.some((q) => q.includes("microphone batteries"))).toBe(true); // Lecture / AV
    expect(questions.some((q) => q.includes("reserved seating"))).toBe(true); // Lecture
  });

  it("evaluates checklist completion status accurately when all items are verified", () => {
    const checklist = generateAccessibilityChecklist(baseContext);

    expect(evaluateAuditCompletion(checklist).isCompleted).toBe(false);

    // Mark all items as verified
    const completedChecklist: AccessibilityChecklistItem[] = checklist.map((item) => ({
      ...item,
      isVerified: true,
    }));

    const result = evaluateAuditCompletion(completedChecklist);
    expect(result.isCompleted).toBe(true);
    expect(result.verifiedCount).toBe(result.totalCount);
  });

  it("displays pending warning badge if audit is incomplete within 48 hours of event start", () => {
    const now = 1000000000000;
    const eventStartsIn24Hours = new Date(now + 24 * 60 * 60 * 1000).toISOString();

    // Incomplete audit within 24 hours -> Warning active
    expect(shouldDisplayPendingWarningBadge(null, eventStartsIn24Hours, now)).toBe(true);

    // Completed audit -> Warning hidden
    const completedAudit = {
      id: "a1",
      eventId: "evt_3001",
      checklist: [],
      isCompleted: true,
    };
    expect(shouldDisplayPendingWarningBadge(completedAudit, eventStartsIn24Hours, now)).toBe(false);
  });
});
