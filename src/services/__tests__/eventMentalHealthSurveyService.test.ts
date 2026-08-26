import { describe, it, expect } from "vitest";
import {
  calculateEventDurationHours,
  isHighStressTag,
  shouldTriggerMentalHealthSurvey,
  evaluateCrisisEscalation,
  getEventStressAnalytics,
  MicroSurveyResponsePayload,
} from "../eventMentalHealthSurveyService";

describe("Event Mental Health Micro-Survey Service", () => {
  describe("calculateEventDurationHours", () => {
    it("calculates duration in hours between start and end timestamps", () => {
      const start = "2026-09-01T08:00:00.000Z";
      const end = "2026-09-01T22:00:00.000Z"; // 14 hours
      expect(calculateEventDurationHours(start, end)).toBe(14);
    });

    it("returns 0 for invalid or missing timestamps", () => {
      expect(calculateEventDurationHours(undefined, undefined)).toBe(0);
      expect(calculateEventDurationHours("invalid", "invalid")).toBe(0);
    });
  });

  describe("isHighStressTag", () => {
    it("identifies high-stress tags", () => {
      expect(isHighStressTag("High Stress")).toBe(true);
      expect(isHighStressTag("high_stress")).toBe(true);
      expect(isHighStressTag("hackathon")).toBe(true);
      expect(isHighStressTag("mental_health_focus")).toBe(true);
    });

    it("returns false for non-stress tags", () => {
      expect(isHighStressTag("social")).toBe(false);
      expect(isHighStressTag("networking")).toBe(false);
      expect(isHighStressTag("workshop")).toBe(false);
    });
  });

  describe("shouldTriggerMentalHealthSurvey", () => {
    it("triggers micro-survey for events tagged as 'High Stress' regardless of duration", () => {
      const shortHighStressEvent = {
        title: "Final Exam Preparation",
        tags: ["High Stress", "academic"],
        durationHours: 2,
      };
      expect(shouldTriggerMentalHealthSurvey(shortHighStressEvent)).toBe(true);
    });

    it("triggers micro-survey for events with duration strictly greater than 12 hours", () => {
      const longHackathon = {
        title: "24-Hour Campus Hackathon",
        tags: ["technology", "coding"],
        startTime: "2026-09-10T08:00:00.000Z",
        endTime: "2026-09-11T08:00:00.000Z", // 24 hours
      };
      expect(shouldTriggerMentalHealthSurvey(longHackathon)).toBe(true);
    });

    it("does NOT trigger micro-survey for short standard events", () => {
      const standardEvent = {
        title: "Weekly Club Social",
        tags: ["social", "food"],
        durationHours: 2,
      };
      expect(shouldTriggerMentalHealthSurvey(standardEvent)).toBe(false);
    });

    it("respects manual override flags", () => {
      const eventWithManualEnable = {
        title: "Short Event",
        durationHours: 1,
        manualEnableSurvey: true,
      };
      const eventWithManualDisable = {
        title: "Long Event",
        durationHours: 15,
        manualEnableSurvey: false,
      };
      expect(shouldTriggerMentalHealthSurvey(eventWithManualEnable)).toBe(true);
      expect(shouldTriggerMentalHealthSurvey(eventWithManualDisable)).toBe(false);
    });
  });

  describe("evaluateCrisisEscalation", () => {
    it("flags crisis escalation for severe stress levels (4 or 5)", () => {
      const highStressResponse: MicroSurveyResponsePayload = {
        eventId: "evt-1",
        stressLevel: 5,
        hasHydratedAndRested: false,
        requestsPeerSupport: false,
      };
      const result = evaluateCrisisEscalation(highStressResponse);
      expect(result.isCrisisEscalated).toBe(true);
      expect(result.reason).toContain("High burnout score");
    });

    it("flags crisis escalation when attendee requests peer support", () => {
      const peerSupportResponse: MicroSurveyResponsePayload = {
        eventId: "evt-1",
        stressLevel: 2,
        hasHydratedAndRested: true,
        requestsPeerSupport: true,
      };
      const result = evaluateCrisisEscalation(peerSupportResponse);
      expect(result.isCrisisEscalated).toBe(true);
      expect(result.reason).toContain("peer listener");
    });

    it("does NOT flag escalation for mild stress without peer support requests", () => {
      const normalResponse: MicroSurveyResponsePayload = {
        eventId: "evt-1",
        stressLevel: 2,
        hasHydratedAndRested: true,
        requestsPeerSupport: false,
      };
      expect(evaluateCrisisEscalation(normalResponse).isCrisisEscalated).toBe(false);
    });
  });

  describe("getEventStressAnalytics", () => {
    it("accurately calculates stress scores, break compliance, and referral totals", () => {
      const mockResponses: MicroSurveyResponsePayload[] = [
        { eventId: "evt-10", stressLevel: 5, hasHydratedAndRested: false, requestsPeerSupport: true },
        { eventId: "evt-10", stressLevel: 4, hasHydratedAndRested: true, requestsPeerSupport: false },
        { eventId: "evt-10", stressLevel: 2, hasHydratedAndRested: true, requestsPeerSupport: false },
        { eventId: "evt-10", stressLevel: 1, hasHydratedAndRested: true, requestsPeerSupport: false },
      ];

      const stats = getEventStressAnalytics("evt-10", mockResponses);

      expect(stats.totalResponses).toBe(4);
      expect(stats.avgStressScore).toBe(3); // (5+4+2+1)/4 = 3.0
      expect(stats.highStressCount).toBe(2); // 5 and 4
      expect(stats.breakCompliancePercentage).toBe(75); // 3 out of 4 hydrated
      expect(stats.peerSupportRequestsCount).toBe(1);
      expect(stats.stressLevelBreakdown[5]).toBe(1);
    });
  });
});
