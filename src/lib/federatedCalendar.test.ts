import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getUnifiedCalendar,
  toggleEventFederation,
  getFederationStats,
} from "./federatedCalendar";

// Mock supabase
vi.mock("./supabase", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    functions: {
      invoke: vi.fn(() =>
        Promise.resolve({ data: { events: [], local_count: 0, remote_count: 0, total_count: 0 }, error: null })
      ),
    },
  },
}));

describe("federatedCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUnifiedCalendar", () => {
    it("should return empty results on error", async () => {
      const { supabase } = await import("./supabase");
      (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: "Network error" },
      });

      const result = await getUnifiedCalendar();
      expect(result.events).toEqual([]);
      expect(result.total_count).toBe(0);
    });

    it("should pass date range parameters", async () => {
      const { supabase } = await import("./supabase");
      const mockInvoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;
      mockInvoke.mockResolvedValue({
        data: { events: [], local_count: 0, remote_count: 0, total_count: 0 },
        error: null,
      });

      await getUnifiedCalendar({
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        includeRemote: false,
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        expect.stringContaining("start_date=2026-09-01"),
        expect.any(Object)
      );
    });
  });

  describe("toggleEventFederation", () => {
    it("should return error on failure", async () => {
      const { supabase } = await import("./supabase");
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: "Permission denied" },
      });

      const result = await toggleEventFederation("event-1", true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Permission denied");
    });

    it("should return success on valid toggle", async () => {
      const { supabase } = await import("./supabase");
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, is_federated_public: true, message: "Event will be broadcast" },
        error: null,
      });

      const result = await toggleEventFederation("event-1", true);
      expect(result.success).toBe(true);
      expect(result.is_federated_public).toBe(true);
    });
  });

  describe("getFederationStats", () => {
    it("should return null on error", async () => {
      const { supabase } = await import("./supabase");
      (supabase.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      });

      const result = await getFederationStats();
      expect(result).toBeNull();
    });
  });
});
