// src/services/__tests__/safetyEscortService.test.ts
import { describe, it, expect, vi } from "vitest";
import { isLateNightEvent, requestSafetyEscort } from "../safetyEscortService";

const mockRpc = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

describe("safetyEscortService", () => {
  describe("isLateNightEvent", () => {
    it("returns true for 10:00 PM (22:00)", () => {
      const date = new Date("2026-10-28T22:00:00");
      expect(isLateNightEvent(date)).toBe(true);
    });

    it("returns true for 2:00 AM (02:00)", () => {
      const date = new Date("2026-10-29T02:00:00");
      expect(isLateNightEvent(date)).toBe(true);
    });

    it("returns false for 2:00 PM (14:00)", () => {
      const date = new Date("2026-10-28T14:00:00");
      expect(isLateNightEvent(date)).toBe(false);
    });

    it("evaluates string timestamps like '11:30 PM'", () => {
      expect(isLateNightEvent("Friday, Oct 28 @ 11:30 PM")).toBe(true);
    });
  });

  describe("requestSafetyEscort", () => {
    it("invokes request_safety_escort RPC with parameters", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          request_id: "req-100",
          status: "dispatch_assigned",
          message: "Dispatch assigned",
        },
        error: null,
      });

      const res = await requestSafetyEscort({
        requestType: "campus_security",
        currentLocation: "Library Quad",
        destinationDorm: "North Dorm B",
        latitude: 40.7128,
        longitude: -74.006,
      });

      expect(mockRpc).toHaveBeenCalledWith("request_safety_escort", {
        p_event_id: null,
        p_request_type: "campus_security",
        p_current_location: "Library Quad",
        p_destination_dorm: "North Dorm B",
        p_latitude: 40.7128,
        p_longitude: -74.006,
      });
      expect(res.success).toBe(true);
      expect(res.request_id).toBe("req-100");
    });
  });
});
