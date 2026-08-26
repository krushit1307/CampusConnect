import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isDyingBattery,
  isDeviceOffline,
  getHardwareBatteryInfo,
  getPingLatencyMs,
  sendKioskTelemetry,
  OFFLINE_THRESHOLD_MS,
} from "../kioskTelemetry";

describe("Kiosk Telemetry Service (#3455)", () => {
  describe("isDyingBattery", () => {
    it("identifies dying battery when level is below 15% and device is NOT charging", () => {
      expect(isDyingBattery(14, false)).toBe(true);
      expect(isDyingBattery(12, false)).toBe(true);
      expect(isDyingBattery(5, false)).toBe(true);
    });

    it("does NOT flag dying battery if device is currently charging", () => {
      expect(isDyingBattery(12, true)).toBe(false);
      expect(isDyingBattery(5, true)).toBe(false);
    });

    it("does NOT flag dying battery if battery level is 15% or above", () => {
      expect(isDyingBattery(15, false)).toBe(false);
      expect(isDyingBattery(80, false)).toBe(false);
      expect(isDyingBattery(100, false)).toBe(false);
    });
  });

  describe("isDeviceOffline", () => {
    it("marks device as offline if last seen timestamp is older than 3 minutes (180,000 ms)", () => {
      const now = new Date("2026-08-20T12:00:00Z");
      const fourMinutesAgo = new Date("2026-08-20T11:56:00Z"); // 4 mins ago
      const tenMinutesAgo = new Date("2026-08-20T11:50:00Z"); // 10 mins ago

      expect(isDeviceOffline(fourMinutesAgo, now)).toBe(true);
      expect(isDeviceOffline(tenMinutesAgo, now)).toBe(true);
      expect(isDeviceOffline(fourMinutesAgo.toISOString(), now)).toBe(true);
    });

    it("marks device as online if last seen is within 3 minutes", () => {
      const now = new Date("2026-08-20T12:00:00Z");
      const oneMinuteAgo = new Date("2026-08-20T11:59:00Z");
      const twoMinutesAgo = new Date("2026-08-20T11:58:00Z");

      expect(isDeviceOffline(oneMinuteAgo, now)).toBe(false);
      expect(isDeviceOffline(twoMinutesAgo, now)).toBe(false);
    });

    it("handles invalid dates gracefully as offline", () => {
      expect(isDeviceOffline("invalid-date-string")).toBe(true);
    });
  });

  describe("getHardwareBatteryInfo", () => {
    it("returns battery level and charging status safely with fallback", async () => {
      const result = await getHardwareBatteryInfo();
      expect(result).toHaveProperty("level");
      expect(result).toHaveProperty("isCharging");
      expect(typeof result.level).toBe("number");
      expect(typeof result.isCharging).toBe("boolean");
    });
  });

  describe("sendKioskTelemetry", () => {
    it("constructs valid telemetry payload for Door 4 iPad", async () => {
      const payload = await sendKioskTelemetry("Door 4", "event-gala-123", {
        battery_level: 12,
        is_charging: false,
        ping_ms: 45,
      });

      expect(payload).not.toBeNull();
      expect(payload?.device_id).toBe("Door 4");
      expect(payload?.event_id).toBe("event-gala-123");
      expect(payload?.battery_level).toBe(12);
      expect(payload?.is_charging).toBe(false);
      expect(payload?.ping_ms).toBe(45);
      expect(payload?.last_seen).toBeDefined();
    });
  });
});
