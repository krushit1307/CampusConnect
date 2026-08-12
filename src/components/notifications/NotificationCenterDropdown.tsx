// src/components/notifications/NotificationCenterDropdown.tsx
import { useEffect, useRef, useState } from "react";
import Bell from "lucide-react/dist/esm/icons/bell";
import Check from "lucide-react/dist/esm/icons/check";
import CheckCheck from "lucide-react/dist/esm/icons/check-check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useNotificationCenterStore } from "@/store/useNotificationCenterStore";
import {
  type NotificationCategory,
  categorize,
  filterByCategory,
  formatNotificationMessage,
  subscribeToNotifications,
} from "@/lib/notifications";

const CATEGORIES: { id: NotificationCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mentions", label: "Mentions" },
  { id: "events", label: "Events" },
  { id: "messages", label: "Messages" },
  { id: "system", label: "System" },
];

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface NotificationCenterDropdownProps {
  userId: string | undefined;
}

/**
 * The bell-icon dropdown that renders the unified notification inbox.
 *
 * Wired to:
 *   - `useNotificationCenterStore` for state.
 *   - The `notifications` table via the `get_categorized_notifications`
 *     RPC for the inbox list.
 *   - Supabase Realtime via `subscribeToNotifications` for instant
 *     bell-badge updates.
 *   - The `mark_notification_read` RPC for optimistic mark-as-read.
 *   - The `mark_all_notifications_read` RPC for the "Mark all as
 *     read" button.
 */
export function NotificationCenterDropdown({ userId }: NotificationCenterDropdownProps) {
  const {
    items,
    unreadCount,
    unreadByType,
    activeCategory,
    isOpen,
    isLoading,
    load,
    refreshUnreadCount,
    setActiveCategory,
    toggleOpen,
    setOpen,
    markRead,
    markAllRead,
    onRealtimeInsert,
    onRealtimeUpdate,
  } = useNotificationCenterStore();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // ── Load on mount and when user changes ──────────────────────
  useEffect(() => {
    if (!userId) return;
    load(userId);
    refreshUnreadCount(userId);
  }, [userId, load, refreshUnreadCount]);

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToNotifications(
      userId,
      () => onRealtimeInsert(userId),
      () => onRealtimeUpdate(userId),
    );
    return unsubscribe;
  }, [userId, onRealtimeInsert, onRealtimeUpdate]);

  // ── Close dropdown on outside click ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, setOpen]);

  // ── Close dropdown on Escape ───────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, setOpen]);

  if (!userId) {
    return null;
  }

  const visibleItems = filterByCategory(items, activeCategory);

  const handleMarkAll = async () => {
    setIsMarkingAll(true);
    await markAllRead(userId);
    setIsMarkingAll(false);
  };

  const handleItemClick = async (notifId: string, link?: string | null) => {
    await markRead(notifId, userId);
    if (link) {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-[min(92vw,420px)] origin-top-right overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notifications
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isMarkingAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400"
                aria-label="Mark all notifications as read"
              >
                {isMarkingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="h-3 w-3" aria-hidden="true" />
                )}
                Mark all as read
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 py-2 dark:border-slate-700">
            {CATEGORIES.map((cat) => {
              const catUnread =
                cat.id === "all"
                  ? unreadCount
                  : Object.entries(unreadByType)
                      .filter(([type]) => categorize(type) === cat.id)
                      .reduce((sum, [, n]) => sum + n, 0);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  aria-pressed={activeCategory === cat.id}
                  className={`relative whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    activeCategory === cat.id
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {cat.label}
                  {catUnread > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {catUnread > 99 ? "99+" : catUnread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notification list */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading && items.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="py-10 text-center">
                <Bell
                  className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  You're all caught up!
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleItems.map((notif) => (
                  <li key={notif.id}>
                    <NotificationRow
                      notif={notif}
                      onClick={() => handleItemClick(notif.id, notif.link)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-4 py-2 text-center dark:border-slate-700">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * A single notification row inside the dropdown.
 */
interface NotificationRowProps {
  notif: import("@/lib/notifications").NotificationItem;
  onClick: () => void;
}

function NotificationRow({ notif, onClick }: NotificationRowProps) {
  const content = (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
        !notif.is_read ? "bg-indigo-50/50 dark:bg-indigo-950/30" : ""
      }`}
      aria-label={`${notif.title}${notif.is_read ? "" : " (unread)"}`}
    >
      {/* Unread dot */}
      <span className="mt-1.5 shrink-0">
        {!notif.is_read && (
          <span className="block h-2 w-2 rounded-full bg-indigo-500" aria-hidden="true" />
        )}
        {notif.is_read && (
          <Check className="h-3 w-3 text-slate-300 dark:text-slate-600" aria-hidden="true" />
        )}
      </span>
      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{notif.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
          {formatNotificationMessage(notif)}
        </p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          {formatRelativeTime(notif.created_at)}
        </p>
      </div>
    </button>
  );

  // If the notification has a link, wrap in <Link> for SPA navigation.
  if (notif.link) {
    return <Link to={notif.link}>{content}</Link>;
  }
  return content;
}
