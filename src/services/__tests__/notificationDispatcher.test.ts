import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dispatchNotification,
  isWithinDNDWindow,
  isEmergencyOrUrgent,
  parseTimeToMinutes,
  calculateNextDNDEndTime,
  defaultInMemoryQueue,
  type PushNotificationPayload,
  type UserNotificationPreferences,
} from "../notificationDispatcher";

describe("Notification Dispatcher (#3450)", () => {
  beforeEach(() => {
    defaultInMemoryQueue.clear();
    vi.restoreAllMocks();
  });

  describe("isEmergencyOrUrgent", () => {
    it("identifies emergency or urgent priority alerts", () => {
      expect(isEmergencyOrUrgent("emergency")).toBe(true);
      expect(isEmergencyOrUrgent("urgent")).toBe(true);
      expect(isEmergencyOrUrgent("normal", "emergency_broadcast")).toBe(true);
      expect(isEmergencyOrUrgent("normal", "emergency_roll_call")).toBe(true);
    });

    it("identifies standard non-urgent notifications", () => {
      expect(isEmergencyOrUrgent("normal")).toBe(false);
      expect(isEmergencyOrUrgent("low")).toBe(false);
      expect(isEmergencyOrUrgent(undefined, "event_invite")).toBe(false);
    });
  });

  describe("parseTimeToMinutes", () => {
    it("parses valid HH:mm and HH:mm:ss strings into minutes past midnight", () => {
      expect(parseTimeToMinutes("00:00")).toBe(0);
      expect(parseTimeToMinutes("08:30")).toBe(8 * 60 + 30);
      expect(parseTimeToMinutes("22:00")).toBe(22 * 60);
      expect(parseTimeToMinutes("23:59:59")).toBe(23 * 60 + 59);
    });

    it("returns null for invalid time strings", () => {
      expect(parseTimeToMinutes(null)).toBeNull();
      expect(parseTimeToMinutes(undefined)).toBeNull();
      expect(parseTimeToMinutes("invalid")).toBeNull();
      expect(parseTimeToMinutes("25:00")).toBeNull();
    });
  });

  describe("isWithinDNDWindow", () => {
    it("detects overnight quiet hours window (22:00 to 08:00)", () => {
      // 3:00 AM UTC
      const at3AM = new Date("2026-08-20T03:00:00Z");
      expect(isWithinDNDWindow("22:00", "08:00", "UTC", at3AM)).toBe(true);

      // 11:00 PM (23:00) UTC
      const at11PM = new Date("2026-08-20T23:00:00Z");
      expect(isWithinDNDWindow("22:00", "08:00", "UTC", at11PM)).toBe(true);

      // 2:00 PM (14:00) UTC
      const at2PM = new Date("2026-08-20T14:00:00Z");
      expect(isWithinDNDWindow("22:00", "08:00", "UTC", at2PM)).toBe(false);
    });

    it("detects intra-day quiet hours window (01:00 to 07:00)", () => {
      const at4AM = new Date("2026-08-20T04:00:00Z");
      expect(isWithinDNDWindow("01:00", "07:00", "UTC", at4AM)).toBe(true);

      const at9AM = new Date("2026-08-20T09:00:00Z");
      expect(isWithinDNDWindow("01:00", "07:00", "UTC", at9AM)).toBe(false);
    });

    it("returns false if DND start or end is missing", () => {
      const at3AM = new Date("2026-08-20T03:00:00Z");
      expect(isWithinDNDWindow(null, "08:00", "UTC", at3AM)).toBe(false);
      expect(isWithinDNDWindow("22:00", null, "UTC", at3AM)).toBe(false);
    });
  });

  describe("calculateNextDNDEndTime", () => {
    it("calculates the target Date when DND quiet hours end", () => {
      const at3AM = new Date("2026-08-20T03:00:00Z");
      const target = calculateNextDNDEndTime("08:00", "UTC", at3AM);
      expect(target).toBeInstanceOf(Date);
      expect(target.getTime()).toBeGreaterThan(at3AM.getTime());
    });
  });

  describe("dispatchNotification flow", () => {
    const userPrefs: UserNotificationPreferences = {
      user_id: "user-123",
      push_notifications: true,
      dnd_start_time: "22:00",
      dnd_end_time: "08:00",
      timezone: "UTC",
    };

    it("skips dispatch if user has disabled push notifications", async () => {
      const disabledPrefs: UserNotificationPreferences = {
        ...userPrefs,
        push_notifications: false,
      };
      const payload: PushNotificationPayload = {
        title: "Test Event",
        body: "Join us today!",
        user_id: "user-123",
      };

      const result = await dispatchNotification(payload, disabledPrefs);
      expect(result.status).toBe("skipped");
      expect(result.reason).toContain("disabled push notifications");
    });

    it("bypasses DND and dispatches immediately for Emergency / Urgent alerts at 3:00 AM", async () => {
      const at3AM = new Date("2026-08-20T03:00:00Z");
      const pushSender = vi.fn().mockResolvedValue(true);

      const emergencyPayload: PushNotificationPayload = {
        title: "EMERGENCY CAMPUS BROADCAST",
        body: "Severe weather warning. Take shelter immediately.",
        user_id: "user-123",
        priority: "emergency",
        type: "emergency_broadcast",
      };

      const result = await dispatchNotification(
        emergencyPayload,
        userPrefs,
        defaultInMemoryQueue,
        pushSender,
        at3AM,
      );

      expect(result.status).toBe("sent");
      expect(result.reason).toContain("Emergency alert successfully bypassed DND");
      expect(pushSender).toHaveBeenCalledTimes(1);
      expect(pushSender).toHaveBeenCalledWith(emergencyPayload);
      expect(defaultInMemoryQueue.getJobs("delayed_push_notifications")).toHaveLength(0);
    });

    it("delays standard non-urgent notification to Redis delayed queue when sent at 3:00 AM in DND window", async () => {
      const at3AM = new Date("2026-08-20T03:00:00Z");
      const pushSender = vi.fn().mockResolvedValue(true);

      const normalPayload: PushNotificationPayload = {
        id: "notif-456",
        title: "New Event Published",
        body: "Chess Club annual tournament invite!",
        user_id: "user-123",
        priority: "normal",
      };

      const result = await dispatchNotification(
        normalPayload,
        userPrefs,
        defaultInMemoryQueue,
        pushSender,
        at3AM,
      );

      expect(result.status).toBe("queued");
      expect(result.reason).toContain("Notification delayed to execute at");
      expect(pushSender).not.toHaveBeenCalled();

      const queuedJobs = defaultInMemoryQueue.getJobs("delayed_push_notifications");
      expect(queuedJobs).toHaveLength(1);

      const jobData = JSON.parse(queuedJobs[0].member);
      expect(jobData.user_id).toBe("user-123");
      expect(jobData.payload.title).toBe("New Event Published");
      expect(jobData.execute_at_timestamp).toBeGreaterThan(at3AM.getTime());
    });

    it("dispatches standard non-urgent notification immediately when sent outside DND window (2:00 PM)", async () => {
      const at2PM = new Date("2026-08-20T14:00:00Z");
      const pushSender = vi.fn().mockResolvedValue(true);

      const normalPayload: PushNotificationPayload = {
        id: "notif-789",
        title: "Robotics Club Workshop",
        body: "Starts in 1 hour!",
        user_id: "user-123",
        priority: "normal",
      };

      const result = await dispatchNotification(
        normalPayload,
        userPrefs,
        defaultInMemoryQueue,
        pushSender,
        at2PM,
      );

      expect(result.status).toBe("sent");
      expect(result.reason).toContain("Dispatched push notification immediately");
      expect(pushSender).toHaveBeenCalledTimes(1);
      expect(defaultInMemoryQueue.getJobs("delayed_push_notifications")).toHaveLength(0);
    });
  });
});
