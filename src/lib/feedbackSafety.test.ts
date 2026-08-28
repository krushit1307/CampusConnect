import { describe, expect, it } from "vitest";

import {
  CRITICAL_SAFETY_THREAT_MARKER,
  containsCriticalSafetyLanguage,
  extractMarkedSafetyText,
  findCriticalSafetyFeedbacks,
} from "../../supabase/functions/_shared/feedback-safety";

describe("feedback safety routing", () => {
  const feedbacks = [
    { id: "feedback-1", comments: "I felt incredibly unsafe because someone was following me." },
    { id: "feedback-2", comments: "The check-in line was too long." },
  ];

  it("detects safety language without requiring an LLM response", () => {
    expect(containsCriticalSafetyLanguage(feedbacks[0].comments)).toBe(true);
    expect(containsCriticalSafetyLanguage(feedbacks[1].comments)).toBe(false);
  });

  it("extracts only a marker-prefixed raw report", () => {
    expect(
      extractMarkedSafetyText(`${CRITICAL_SAFETY_THREAT_MARKER} ${feedbacks[0].comments}`),
    ).toBe(feedbacks[0].comments);
    expect(extractMarkedSafetyText("ordinary summary")).toBeNull();
  });

  it("returns deterministic matches and preserves unmatched marker text", () => {
    expect(findCriticalSafetyFeedbacks("ordinary summary", feedbacks)).toEqual([feedbacks[0]]);
    expect(
      findCriticalSafetyFeedbacks(
        `${CRITICAL_SAFETY_THREAT_MARKER} A threat was made at the venue.`,
        [feedbacks[1]],
      ),
    ).toEqual([{ id: "llm-unmatched", comments: "A threat was made at the venue." }]);
  });
});
