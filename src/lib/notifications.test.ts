// src/lib/notifications.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import { supabase } from "./supabase/client";
import {
  fetchCategorizedNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  formatNotificationMessage,
  categorize,
  filterByCategory,
  subscribeToNotifications,
  type NotificationItem,
} from "./notifications";

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRpc.mockReset();
});

const makeNotif = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: "n1",
  type: "event_liked",
  title: "Someone liked your event",
  message: "Alice liked your event.",
  link: "/events/e1",
  is_read: false,
  created_at: new Date().toISOString(),
  group_count: 1,
  ...overrides,
});

describe("notifications — fetchCategorizedNotifications", () => {
  it("returns the parsed data when the RPC succeeds", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        items: [makeNotif()],
        unread_by_type: { event_liked: 1 },
        total_unread: 1,
        total_count: 1,
        limit: 30,
        offset: 0,
      },
      error: null,
    });
    const result = await fetchCategorizedNotifications("user-1");
    expect(result).not.toBeNull();
    expect(result?.items).toHaveLength(1);
    expect(result?.total_unread).toBe(1);
  });

  it("returns null when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    const result = await fetchCategorizedNotifications("user-1");
    expect(result).toBeNull();
  });
});

describe("notifications — fetchUnreadNotificationCount", () => {
  it("returns the count when the RPC succeeds", async () => {
    mockRpc.mockResolvedValueOnce({ data: 7, error: null });
    const count = await fetchUnreadNotificationCount("user-1");
    expect(count).toBe(7);
  });

  it("returns 0 when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "oops" } });
    const count = await fetchUnreadNotificationCount("user-1");
    expect(count).toBe(0);
  });
});

describe("notifications — markNotificationRead", () => {
  it("returns true when the RPC reports marked_read=true", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, marked_read: true },
      error: null,
    });
    const ok = await markNotificationRead("n1", "user-1");
    expect(ok).toBe(true);
  });

  it("returns false when the RPC reports marked_read=false", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, marked_read: false },
      error: null,
    });
    const ok = await markNotificationRead("n1", "user-1");
    expect(ok).toBe(false);
  });

  it("returns false when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "fail" } });
    const ok = await markNotificationRead("n1", "user-1");
    expect(ok).toBe(false);
  });
});

describe("notifications — markAllNotificationsRead", () => {
  it("returns the marked_read_count when the RPC succeeds", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, marked_read_count: 5 },
      error: null,
    });
    const count = await markAllNotificationsRead("user-1");
    expect(count).toBe(5);
  });

  it("returns 0 when the RPC errors", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "fail" } });
    const count = await markAllNotificationsRead("user-1");
    expect(count).toBe(0);
  });

  it("passes the type filter to the RPC when provided", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, marked_read_count: 2 },
      error: null,
    });
    await markAllNotificationsRead("user-1", "mention");
    expect(mockRpc).toHaveBeenCalledWith("mark_all_notifications_read", {
      p_user_id: "user-1",
      p_type: "mention",
    });
  });
});

describe("notifications — formatNotificationMessage (grouping edge case)", () => {
  it("returns the message as-is when group_count = 1", () => {
    const notif = makeNotif({ message: "Alice liked your event.", group_count: 1 });
    expect(formatNotificationMessage(notif)).toBe("Alice liked your event.");
  });

  it("expands to 'Alice and 1 other' when group_count = 2", () => {
    const notif = makeNotif({
      actor_name: "Alice",
      message: "Alice liked your event.",
      group_count: 2,
    });
    expect(formatNotificationMessage(notif)).toBe("Alice and 1 other liked your event.");
  });

  it("expands to 'Alice and 49 others' when group_count = 50", () => {
    const notif = makeNotif({
      actor_name: "Alice",
      message: "Alice liked your event.",
      group_count: 50,
    });
    expect(formatNotificationMessage(notif)).toBe("Alice and 49 others liked your event.");
  });

  it("falls back to prepending the grouped intro when actor_name is not at the start", () => {
    const notif = makeNotif({
      actor_name: "Bob",
      message: "Someone liked your event.",
      group_count: 10,
    });
    expect(formatNotificationMessage(notif)).toBe("Bob and 9 others — Someone liked your event.");
  });
});

describe("notifications — categorize", () => {
  it("categorizes 'mention' as 'mentions'", () => {
    expect(categorize("mention")).toBe("mentions");
  });

  it("categorizes 'event_liked', 'event_commented', 'event' as 'events'", () => {
    expect(categorize("event_liked")).toBe("events");
    expect(categorize("event_commented")).toBe("events");
    expect(categorize("event")).toBe("events");
  });

  it("categorizes 'message', 'dm' as 'messages'", () => {
    expect(categorize("message")).toBe("messages");
    expect(categorize("dm")).toBe("messages");
  });

  it("categorizes 'system', 'announcement' as 'system'", () => {
    expect(categorize("system")).toBe("system");
    expect(categorize("announcement")).toBe("system");
  });

  it("falls back to 'all' for unknown types", () => {
    expect(categorize("unknown_type")).toBe("all");
  });
});

describe("notifications — filterByCategory", () => {
  const items: NotificationItem[] = [
    makeNotif({ id: "n1", type: "mention" }),
    makeNotif({ id: "n2", type: "event_liked" }),
    makeNotif({ id: "n3", type: "message" }),
    makeNotif({ id: "n4", type: "system" }),
  ];

  it("returns all items when category='all'", () => {
    expect(filterByCategory(items, "all")).toHaveLength(4);
  });

  it("filters by category", () => {
    expect(filterByCategory(items, "mentions")).toHaveLength(1);
    expect(filterByCategory(items, "events")).toHaveLength(1);
    expect(filterByCategory(items, "messages")).toHaveLength(1);
    expect(filterByCategory(items, "system")).toHaveLength(1);
  });
});

describe("notifications — subscribeToNotifications", () => {
  it("returns an unsubscribe function", () => {
    const unsubscribe = subscribeToNotifications(
      "user-1",
      () => {},
      () => {},
    );
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

describe("notifications — SQL contract (migration guards)", () => {
  it("the migration adds the grouping columns to the notifications table", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../supabase/migrations/20260816000001_unified_notification_center.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS entity_id");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS actor_id");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS group_key");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS group_count");
  });

  it("the migration creates the mark_notification_read RPC", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../supabase/migrations/20260816000001_unified_notification_center.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.mark_notification_read");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.mark_all_notifications_read");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_unread_notification_count");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_categorized_notifications");
  });

  it("the migration creates the grouping trigger", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../supabase/migrations/20260816000001_unified_notification_center.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("group_similar_notifications");
    expect(sql).toContain("on_notification_insert_group");
    expect(sql).toContain("BEFORE INSERT ON public.notifications");
  });

  it("the migration creates the unread-count partial index", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../supabase/migrations/20260816000001_unified_notification_center.sql",
      ),
      "utf-8",
    );
    expect(sql).toContain("idx_notifications_user_unread");
    expect(sql).toContain("WHERE is_read = FALSE");
  });
});
