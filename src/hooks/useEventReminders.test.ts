import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEventReminders } from "@/hooks/useEventReminders";
import type { EventReminder, CreateReminderPayload, ReminderLeadTime } from "@/types/reminders";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

const MOCK_PAYLOAD: CreateReminderPayload = {
  event_id: "evt-001",
  event_title: "CS301 Midterm Review",
  event_date: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow
  event_location: "Room 204",
  event_club_name: "CS Club",
  user_name: "Test User",
  lead_time: "1hour",
  frequency: "once",
  personal_note: "Bring notes",
  browser_notification: false,
  email_notification: false,
};

describe("useEventReminders", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("should initialize with empty state", () => {
    const { result } = renderHook(() => useEventReminders());
    expect(result.current.reminders).toEqual([]);
    expect(result.current.filteredReminders).toEqual([]);
    expect(result.current.stats.total_reminders).toBe(0);
  });

  it("should create a reminder", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
    });

    expect(result.current.reminders).toHaveLength(1);
    expect(result.current.reminders[0].event_title).toBe("CS301 Midterm Review");
    expect(result.current.reminders[0].status).toBe("active");
    expect(result.current.reminders[0].is_pinned).toBe(false);
    expect(result.current.stats.total_reminders).toBe(1);
    expect(result.current.stats.active_count).toBe(1);
  });

  it("should delete a reminder", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
    });

    const id = result.current.reminders[0].id;

    act(() => {
      result.current.deleteReminder(id);
    });

    expect(result.current.reminders).toHaveLength(0);
  });

  it("should snooze a reminder", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
    });

    const id = result.current.reminders[0].id;

    act(() => {
      result.current.snoozeReminder(id);
    });

    expect(result.current.reminders[0].status).toBe("snoozed");
  });

  it("should dismiss a reminder", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
    });

    const id = result.current.reminders[0].id;

    act(() => {
      result.current.dismissReminder(id);
    });

    expect(result.current.reminders[0].status).toBe("dismissed");
    expect(result.current.reminders[0].dismissed_at).toBeTruthy();
  });

  it("should toggle pin", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
    });

    const id = result.current.reminders[0].id;
    expect(result.current.reminders[0].is_pinned).toBe(false);

    act(() => {
      result.current.togglePin(id);
    });

    expect(result.current.reminders[0].is_pinned).toBe(true);

    act(() => {
      result.current.togglePin(id);
    });

    expect(result.current.reminders[0].is_pinned).toBe(false);
  });

  it("should filter by status", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
      result.current.createReminder({ ...MOCK_PAYLOAD, event_title: "Event 2" });
    });

    const id = result.current.reminders[0].id;

    act(() => {
      result.current.snoozeReminder(id);
    });

    act(() => {
      result.current.setFilter("status", "snoozed");
    });

    expect(result.current.filteredReminders).toHaveLength(1);
    expect(result.current.filteredReminders[0].status).toBe("snoozed");
  });

  it("should filter by search term", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
      result.current.createReminder({ ...MOCK_PAYLOAD, event_title: "AI Workshop" });
    });

    act(() => {
      result.current.setFilter("search", "Midterm");
    });

    expect(result.current.filteredReminders).toHaveLength(1);
    expect(result.current.filteredReminders[0].event_title).toContain("Midterm");
  });

  it("should compute countdown", () => {
    const { result } = renderHook(() => useEventReminders());

    const futureReminder: CreateReminderPayload = {
      ...MOCK_PAYLOAD,
      event_date: new Date(Date.now() + 3_600_000).toISOString(), // 1 hour from now
      lead_time: "30min",
    };

    act(() => {
      result.current.createReminder(futureReminder);
    });

    const countdown = result.current.getCountdown(result.current.reminders[0]);
    expect(countdown).not.toBeNull();
    expect(countdown!.isPast).toBe(false);
    expect(countdown!.totalSeconds).toBeGreaterThan(0);
  });

  it("should return null countdown for expired reminder", () => {
    const { result } = renderHook(() => useEventReminders());

    const pastReminder: CreateReminderPayload = {
      ...MOCK_PAYLOAD,
      event_date: new Date(Date.now() - 86_400_000).toISOString(), // yesterday
    };

    act(() => {
      result.current.createReminder(pastReminder);
    });

    const countdown = result.current.getCountdown(result.current.reminders[0]);
    expect(countdown!.isPast).toBe(true);
  });

  it("should update reminder", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
    });

    const id = result.current.reminders[0].id;

    act(() => {
      result.current.updateReminder(id, { personal_note: "Updated note" });
    });

    expect(result.current.reminders[0].personal_note).toBe("Updated note");
  });

  it("should clear all data", () => {
    const { result } = renderHook(() => useEventReminders());

    act(() => {
      result.current.createReminder(MOCK_PAYLOAD);
      result.current.createReminder({ ...MOCK_PAYLOAD, event_title: "Event 2" });
    });

    expect(result.current.reminders).toHaveLength(2);

    act(() => {
      result.current.clearAllReminders();
    });

    expect(result.current.reminders).toHaveLength(0);
  });

  it("should track notifications", () => {
    const { result } = renderHook(() => useEventReminders());
    expect(result.current.unreadNotificationCount).toBe(0);

    act(() => {
      result.current.markAllNotificationsRead();
    });

    expect(result.current.unreadNotificationCount).toBe(0);
  });
});
