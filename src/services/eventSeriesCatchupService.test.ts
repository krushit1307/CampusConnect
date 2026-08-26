import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildCatchUpEmailContent,
  getUserSeriesCatchup,
  trackCatchupClick,
  triggerSeriesCatchupProcessing,
} from "@/services/eventSeriesCatchupService";

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      rpc: mockRpc,
    })),
  };
});

describe("eventSeriesCatchupService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildCatchUpEmailContent", () => {
    it("builds automated catch up notification with VOD and materials links", () => {
      const email = buildCatchUpEmailContent({
        eventTitle: "Python Week 1",
        nextEventTitle: "Python Week 2",
        recordingUrl: "https://campusconnect.app/vod/python-1",
        materialsUrl: "https://campusconnect.app/slides/python-1.pdf",
      });

      expect(email.subject).toContain("We missed you at Python Week 1!");
      expect(email.body).toContain("catch up before Python Week 2");
      expect(email.body).toContain("Watch Recording (VOD): https://campusconnect.app/vod/python-1");
      expect(email.body).toContain("Slide Deck & Materials: https://campusconnect.app/slides/python-1.pdf");
    });
  });

  describe("getUserSeriesCatchup", () => {
    it("fetches user series catchup row from Supabase", async () => {
      const mockCatchup = {
        id: "cup-1",
        series_id: "ser-1",
        missed_event_id: "evt-1",
        user_id: "usr-1",
        recording_url: "https://vod.com",
        materials_url: "https://slides.com",
        email_sent: true,
        vod_clicked: false,
        materials_clicked: false,
        created_at: "2026-08-23T12:00:00Z",
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockCatchup, error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        select: selectMock,
      } as any);

      const res = await getUserSeriesCatchup("evt-1");
      expect(mockFrom).toHaveBeenCalledWith("event_series_catchups");
      expect(res).toEqual(mockCatchup);
    });
  });

  describe("trackCatchupClick", () => {
    it("calls record_series_catchup_click RPC for VOD click", async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const res = await trackCatchupClick("cup-1", "vod");

      expect(mockRpc).toHaveBeenCalledWith("record_series_catchup_click", {
        p_catchup_id: "cup-1",
        p_link_type: "vod",
      });
      expect(res).toBe(true);
    });

    it("calls record_series_catchup_click RPC for materials click", async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const res = await trackCatchupClick("cup-1", "materials");

      expect(mockRpc).toHaveBeenCalledWith("record_series_catchup_click", {
        p_catchup_id: "cup-1",
        p_link_type: "materials",
      });
      expect(res).toBe(true);
    });
  });

  describe("triggerSeriesCatchupProcessing", () => {
    it("triggers process_series_no_show_catchups RPC", async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, catchups_generated: 4 },
        error: null,
      });

      const res = await triggerSeriesCatchupProcessing("evt-1");

      expect(mockRpc).toHaveBeenCalledWith("process_series_no_show_catchups", {
        p_event_id: "evt-1",
      });
      expect(res.success).toBe(true);
      expect(res.catchupsGenerated).toBe(4);
    });
  });
});
