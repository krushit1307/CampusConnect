import { describe, it, expect, beforeEach } from "vitest";
import {
  EventSeriesProgressionService,
  EventSeries,
} from "../../src/services/eventSeriesProgressionService";

describe("EventSeriesProgressionService (#3934)", () => {
  beforeEach(() => {
    EventSeriesProgressionService.resetState();
  });

  it("should calculate completion percentage accurately", () => {
    expect(EventSeriesProgressionService.calculateCompletion(0, 10)).toBe(0);
    expect(EventSeriesProgressionService.calculateCompletion(4, 10)).toBe(40);
    expect(EventSeriesProgressionService.calculateCompletion(10, 10)).toBe(100);
    expect(EventSeriesProgressionService.calculateCompletion(1, 3)).toBe(33.3);
    expect(EventSeriesProgressionService.calculateCompletion(0, 0)).toBe(0);
  });

  it("should retrieve default active event series with 10 bootcamp sessions", () => {
    const seriesList = EventSeriesProgressionService.getAllSeries();
    expect(seriesList.length).toBeGreaterThan(0);

    const bootcamp = seriesList.find((s) => s.slug === "startup-bootcamp-2026");
    expect(bootcamp).toBeDefined();
    expect(bootcamp?.totalEvents).toBe(10);
    expect(bootcamp?.sessions.length).toBe(10);
    expect(bootcamp?.milestones.length).toBe(3);
  });

  it("should track user progression, unlock milestones, and trigger completion flag at 100%", () => {
    const userId = "student-test-42";
    const seriesId = "series-startup-bootcamp-2026";

    // Initial progress
    const initProg = EventSeriesProgressionService.getUserSeriesProgress(userId, seriesId);
    expect(initProg.eventsAttended).toBe(0);
    expect(initProg.completionPercentage).toBe(0);
    expect(initProg.isCompleted).toBe(false);

    // Attend 1st session -> Milestone 1 unlocks
    const step1 = EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-1");
    expect(step1.progress.eventsAttended).toBe(1);
    expect(step1.progress.completionPercentage).toBe(10);
    expect(step1.progress.unlockedMilestones.length).toBe(1);
    expect(step1.progress.unlockedMilestones[0].milestoneName).toBe("First Step: Idea Spark");
    expect(step1.justCompleted).toBe(false);

    // Attend through session 5 -> Milestone 2 unlocks
    EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-2");
    EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-3");
    EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-4");
    const step5 = EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-5");
    expect(step5.progress.eventsAttended).toBe(5);
    expect(step5.progress.completionPercentage).toBe(50);
    expect(step5.progress.unlockedMilestones.length).toBe(2);

    // Attend remaining sessions through session 10 -> 100% completion & Milestone 3
    EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-6");
    EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-7");
    EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-8");
    EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-9");
    const finalStep = EventSeriesProgressionService.recordAttendance(userId, seriesId, "sb-10");

    expect(finalStep.progress.eventsAttended).toBe(10);
    expect(finalStep.progress.completionPercentage).toBe(100);
    expect(finalStep.progress.isCompleted).toBe(true);
    expect(finalStep.justCompleted).toBe(true);
    expect(finalStep.progress.unlockedMilestones.length).toBe(3);
  });

  it("should claim completion reward and prevent duplicate claims", () => {
    const userId = "student-champion-99";
    const seriesId = "series-startup-bootcamp-2026";

    // Attempt claim prior to completion -> should throw
    expect(() => EventSeriesProgressionService.claimReward(userId, seriesId)).toThrow(
      /Cannot claim reward before achieving full completion/,
    );

    // Attend all 10 sessions
    for (let i = 1; i <= 10; i++) {
      EventSeriesProgressionService.recordAttendance(userId, seriesId, `sb-${i}`);
    }

    // Now claim reward
    const claimRes = EventSeriesProgressionService.claimReward(userId, seriesId);
    expect(claimRes.success).toBe(true);
    expect(claimRes.rewardTitle).toContain("Pitch Grant");

    // Second claim attempt -> should throw
    expect(() => EventSeriesProgressionService.claimReward(userId, seriesId)).toThrow(
      /already been claimed/,
    );
  });

  it("should support custom registered series", () => {
    const customSeries: EventSeries = {
      id: "series-ai-hackathon",
      title: "AI Hackathon Prep Series",
      slug: "ai-hackathon-prep",
      description: "3-part workshop",
      totalEvents: 3,
      requiredCompletionPercentage: 100,
      rewardType: "SWAG_GRANT",
      rewardTitle: "Hackathon VIP Swag Pack",
      isActive: true,
      sessions: [
        {
          id: "ai-1",
          seriesId: "series-ai-hackathon",
          sessionNumber: 1,
          title: "LLM Basics",
          eventDate: "2026-09-01",
          location: "Lab 1",
          isMandatory: true,
        },
        {
          id: "ai-2",
          seriesId: "series-ai-hackathon",
          sessionNumber: 2,
          title: "RAG & Vector DBs",
          eventDate: "2026-09-02",
          location: "Lab 1",
          isMandatory: true,
        },
        {
          id: "ai-3",
          seriesId: "series-ai-hackathon",
          sessionNumber: 3,
          title: "Agentic Workflows",
          eventDate: "2026-09-03",
          location: "Lab 1",
          isMandatory: true,
        },
      ],
      milestones: [],
    };

    EventSeriesProgressionService.registerSeries(customSeries);
    const found = EventSeriesProgressionService.getSeriesById("series-ai-hackathon");
    expect(found?.title).toBe("AI Hackathon Prep Series");

    const prog = EventSeriesProgressionService.getUserSeriesProgress(
      "user-ai",
      "series-ai-hackathon",
    );
    expect(prog.totalEvents).toBe(3);
  });
});
