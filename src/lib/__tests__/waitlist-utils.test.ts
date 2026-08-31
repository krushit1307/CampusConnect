/**
 * Waitlist Utility Functions - Tests
 *
 * Unit tests for waitlist utility functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getNextWaitlistPosition,
  getUserWaitlistPosition,
  isEventAtCapacity,
  isWaitlistFull,
  formatWaitlistPosition,
  estimateWaitTime,
  calculateWaitlistStats,
  shouldNotifyPositionChange,
  createWaitlistNotification,
  validateWaitlistEntry,
  formatWaitDuration,
  calculatePromotionExpiration,
  isPromotionExpired,
  sortByPosition,
  sortByJoinTime,
  getActiveEntries,
  generateWaitlistSummary,
} from "../waitlist-utils";
import type { WaitlistEntry } from "@/types/waitlist";
import { NOTIFICATION_POSITIONS } from "@/types/waitlist";

function createMockEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: `entry-${Math.random().toString(36).slice(2)}`,
    event_id: "event-1",
    user_id: `user-${Math.random().toString(36).slice(2)}`,
    position: 1,
    status: "waiting",
    joined_at: new Date().toISOString(),
    promoted_at: null,
    expires_at: null,
    notify_on_promotion: true,
    notify_on_position_change: true,
    message: null,
    ...overrides,
  };
}

describe("getNextWaitlistPosition", () => {
  it("returns 1 for empty entries", () => {
    expect(getNextWaitlistPosition([])).toBe(1);
  });

  it("returns next position after max", () => {
    const entries = [
      createMockEntry({ position: 1 }),
      createMockEntry({ position: 3 }),
      createMockEntry({ position: 2 }),
    ];
    expect(getNextWaitlistPosition(entries)).toBe(4);
  });
});

describe("getUserWaitlistPosition", () => {
  it("returns correct position for user", () => {
    const entries = [
      createMockEntry({ id: "a", joined_at: "2024-01-01T00:00:00Z", status: "waiting" }),
      createMockEntry({ id: "b", joined_at: "2024-01-02T00:00:00Z", status: "waiting" }),
      createMockEntry({ id: "c", joined_at: "2024-01-03T00:00:00Z", status: "waiting" }),
    ];
    expect(getUserWaitlistPosition(entries[1], entries)).toBe(2);
  });

  it("excludes cancelled entries", () => {
    const entries = [
      createMockEntry({ id: "a", joined_at: "2024-01-01T00:00:00Z", status: "cancelled" }),
      createMockEntry({ id: "b", joined_at: "2024-01-02T00:00:00Z", status: "waiting" }),
    ];
    expect(getUserWaitlistPosition(entries[1], entries)).toBe(1);
  });
});

describe("isEventAtCapacity", () => {
  it("returns false when maxAttendees is null", () => {
    expect(isEventAtCapacity(100, null)).toBe(false);
  });

  it("returns false when below capacity", () => {
    expect(isEventAtCapacity(50, 100)).toBe(false);
  });

  it("returns true when at capacity", () => {
    expect(isEventAtCapacity(100, 100)).toBe(true);
  });

  it("returns true when over capacity", () => {
    expect(isEventAtCapacity(105, 100)).toBe(true);
  });
});

describe("isWaitlistFull", () => {
  it("returns false when under limit", () => {
    expect(isWaitlistFull(5, { max_waitlist_size: 50, promotion_window_minutes: 60, enabled: true, auto_promote: true }));
  });

  it("returns true when at limit", () => {
    expect(isWaitlistFull(50, { max_waitlist_size: 50, promotion_window_minutes: 60, enabled: true, auto_promote: true })).toBe(true);
  });
});

describe("formatWaitlistPosition", () => {
  it("formats ordinal positions correctly", () => {
    expect(formatWaitlistPosition(1)).toBe("1st");
    expect(formatWaitlistPosition(2)).toBe("2nd");
    expect(formatWaitlistPosition(3)).toBe("3rd");
    expect(formatWaitlistPosition(4)).toBe("4th");
    expect(formatWaitlistPosition(11)).toBe("11th");
    expect(formatWaitlistPosition(12)).toBe("12th");
    expect(formatWaitlistPosition(13)).toBe("13th");
    expect(formatWaitlistPosition(21)).toBe("21st");
    expect(formatWaitlistPosition(22)).toBe("22nd");
    expect(formatWaitlistPosition(23)).toBe("23rd");
  });

  it("returns empty for non-positive", () => {
    expect(formatWaitlistPosition(0)).toBe("");
    expect(formatWaitlistPosition(-1)).toBe("");
  });
});

describe("estimateWaitTime", () => {
  it("returns null for insufficient data", () => {
    expect(estimateWaitTime([], 1)).toBeNull();
  });

  it("estimates based on average", () => {
    const entries = [
      createMockEntry({
        status: "promoted",
        joined_at: "2024-01-01T00:00:00Z",
        promoted_at: "2024-01-01T01:00:00Z", // 60 min wait
      }),
      createMockEntry({
        status: "promoted",
        joined_at: "2024-01-02T00:00:00Z",
        promoted_at: "2024-01-02T02:00:00Z", // 120 min wait
      }),
    ];
    // avg = 90 min, position 1 = 90
    expect(estimateWaitTime(entries, 1)).toBe(90);
  });
});

describe("shouldNotifyPositionChange", () => {
  it("notifies on first time", () => {
    expect(shouldNotifyPositionChange(5, null)).toBe(true);
  });

  it("notifies at milestone positions", () => {
    for (const pos of NOTIFICATION_POSITIONS) {
      expect(shouldNotifyPositionChange(pos, pos + 10)).toBe(true);
    }
  });

  it("notifies on large jumps", () => {
    expect(shouldNotifyPositionChange(1, 10)).toBe(true);
  });

  it("does not notify on same position", () => {
    expect(shouldNotifyPositionChange(5, 5)).toBe(false);
  });
});

describe("createWaitlistNotification", () => {
  it("creates basic notification", () => {
    const notification = createWaitlistNotification(
      "promoted",
      "user-1",
      "event-1",
      "Test Event",
    );
    expect(notification.type).toBe("promoted");
    expect(notification.user_id).toBe("user-1");
    expect(notification.event_id).toBe("event-1");
    expect(notification.event_title).toBe("Test Event");
  });
});

describe("validateWaitlistEntry", () => {
  it("returns null for valid input", () => {
    expect(validateWaitlistEntry("event-1", "user-1")).toBeNull();
  });

  it("returns error for invalid event ID", () => {
    expect(validateWaitlistEntry("", "user-1")).toBe("Invalid event ID");
  });

  it("returns error for invalid user ID", () => {
    expect(validateWaitlistEntry("event-1", "")).toBe("Invalid user ID");
  });

  it("returns error for message too long", () => {
    const longMessage = "a".repeat(281);
    expect(validateWaitlistEntry("event-1", "user-1", longMessage)).toContain("280");
  });
});

describe("formatWaitDuration", () => {
  it("formats minutes", () => {
    const past = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatWaitDuration(past)).toBe("5m");
  });

  it("formats hours", () => {
    const past = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();
    expect(formatWaitDuration(past)).toBe("2h 30m");
  });

  it("formats days", () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatWaitDuration(past)).toBe("2d 0h");
  });
});

describe("calculatePromotionExpiration", () => {
  it("calculates expiration correctly", () => {
    const promotedAt = new Date("2024-01-01T00:00:00Z");
    const expiration = calculatePromotionExpiration(promotedAt, 60);
    expect(expiration.getTime()).toBe(new Date("2024-01-01T01:00:00Z").getTime());
  });
});

describe("isPromotionExpired", () => {
  it("returns false for null", () => {
    expect(isPromotionExpired(null)).toBe(false);
  });

  it("returns true for past date", () => {
    expect(isPromotionExpired("2020-01-01T00:00:00Z")).toBe(true);
  });

  it("returns false for future date", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(isPromotionExpired(future)).toBe(false);
  });
});

describe("sortByPosition", () => {
  it("sorts ascending", () => {
    const entries = [
      createMockEntry({ position: 3 }),
      createMockEntry({ position: 1 }),
      createMockEntry({ position: 2 }),
    ];
    const sorted = sortByPosition(entries);
    expect(sorted.map((e) => e.position)).toEqual([1, 2, 3]);
  });

  it("sorts descending", () => {
    const entries = [
      createMockEntry({ position: 1 }),
      createMockEntry({ position: 3 }),
      createMockEntry({ position: 2 }),
    ];
    const sorted = sortByPosition(entries, "desc");
    expect(sorted.map((e) => e.position)).toEqual([3, 2, 1]);
  });
});

describe("sortByJoinTime", () => {
  it("sorts by join time ascending", () => {
    const entries = [
      createMockEntry({ joined_at: "2024-01-03T00:00:00Z" }),
      createMockEntry({ joined_at: "2024-01-01T00:00:00Z" }),
      createMockEntry({ joined_at: "2024-01-02T00:00:00Z" }),
    ];
    const sorted = sortByJoinTime(entries);
    expect(sorted[0].joined_at).toBe("2024-01-01T00:00:00Z");
    expect(sorted[2].joined_at).toBe("2024-01-03T00:00:00Z");
  });
});

describe("getActiveEntries", () => {
  it("filters only waiting and promoted", () => {
    const entries = [
      createMockEntry({ status: "waiting" }),
      createMockEntry({ status: "promoted" }),
      createMockEntry({ status: "cancelled" }),
      createMockEntry({ status: "expired" }),
    ];
    const active = getActiveEntries(entries);
    expect(active).toHaveLength(2);
    expect(active.every((e) => e.status === "waiting" || e.status === "promoted")).toBe(true);
  });
});

describe("calculateWaitlistStats", () => {
  it("calculates stats correctly", () => {
    const entries = [
      createMockEntry({ status: "waiting" }),
      createMockEntry({ status: "waiting" }),
      createMockEntry({
        status: "promoted",
        joined_at: "2024-01-01T00:00:00Z",
        promoted_at: "2024-01-01T01:00:00Z",
      }),
      createMockEntry({ status: "cancelled" }),
      createMockEntry({ status: "expired" }),
    ];
    const stats = calculateWaitlistStats(entries);
    expect(stats.total_waiting).toBe(2);
    expect(stats.total_promoted).toBe(1);
    expect(stats.total_cancelled).toBe(1);
    expect(stats.total_expired).toBe(1);
  });
});

describe("generateWaitlistSummary", () => {
  it("generates correct summary", () => {
    const summary = generateWaitlistSummary(3, 10, 30);
    expect(summary).toContain("3rd");
    expect(summary).toContain("10 people waiting");
    expect(summary).toContain("30 minutes");
  });

  it("handles hours", () => {
    const summary = generateWaitlistSummary(1, 1, 90);
    expect(summary).toContain("1h 30m");
  });
});
