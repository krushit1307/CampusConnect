import { describe, it, expect } from "vitest";
import {
  buildConflictResolverPrompt,
  generateDeterministicFallbackResolution,
  ScheduledEventContext,
} from "./scheduleConflictResolver";

describe("AI Schedule Conflict Resolver Suite (#2733)", () => {
  const mandatoryMeeting: ScheduledEventContext = {
    id: "evt_1",
    title: "Mandatory Club Board Meeting",
    isMandatory: true,
    isRecorded: false,
    description: "Required attendance for all officers.",
  };

  const recordedLecture: ScheduledEventContext = {
    id: "evt_2",
    title: "Physics Lecture",
    isMandatory: false,
    isRecorded: true,
    description: "Weekly general lecture recorded on Canvas.",
  };

  const resumeReview: ScheduledEventContext = {
    id: "evt_3",
    title: "1-on-1 Resume Review",
    isOneOnOne: true,
    description: "Personalized career counseling session.",
  };

  it("builds strict context-bound AI prompts", () => {
    const prompt = buildConflictResolverPrompt(mandatoryMeeting, recordedLecture);

    expect(prompt.systemPrompt).toContain("ONLY the provided descriptions");
    expect(prompt.userPrompt).toContain("Mandatory Club Board Meeting");
    expect(prompt.userPrompt).toContain("Physics Lecture");
  });

  it("provides deterministic fallback prioritizing mandatory events", () => {
    const fallback = generateDeterministicFallbackResolution(mandatoryMeeting, recordedLecture);

    expect(fallback.recommendedKeepEventId).toBe("evt_1");
    expect(fallback.recommendedCancelEventId).toBe("evt_2");
    expect(fallback.reasoning).toContain("mandatory");
    expect(fallback.isAiGenerated).toBe(false);
  });

  it("provides deterministic fallback prioritizing live 1-on-1 sessions over recorded lectures", () => {
    const fallback = generateDeterministicFallbackResolution(resumeReview, recordedLecture);

    expect(fallback.recommendedKeepEventId).toBe("evt_3");
    expect(fallback.recommendedCancelEventId).toBe("evt_2");
    expect(fallback.reasoning).toContain("recorded");
    expect(fallback.isAiGenerated).toBe(false);
  });
});
