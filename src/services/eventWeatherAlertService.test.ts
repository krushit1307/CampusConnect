import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSevereWeatherCondition,
  buildWeatherWarningMessage,
  getEventWeatherAlerts,
} from "@/services/eventWeatherAlertService";

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

describe("eventWeatherAlertService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isSevereWeatherCondition", () => {
    it("identifies thunderstorm as critical severe weather", () => {
      const res = isSevereWeatherCondition("Thunderstorm with heavy rain", 0.8, 22);
      expect(res.isSevere).toBe(true);
      expect(res.severity).toBe("critical");
      expect(res.alertLabel).toContain("Thunderstorm");
    });

    it("identifies tornado as critical severe weather", () => {
      const res = isSevereWeatherCondition("Tornado warning in area", 0.5, 20);
      expect(res.isSevere).toBe(true);
      expect(res.severity).toBe("critical");
      expect(res.alertLabel).toContain("Tornado");
    });

    it("identifies heavy rain above 60% probability as severe", () => {
      const res = isSevereWeatherCondition("Moderate Rain", 0.75, 18);
      expect(res.isSevere).toBe(true);
      expect(res.severity).toBe("warning");
      expect(res.alertLabel).toContain("Heavy Rain");
    });

    it("identifies extreme heat above 35C as severe", () => {
      const res = isSevereWeatherCondition("Clear sky", 0, 38);
      expect(res.isSevere).toBe(true);
      expect(res.severity).toBe("warning");
      expect(res.alertLabel).toContain("Extreme Heat");
    });

    it("identifies mild clear weather as normal", () => {
      const res = isSevereWeatherCondition("Partly Cloudy", 0.2, 22);
      expect(res.isSevere).toBe(false);
      expect(res.severity).toBe("none");
    });
  });

  describe("buildWeatherWarningMessage", () => {
    it("formats message with critical alert label and instant cancellation/venue change link", () => {
      const msg = buildWeatherWarningMessage(
        "Spring BBQ",
        "Severe Thunderstorm Warning",
        "/events/evt-123?action=find-indoor-backup",
      );

      expect(msg).toContain("CRITICAL: Severe weather (Severe Thunderstorm Warning) detected during your \"Spring BBQ\"");
      expect(msg).toContain("Click here to instantly notify attendees of cancellation or a venue change");
      expect(msg).toContain("/events/evt-123?action=find-indoor-backup");
    });
  });

  describe("getEventWeatherAlerts", () => {
    it("fetches event weather alerts from database", async () => {
      const mockAlerts = [
        {
          id: "alert-1",
          event_id: "evt-123",
          organizer_id: "user-1",
          forecast_time: "2026-08-24T18:00:00Z",
          condition: "heavy_rain",
          precipitation_probability: 0.85,
          indoor_backup_url: "/backup",
          created_at: "2026-08-23T12:00:00Z",
        },
      ];

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockAlerts, error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        select: selectMock,
      } as any);

      const res = await getEventWeatherAlerts("evt-123");
      expect(mockFrom).toHaveBeenCalledWith("event_weather_alerts");
      expect(res).toEqual(mockAlerts);
    });
  });
});
