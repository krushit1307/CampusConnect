import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventLinguisticSentimentDriftService } from "../eventLinguisticSentimentDriftService";
import { LinguisticSentimentPoint } from "@/types/eventLinguisticSentimentDrift";

describe("EventLinguisticSentimentDriftService", () => {
  let service: EventLinguisticSentimentDriftService;

  beforeEach(() => {
    service = new EventLinguisticSentimentDriftService();
  });

  describe("tokenizeText", () => {
    it("should tokenize text and filter out stop words", () => {
      const text = "The event was really amazing and awesome for everyone!";
      const tokens = service.tokenizeText(text);

      expect(tokens).toContain("amazing");
      expect(tokens).toContain("awesome");
      expect(tokens).toContain("everyone");
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("was");
      expect(tokens).not.toContain("and");
    });

    it("should return empty array for empty input", () => {
      expect(service.tokenizeText("")).toEqual([]);
    });
  });

  describe("calculateSentimentMetrics", () => {
    it("should calculate stable sentiment when baseline and current match", () => {
      const baseline = [0.5, 0.6, 0.4];
      const current = [0.5, 0.5];

      const res = service.calculateSentimentMetrics(baseline, current, 0);

      expect(res.baselineSentiment).toBe(0.5);
      expect(res.currentSentiment).toBe(0.5);
      expect(res.driftDelta).toBe(0);
      expect(res.driftDirection).toBe("STABLE");
      expect(res.severity).toBe("LOW");
    });

    it("should classify declining sentiment when current drops below baseline threshold", () => {
      const baseline = [0.8, 0.7, 0.9]; // ~0.8
      const current = [0.2, 0.1, 0.3]; // ~0.2 (delta -0.6)

      const res = service.calculateSentimentMetrics(baseline, current, 0);

      expect(res.baselineSentiment).toBe(0.8);
      expect(res.currentSentiment).toBe(0.2);
      expect(res.driftDelta).toBe(-0.6);
      expect(res.driftDirection).toBe("DECLINING");
      expect(res.severity).toBe("CRITICAL");
    });

    it("should classify improving sentiment when current rises", () => {
      const baseline = [0.1, 0.2]; // ~0.15
      const current = [0.6, 0.7]; // ~0.65 (delta +0.5)

      const res = service.calculateSentimentMetrics(baseline, current, 0);

      expect(res.driftDirection).toBe("IMPROVING");
      expect(res.driftDelta).toBeGreaterThan(0.25);
    });

    it("should classify coercion spike when coercionSpikeCount > 0 and sentiment is positive", () => {
      const baseline = [0.2, 0.3];
      const current = [0.8, 0.9];

      const res = service.calculateSentimentMetrics(baseline, current, 2);

      expect(res.driftDirection).toBe("COERCION_SPIKE");
      expect(res.severity).toBe("HIGH");
    });
  });

  describe("extractLinguisticTermShifts", () => {
    it("should identify top shifting terms between baseline and current comments", () => {
      const baseline = [
        "The keynote presentation was great and informative.",
        "Loved the speakers and presentation quality.",
      ];
      const current = [
        "Disappointed by venue temperature and hot room.",
        "Check-in line was terrible and hot venue.",
      ];

      const shifts = service.extractLinguisticTermShifts(baseline, current, 5);

      expect(shifts.length).toBeGreaterThan(0);
      const hotShift = shifts.find((s) => s.term === "hot");
      expect(hotShift).toBeDefined();
    });
  });

  describe("detectCoercionSpike", () => {
    it("should detect spike when anomaly >= 60, sentiment >= 0.4, rating >= 4", () => {
      const points: LinguisticSentimentPoint[] = [
        {
          id: "1",
          timestamp: new Date().toISOString(),
          sentimentScore: 0.8,
          coercionAnomalyScore: 75,
          rating: 5,
          feedbackText: "Super amazing outstanding!",
          keywords: ["super", "amazing"],
        },
      ];

      const res = service.detectCoercionSpike(points);
      expect(res.isSpikeDetected).toBe(true);
      expect(res.suspiciousPointCount).toBe(1);
    });

    it("should return false when anomaly score is low", () => {
      const points: LinguisticSentimentPoint[] = [
        {
          id: "1",
          timestamp: new Date().toISOString(),
          sentimentScore: 0.8,
          coercionAnomalyScore: 20,
          rating: 5,
          feedbackText: "Super amazing outstanding!",
          keywords: ["super", "amazing"],
        },
      ];

      const res = service.detectCoercionSpike(points);
      expect(res.isSpikeDetected).toBe(false);
    });
  });

  describe("evaluateEventLinguisticDrift", () => {
    it("should produce complete drift analysis report", async () => {
      const result = await service.evaluateEventLinguisticDrift(
        "test-event-123",
        "Campus Hackathon",
      );

      expect(result.eventId).toBe("test-event-123");
      expect(result.eventTitle).toBe("Campus Hackathon");
      expect(result).toHaveProperty("baselineSentiment");
      expect(result).toHaveProperty("currentSentiment");
      expect(result).toHaveProperty("driftDelta");
      expect(result).toHaveProperty("driftDirection");
      expect(result).toHaveProperty("executiveSummaryMarkdown");
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});
