import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  aggregateEventMetrics,
  buildAiSummaryPrompt,
  generateEventRecapDocument,
  generateEventRecap,
  publishRecapToClubFeed,
  MIN_ATTENDANCE_THRESHOLD,
  RawEventMetricsInput,
} from "./eventRecapGenerator";

// Mock Supabase client for main branch suite
const mockInvoke = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    functions: {
      invoke: mockInvoke,
    },
    from: (table: string) => {
      if (table === "articles") {
        return {
          insert: mockInsert,
        };
      }
      if (table === "events") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "ev-1", title: "Robotics Expo", clubs: { name: "Robotics Club" } },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "event_rsvps") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
          }),
        };
      }
      return {};
    },
  }),
}));

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
    expect(
      doc.pdfDocumentStructure.metricsGrid.find((m) => m.label === "Total RSVPs")?.value,
    ).toBe("200");
    expect(doc.pdfDocumentStructure.sections[0].content).toBe(mockAiSummary);
    expect(doc.pdfDocumentStructure.photoGallery.length).toBe(3);
  });
});

describe("Event Recap Generator (#2804)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully invokes Edge function and returns recap markdown", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        success: true,
        recapMarkdown: "# Recap: Great Event!",
        heroPhotos: ["https://example.com/p1.jpg"],
        attendanceCount: 15,
        clubId: "club-1",
        eventTitle: "Robotics Expo",
      },
      error: null,
    });

    const res = await generateEventRecap("ev-1", "hype");

    expect(res.success).toBe(true);
    expect(res.recapMarkdown).toBe("# Recap: Great Event!");
    expect(res.attendanceCount).toBe(15);
    expect(res.heroPhotos).toHaveLength(1);
  });

  it("handles DATA_SCARCITY error gracefully", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        error: "DATA_SCARCITY",
        message: "Insufficient event attendance",
      },
      error: null,
    });

    const res = await generateEventRecap("ev-sparse", "professional");
    expect(res.success).toBe(false);
    expect(res.isDataScarcity).toBe(true);
    expect(res.error).toContain("Insufficient");
  });

  it("enforces minimum attendance threshold constant", () => {
    expect(MIN_ATTENDANCE_THRESHOLD).toBe(3);
  });

  it("publishes generated recap with hero images to articles table", async () => {
    const res = await publishRecapToClubFeed(
      "club-123",
      "AI Recap Article",
      "## Great Night",
      ["https://example.com/photo.jpg"],
      "user-1",
    );

    expect(res.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        club_id: "club-123",
        author_id: "user-1",
        title: "AI Recap Article",
        content: expect.stringContaining("![Event Photo](https://example.com/photo.jpg)"),
      }),
    );
  });
});