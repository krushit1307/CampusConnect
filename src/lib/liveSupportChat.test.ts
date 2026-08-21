import { describe, it, expect } from "vitest";
import {
  isSupportWindowActive,
  shouldTriggerBackupSmsFallback,
  SUPPORT_UNREAD_SMS_FALLBACK_MS,
} from "./liveSupportChat";

describe("Live Event Support Chat Widget (#3016)", () => {
  const startTime = "2026-08-14T14:00:00Z";
  const endTime = "2026-08-14T17:00:00Z";

  describe("Contextual Time Window Activation", () => {
    it("activates 1 hour prior to event start time", () => {
      const oneHourBeforeStart = new Date("2026-08-14T13:00:00Z");
      expect(isSupportWindowActive(startTime, endTime, oneHourBeforeStart)).toBe(true);
    });

    it("remains active during event execution", () => {
      const duringEvent = new Date("2026-08-14T15:30:00Z");
      expect(isSupportWindowActive(startTime, endTime, duringEvent)).toBe(true);
    });

    it("remains active 1 hour after event conclusion", () => {
      const oneHourAfterEnd = new Date("2026-08-14T18:00:00Z");
      expect(isSupportWindowActive(startTime, endTime, oneHourAfterEnd)).toBe(true);
    });

    it("deactivates 2 hours prior to start or 2 hours after conclusion", () => {
      const twoHoursBefore = new Date("2026-08-14T12:00:00Z");
      const twoHoursAfter = new Date("2026-08-14T19:00:00Z");

      expect(isSupportWindowActive(startTime, endTime, twoHoursBefore)).toBe(false);
      expect(isSupportWindowActive(startTime, endTime, twoHoursAfter)).toBe(false);
    });
  });

  describe("Offline Support Lead 2-Minute SMS Backup Fallback", () => {
    it("triggers backup SMS alert when message remains unread for 2 minutes (120,000ms)", () => {
      expect(shouldTriggerBackupSmsFallback(120000)).toBe(true);
      expect(shouldTriggerBackupSmsFallback(180000)).toBe(true);
    });

    it("does not trigger backup SMS alert for recent messages under 2 minutes", () => {
      expect(shouldTriggerBackupSmsFallback(30000)).toBe(false);
      expect(shouldTriggerBackupSmsFallback(90000)).toBe(false);
    });

    it("enforces 2-minute (120,000ms) fallback threshold constant", () => {
      expect(SUPPORT_UNREAD_SMS_FALLBACK_MS).toBe(120000);
    });
  });
});
