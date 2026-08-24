import { describe, it, expect, beforeEach } from "vitest";
import { accessibilityFulfillmentService } from "../accessibilityFulfillmentService";

describe("AccessibilityFulfillmentService", () => {
  beforeEach(() => {
    accessibilityFulfillmentService.resetToSample();
  });

  it("retrieves sample requests and active requests correctly", () => {
    const all = accessibilityFulfillmentService.getAllRequests();
    expect(all.length).toBeGreaterThan(0);

    const active = accessibilityFulfillmentService.getActiveRequests();
    expect(active.every((r) => r.currentStage !== "completed")).toBe(true);
  });

  it("creates a new accommodation request and logs initial timeline entry", () => {
    const newReq = accessibilityFulfillmentService.createRequest({
      studentId: "user-999",
      studentName: "Test Student",
      category: "mobility",
      accommodationType: "Portable Ramp",
      eventOrLocation: "Main Auditorium",
      buildingName: "Student Union",
      urgency: "high",
    });

    expect(newReq.id).toMatch(/^ACC-\d{4}$/);
    expect(newReq.currentStage).toBe("submitted");
    expect(newReq.timelineLogs.length).toBe(1);
    expect(newReq.timelineLogs[0].stage).toBe("submitted");

    const fetched = accessibilityFulfillmentService.getRequestById(newReq.id);
    expect(fetched).toBeDefined();
    expect(fetched?.accommodationType).toBe("Portable Ramp");
  });

  it("advances request stages sequentially through the 5 Domino's Pizza Tracker stages", () => {
    const newReq = accessibilityFulfillmentService.createRequest({
      studentId: "user-100",
      studentName: "Test Student 2",
      category: "auditory",
      accommodationType: "Live ASL Interpreter",
      eventOrLocation: "Lecture Hall A",
      buildingName: "Science Hall",
      urgency: "immediate",
    });

    // Stage 1: submitted -> Stage 2: triaged
    const stage2 = accessibilityFulfillmentService.advanceStage(newReq.id);
    expect(stage2?.currentStage).toBe("triaged");

    // Stage 2: triaged -> Stage 3: dispatched
    const stage3 = accessibilityFulfillmentService.advanceStage(newReq.id);
    expect(stage3?.currentStage).toBe("dispatched");

    // Stage 3: dispatched -> Stage 4: in_progress
    const stage4 = accessibilityFulfillmentService.advanceStage(newReq.id);
    expect(stage4?.currentStage).toBe("in_progress");

    // Stage 4: in_progress -> Stage 5: completed
    const stage5 = accessibilityFulfillmentService.advanceStage(newReq.id);
    expect(stage5?.currentStage).toBe("completed");
    expect(stage5?.status).toBe("completed");
    expect(stage5?.etaMinutes).toBe(0);
    expect(stage5?.completedAt).toBeDefined();
  });

  it("allows setting status and reporting delays", () => {
    const all = accessibilityFulfillmentService.getAllRequests();
    const req = all[0];
    const initialEta = req.etaMinutes;

    accessibilityFulfillmentService.setStatus(req.id, "delayed", "Heavy rain delay");
    
    const updated = accessibilityFulfillmentService.getRequestById(req.id);
    expect(updated?.status).toBe("delayed");
    expect(updated?.etaMinutes).toBe(initialEta + 5);
  });

  it("supports student rating & feedback submission", () => {
    const all = accessibilityFulfillmentService.getAllRequests();
    const req = all[0];

    const result = accessibilityFulfillmentService.submitFeedback(req.id, 5, "Outstanding service!");
    expect(result).toBe(true);

    const updated = accessibilityFulfillmentService.getRequestById(req.id);
    expect(updated?.studentFeedback?.rating).toBe(5);
    expect(updated?.studentFeedback?.comment).toBe("Outstanding service!");
  });

  it("computes overall metrics accurately", () => {
    const metrics = accessibilityFulfillmentService.getMetrics();
    expect(metrics.totalRequests).toBeGreaterThan(0);
    expect(metrics.satisfactionScore).toBeGreaterThanOrEqual(1.0);
    expect(metrics.satisfactionScore).toBeLessThanOrEqual(5.0);
    expect(metrics.onTimePercentage).toBeGreaterThan(0);
  });
});
