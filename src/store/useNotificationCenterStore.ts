// src/store/useNotificationCenterStore.ts
import { create } from "zustand";
import type { NotificationItem, NotificationCategory } from "../lib/notifications";
import {
  fetchCategorizedNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/notifications";

/**
 * The unified notification center store (issue #2690).
 *
 * Holds:
 *   - `items` — the latest N notifications fetched from the RPC.
 *   - `unreadCount` — the cached bell-badge count, updated via
 *     realtime subscription.
 *   - `unreadByType` — per-category unread counts for the tabs.
 *   - `activeCategory` — the currently-selected tab.
 *   - `isOpen` — whether the dropdown is open.
 *   - `isLoading` — true while the initial fetch is in flight.
 *   - `error` — the last fetch error (null if none).
 *
 * The store is intentionally NOT persisted to localStorage — the
 * notifications table is the source of truth, and the realtime
 * subscription keeps the in-memory state fresh.
 */
interface NotificationCenterState {
  items: NotificationItem[];
  unreadCount: number;
  unreadByType: Record<string, number>;
  activeCategory: NotificationCategory;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  load: (userId: string) => Promise<void>;
  refreshUnreadCount: (userId: string) => Promise<void>;
  setActiveCategory: (cat: NotificationCategory) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;

  // Optimistic mark-as-read
  markRead: (notificationId: string, userId: string) => Promise<boolean>;
  markAllRead: (userId: string, type?: string) => Promise<number>;

  // Realtime handlers
  onRealtimeInsert: (userId: string) => Promise<void>;
  onRealtimeUpdate: (userId: string) => Promise<void>;
}

export const useNotificationCenterStore = create<NotificationCenterState>((set, get) => ({
  items: [],
  unreadCount: 0,
  unreadByType: {},
  activeCategory: "all",
  isOpen: false,
  isLoading: false,
  error: null,

  load: async (userId: string) => {
    set({ isLoading: true, error: null });
    const data = await fetchCategorizedNotifications(userId, 30, 0);
    if (!data) {
      set({ isLoading: false, error: "Failed to load notifications." });
      return;
    }
    set({
      items: data.items,
      unreadCount: data.total_unread,
      unreadByType: data.unread_by_type,
      isLoading: false,
    });
  },

  refreshUnreadCount: async (userId: string) => {
    const count = await fetchUnreadNotificationCount(userId);
    set({ unreadCount: count });
  },

  setActiveCategory: (cat: NotificationCategory) => set({ activeCategory: cat }),

  toggleOpen: () => {
    const next = !get().isOpen;
    set({ isOpen: next });
    // When opening, refresh the unread count in case it drifted.
    if (next && get().items.length === 0) {
      // items will be loaded by the component via load()
    }
  },

  setOpen: (open: boolean) => set({ isOpen: open }),

  markRead: async (notificationId: string, userId: string) => {
    // ── Optimistic update ─────────────────────────────────
    const prevItems = get().items;
    const prevCount = get().unreadCount;
    const prevByType = get().unreadByType;

    const target = prevItems.find((n) => n.id === notificationId);
    if (!target || target.is_read) {
      return false;
    }

    set({
      items: prevItems.map((n) =>
        n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
      ),
      unreadCount: Math.max(0, prevCount - 1),
      unreadByType: {
        ...prevByType,
        [target.type]: Math.max(0, (prevByType[target.type] ?? 0) - 1),
      },
    });

    // ── Server round-trip ──────────────────────────────────
    const success = await markNotificationRead(notificationId, userId);
    if (!success) {
      // Revert the optimistic update.
      set({
        items: prevItems,
        unreadCount: prevCount,
        unreadByType: prevByType,
      });
      return false;
    }
    return true;
  },

  markAllRead: async (userId: string, type?: string) => {
    const prevItems = get().items;
    const prevCount = get().unreadCount;
    const prevByType = get().unreadByType;

    // Optimistic: mark all (or all of `type`) as read.
    const nowIso = new Date().toISOString();
    set({
      items: prevItems.map((n) =>
        (type === undefined || n.type === type) && !n.is_read
          ? { ...n, is_read: true, read_at: nowIso }
          : n,
      ),
      unreadCount: 0,
      unreadByType: type ? { ...prevByType, [type]: 0 } : {},
    });

    // Server round-trip.
    const count = await markAllNotificationsRead(userId, type);
    if (count === 0 && prevCount > 0) {
      // The optimistic update was wrong — revert.
      set({
        items: prevItems,
        unreadCount: prevCount,
        unreadByType: prevByType,
      });
    }
    return count;
  },

  onRealtimeInsert: async (userId: string) => {
    // A new notification arrived — refresh both the items list
    // and the unread count. We could optimistically increment
    // unreadCount by 1, but the RPC is cheap (uses the partial
    // index) and refreshing avoids drift.
    await Promise.all([get().load(userId), get().refreshUnreadCount(userId)]);
  },

  onRealtimeUpdate: async (userId: string) => {
    // An existing notification was updated (e.g., grouped
    // group_count incremented, or marked read by another tab).
    await get().load(userId);
  },
}));
