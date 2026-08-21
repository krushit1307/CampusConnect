import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateDistanceMeters,
  isWithinGeoBoundary,
  generateClueQrPayload,
  queueOfflineScan,
  getQueuedScans,
  flushOfflineScans,
  submitClueScan,
  OFFLINE_QUEUE_KEY,
} from "./scavengerHuntEngine";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

const mockRpc = vi.fn();

vi.mock("./supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

describe("Scavenger Hunt Engine (#2801)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Geographic Distance Calculations", () => {
    const lat1 = 18.5204;
    const lng1 = 73.8567;

    it("calculates exact distance between two points", () => {
      // 10 meters away
      const lat2 = 18.52048;
      const lng2 = 73.8567;
      const dist = calculateDistanceMeters(lat1, lng1, lat2, lng2);

      expect(dist).toBeGreaterThan(5);
      expect(dist).toBeLessThan(15);
    });

    it("evaluates geo boundary accurately", () => {
      // 10m away -> within 50m
      expect(isWithinGeoBoundary(lat1, lng1, 18.52048, 73.8567, 50)).toBe(true);

      // 200m away -> outside 50m
      expect(isWithinGeoBoundary(lat1, lng1, 18.523, 73.8567, 50)).toBe(false);
    });
  });

  describe("QR Code Generation", () => {
    it("generates consistent standardized QR payload", () => {
      const payload = generateClueQrPayload("hunt-12345678", 2);
      expect(payload).toBe("CAMPUSHUNT:hunt-12345678:STEP_2:campus_hunt_hunt-123_step_2");
    });
  });

  describe("Offline Queue & Sync", () => {
    it("stores scans in offline queue when disconnected", () => {
      queueOfflineScan({
        hunt_id: "hunt-1",
        user_id: "user-1",
        qr_payload: "CAMPUSHUNT:hunt-1:STEP_1:xyz",
        timestamp: Date.now(),
      });

      const queue = getQueuedScans();
      expect(queue).toHaveLength(1);
      expect(queue[0].hunt_id).toBe("hunt-1");
    });

    it("flushes offline queue when network becomes available", async () => {
      window.localStorage.setItem(
        OFFLINE_QUEUE_KEY,
        JSON.stringify([
          {
            hunt_id: "hunt-1",
            user_id: "user-1",
            qr_payload: "CODE-1",
            timestamp: Date.now(),
          },
        ]),
      );

      mockRpc.mockResolvedValueOnce({
        data: [{ success: true, message: "Valid", new_clue_order: 2, total_score: 100 }],
        error: null,
      });

      const processed = await flushOfflineScans();
      expect(processed).toBe(1);
      expect(getQueuedScans()).toHaveLength(0);
    });

    it("queues scan automatically on network error during submission", async () => {
      mockRpc.mockRejectedValueOnce(new Error("Failed to fetch"));

      const res = await submitClueScan("hunt-2", "user-2", "CODE-FAIL");
      expect(res.success).toBe(false);
      expect(res.message).toContain("Offline mode");

      const queue = getQueuedScans();
      expect(queue.some((s) => s.qr_payload === "CODE-FAIL")).toBe(true);
    });
  });
});
