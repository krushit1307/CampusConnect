import { describe, it, expect } from "vitest";
import {
  aggregateEventMetrics,
  buildAiSummaryPrompt,
  generateEventRecapDocument,
  RawEventMetricsInput,
} from "./eventRecapGenerator";

describe("Automated Event Recap Generator Suite (#3877)", () => {
  const sampleInput: RawEventMetricsInput = {
    eventId: "evt_hackathon_2026",
    eventTitle: "Annual Campus Hackathon",
    clubName: "Computer Science Society",
    totalRsvps: 200,
    actualCheckins: 160,
    pointsAwarded: 8000,
    budgetSpent: 1600.0,
    topPhotoUrls: [
      "https://storage.campusconnect.edu/photos/p1.jpg",
      "https://storage.campusconnect.edu/photos/p2.jpg",
      "https://storage.campusconnect.edu/photos/p3.jpg",
      "https://storage.campusconnect.edu/photos/p4.jpg", // 4th photo should be truncated to top 3
    ],
  };

  it("calculates turnout percentage, cost per attendee, and truncates photos to top 3", () => {
    const metrics = aggregateEventMetrics(sampleInput);

    expect(metrics.turnoutPercentage).toBe(80.0); // 160 / 200 = 80%
    expect(metrics.costPerAttendee).toBe(10.0); // $1600 / 160 = $10.00
    expect(metrics.topPhotoUrls.length).toBe(3);
  });

  it("builds prompt payload containing exact event metrics for LLM summary generation", () => {
    const metrics = aggregateEventMetrics(sampleInput);
    const prompt = buildAiSummaryPrompt(metrics);

    expect(prompt).toContain("Annual Campus Hackathon");
    expect(prompt).toContain("Computer Science Society");
    expect(prompt).toContain("80% Turnout Rate");
    expect(prompt).toContain("$1600.00");
  });

  it("constructs PDF document structure with executive summary and metrics grid", () => {
    const metrics = aggregateEventMetrics(sampleInput);
    const mockAiSummary = "Paragraph 1: Huge success.\nParagraph 2: Excellent ROI.";
    const doc = generateEventRecapDocument(metrics, mockAiSummary);

    expect(doc.pdfDocumentStructure.title).toContain("Annual Campus Hackathon");
    expect(doc.pdfDocumentStructure.metricsGrid.find((m) => m.label === "Total RSVPs")?.value).toBe(
      "200",
    );
    expect(doc.pdfDocumentStructure.sections[0].content).toBe(mockAiSummary);
    expect(doc.pdfDocumentStructure.photoGallery.length).toBe(3);
  });
});
