import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import NotificationItem from "./NotificationItem";
import { createClient } from "../../lib/supabase/client";
const mockNotifications = [
  {
    id: "1",
    type: "event",
    title: "Ekatra Techfest 2026",
    message: "Inauguration day 1 starts in 30 minutes! Make sure to grab your seats.",
    timestamp: "30m ago",
    isRead: false,
    link: "/events/ekatra",
  },
  {
    id: "2",
    type: "reply",
    title: "Discussion Reply",
    message: "Harsh Maurya replied to your post in the Web Dev group.",
    timestamp: "2h ago",
    isRead: false,
    link: "/discussions/web-dev",
  },
  {
    id: "3",
    type: "club",
    title: "New Club Announcement",
    message: "The AI & Robotics Club has published their recruitment schedule.",
    timestamp: "1d ago",
    isRead: true,
    link: "/clubs/ai-robotics",
  },
];

export const NavbarNotificationDropdown: React.FC = () => {
  const supabase = createClient();
  const [notifications, setNotifications] = useState(mockNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [userId, setUserId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Fetch current user and unread notification count from Supabase
  useEffect(() => {
    async function fetchUnreadCount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Fallback to local mock count if no user session exists
        setUnreadCount(notifications.filter((n) => !n.isRead).length);
        return;
      }

      setUserId(user.id);

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    }

    fetchUnreadCount();
  }, []);

  // 2. Real-time Supabase subscription for live unread updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("realtime_notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async () => {
          const { count } = await supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .is("read_at", null);

          if (count !== null) setUnreadCount(count);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const filteredNotifications = notifications.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleMarkAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));

    // Decrement count locally
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Optional: update Supabase read_at if authenticated
    if (userId) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    if (userId) {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format badge display text ("9+" if count > 9)
  const badgeText = unreadCount > 9 ? "9+" : unreadCount;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none rounded-full transition-colors flex items-center justify-center"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {/* Unread Notification Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[480px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 origin-top-right">
          <div className="p-3 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm text-gray-700">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notifications..."
                className="pl-7 pr-7 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                {searchQuery ? "No matching notifications." : "No notifications yet."}
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))
            )}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 rounded-b-lg">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="block w-full p-3 text-center text-sm font-semibold text-blue-600 hover:text-blue-800 hover:bg-gray-100 transition-colors"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
