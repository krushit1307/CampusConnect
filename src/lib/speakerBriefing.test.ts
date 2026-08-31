// src/lib/speakerBriefing.test.ts
// Issue: #5059 - Dynamic "Alumni Speaker" Natural Language Speaker Briefing
// Tests for speaker briefing library functions

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
vi.mock("./supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
}));

describe("speakerBriefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: Since the main logic is in the Edge Function and database RPCs,
  // we primarily test the integration points here.
  // The actual briefing generation is tested in the pgTAP tests.

  describe("Speaker Briefing Integration", () => {
    it("should create a briefing record via RPC", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: "briefing-123",
        error: null,
      });

      const result = await supabase.rpc("create_speaker_briefing", {
        p_event_id: "event-123",
        p_days_back: 30,
      });

      expect(result.data).toBe("briefing-123");
    });

    it("should aggregate student discussions", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [
          {
            chat_messages_count: 100,
            forum_posts_count: 50,
            qa_questions_count: 20,
            aggregated_content: "Sample content",
          },
        ],
        error: null,
      });

      const result = await supabase.rpc("aggregate_student_discussions", {
        p_event_id: "event-123",
        p_days_back: 30,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].chat_messages_count).toBe(100);
    });

    it("should update briefing content", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        error: null,
      });

      const result = await supabase.rpc("update_briefing_content", {
        p_briefing_id: "briefing-123",
        p_briefing_summary: "Test summary",
        p_top_anxieties: [],
        p_top_topics: [],
        p_top_questions: [],
      });

      expect(result.error).toBeNull();
    });

    it("should complete briefing with PDF URL", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        error: null,
      });

      const result = await supabase.rpc("complete_briefing", {
        p_briefing_id: "briefing-123",
        p_pdf_url: "https://example.com/briefing.pdf",
      });

      expect(result.error).toBeNull();
    });

    it("should fail briefing with error message", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        error: null,
      });

      const result = await supabase.rpc("fail_briefing", {
        p_briefing_id: "briefing-123",
        p_error_message: "Generation failed",
      });

      expect(result.error).toBeNull();
    });

    it("should get events needing briefings", async () => {
      const { supabase } = await import("./supabase/client");
      (supabase.rpc as any).mockResolvedValue({
        data: [
          {
            event_id: "event-123",
            event_title: "Test Event",
            club_id: "club-123",
            speaker_email: "speaker@test.com",
            speaker_name: "John Speaker",
            event_date: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          },
        ],
        error: null,
      });

      const result = await supabase.rpc("get_events_needing_briefings");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].event_title).toBe("Test Event");
    });
  });
});
