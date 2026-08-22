import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isDecibelViolation,
  processIoTNoiseAlert,
  getEventNoiseViolations,
  DECIBEL_THRESHOLD,
  DURATION_THRESHOLD_MINS,
} from "../noiseViolationService";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe("Real-Time Decibel/Noise Violation Service (#3684)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isDecibelViolation", () => {
    it("identifies noise violation when decibels > 90 for sustained >= 5 minutes", () => {
      expect(isDecibelViolation(94, 5)).toBe(true);
      expect(isDecibelViolation(98, 10)).toBe(true);
      expect(isDecibelViolation(91, 5)).toBe(true);
    });

    it("returns false if decibels is at or below 90dB", () => {
      expect(isDecibelViolation(90, 5)).toBe(false);
      expect(isDecibelViolation(85, 10)).toBe(false);
    });

    it("returns false if sustained duration is less than 5 minutes", () => {
      expect(isDecibelViolation(95, 4)).toBe(false);
      expect(isDecibelViolation(95, 2)).toBe(false);
    });
  });

  describe("processIoTNoiseAlert", () => {
    it("ignores noise telemetry within legal thresholds", async () => {
      const result = await processIoTNoiseAlert("venue-union", "Union Hall", 85, 3);
      expect(result.violation).toBe(false);
    });

    it("processes IoT decibel violation, logs record for liability, and formats warning message", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "events") {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "event-concert-1",
                        title: "Campus Rock Concert",
                        location: "Union Hall",
                      },
                    ],
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "noise_violation_logs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [], // First warning
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "log-1",
                    event_id: "event-concert-1",
                    venue_id: "venue-union",
                    venue_name: "Union Hall",
                    decibels: 94,
                    duration_minutes: 5,
                    warning_level: "WARNING",
                    warning_count: 1,
                    alert_message:
                      "WARNING: Noise levels have exceeded 94dB for 5 minutes (Warning #1). Lower the volume immediately to avoid security intervention.",
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await processIoTNoiseAlert("venue-union", "Union Hall", 94, 5);

      expect(result.violation).toBe(true);
      expect(result.alertMessage).toContain("Noise levels have exceeded 94dB for 5 minutes");
      expect(result.alertMessage).toContain(
        "Lower the volume immediately to avoid security intervention",
      );
      expect(result.logData?.warning_count).toBe(1);
    });
  });
});
