import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildFeedbackSummaryPrompt,
  parseFeedbackLlmResponse,
  getExistingFeedbackSummary,
  generateFeedbackSummary,
} from "@/services/eventFeedbackSummaryService";

const { mockFrom, mockFunctionsInvoke } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      functions: {
        invoke: mockFunctionsInvoke,
      },
    })),
  };
});

describe("eventFeedbackSummaryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildFeedbackSummaryPrompt", () => {
    it("constructs consultant prompt containing top 3 positives and top 3 improvements instructions", () => {
      const reviews = [
        "The workshop was amazing and the speakers were super clear.",
        "The room was freezing and pizza arrived 30 minutes late.",
        "Loved the hands-on coding demos!",
      ];

      const prompt = buildFeedbackSummaryPrompt("AI Workshop", "Tech Club", reviews);

      expect(prompt).toContain('You are an event management consultant');
      expect(prompt).toContain('3 student reviews');
      expect(prompt).toContain('"AI Workshop"');
      expect(prompt).toContain('"Tech Club"');
      expect(prompt).toContain('Top 3 things the club did well');
      expect(prompt).toContain('Top 3 things they must improve next time');
      expect(prompt).toContain('The room was freezing');
    });
  });

  describe("parseFeedbackLlmResponse", () => {
    it("parses valid JSON response into structured top positives and improvements", () => {
      const jsonResponse = JSON.stringify({
        top_positives: [
          "Interactive hands-on demonstrations.",
          "High speaker clarity and preparedness.",
          "Engaging Q&A session.",
        ],
        top_improvements: [
          "Improve room temperature management.",
          "Provide slides in advance.",
          "Streamline check-in queue.",
        ],
        executive_summary_markdown: "## Executive Summary\n\nGreat overall session.",
      });

      const parsed = parseFeedbackLlmResponse(jsonResponse, "AI Workshop", 15);

      expect(parsed.topPositives).toHaveLength(3);
      expect(parsed.topPositives[0]).toContain("Interactive hands-on demonstrations");
      expect(parsed.topImprovements).toHaveLength(3);
      expect(parsed.topImprovements[0]).toContain("room temperature management");
      expect(parsed.executiveMarkdown).toContain("## Executive Summary");
    });

    it("handles fallback gracefully when receiving unstructured raw text", () => {
      const parsed = parseFeedbackLlmResponse("Raw markdown text from LLM", "Robotics Meet", 5);

      expect(parsed.executiveMarkdown).toBe("Raw markdown text from LLM");
      expect(parsed.topPositives).toHaveLength(3);
      expect(parsed.topImprovements).toHaveLength(3);
    });
  });

  describe("getExistingFeedbackSummary", () => {
    it("retrieves stored feedback summary from supabase", async () => {
      const mockSummary = {
        id: "sum-123",
        event_id: "evt-123",
        executive_summary_markdown: "## Summary",
        top_positives: ["Great food"],
        top_improvements: ["Better audio"],
        review_count: 10,
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockSummary, error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        select: selectMock,
      } as any);

      const result = await getExistingFeedbackSummary("evt-123");

      expect(mockFrom).toHaveBeenCalledWith("event_feedback_summaries");
      expect(result).toEqual(mockSummary);
    });
  });

  describe("generateFeedbackSummary", () => {
    it("invokes summarize-event-feedback edge function and returns summary", async () => {
      const mockResult = {
        success: true,
        summary: {
          event_id: "evt-456",
          executive_summary_markdown: "## Executive Summary",
          top_positives: ["Praise 1", "Praise 2", "Praise 3"],
          top_improvements: ["Fix 1", "Fix 2", "Fix 3"],
          review_count: 20,
        },
      };

      mockFunctionsInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      } as any);

      const res = await generateFeedbackSummary("evt-456");

      expect(mockFunctionsInvoke).toHaveBeenCalledWith("summarize-event-feedback", {
        body: { eventId: "evt-456" },
      });
      expect(res.success).toBe(true);
      expect(res.summary?.top_positives).toHaveLength(3);
    });

    it("handles DATA_SCARCITY error properly", async () => {
      mockFunctionsInvoke.mockResolvedValue({
        data: {
          error: "DATA_SCARCITY",
          message: "Insufficient survey responses.",
        },
        error: null,
      } as any);

      const res = await generateFeedbackSummary("evt-empty");

      expect(res.success).toBe(false);
      expect(res.isDataScarcity).toBe(true);
      expect(res.message).toContain("Insufficient survey responses");
    });
  });
});
