import React, { useCallback, useEffect, useRef, useState } from "react";
import Bell from "lucide-react/dist/esm/icons/bell";
import BellOff from "lucide-react/dist/esm/icons/bell-off";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Search from "lucide-react/dist/esm/icons/search";
import X from "lucide-react/dist/esm/icons/x";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import NotificationItem from "./NotificationItem";
import { createClient } from "@/lib/supabase/client";
import { getNotificationLink } from "@/lib/notificationUtils";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
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

export const NavbarNotificationDropdown: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mentions, setMentions] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "mentions">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // 1. Fetch User Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // 2. Fetch Notifications and Mentions
  const fetchNotificationsAndMentions = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      // Fetch general notifications
      const { data: generalData, error: generalErr } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (generalErr) throw generalErr;

      // Fetch mentions using RPC
      const { data: mentionsData, error: mentionsErr } = await supabase.rpc("get_user_mentions", {
        p_user_id: userId,
      });

      if (mentionsErr) throw mentionsErr;

      // Format general notifications
      const formattedGeneral = (
        (generalData || []) as {
          id: string;
          type: string;
          title: string;
          message: string;
          is_read: boolean;
          link?: string;
          metadata?: Record<string, unknown> | null;
          created_at: string;
        }[]
      ).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        timestamp: formatRelativeTime(n.created_at),
        isRead: n.is_read,
        link: getNotificationLink(n.type, n.metadata, n.link),
        metadata: n.metadata,
        createdAt: n.created_at,
      }));

      // Format mentions
      const formattedMentions = (
        (mentionsData || []) as {
          id: string;
          title: string;
          message: string;
          is_read: boolean;
          link?: string;
          created_at: string;
        }[]
      ).map((m) => ({
        id: m.id,
        type: "mention",
        title: m.title,
        message: m.message,
        timestamp: formatRelativeTime(m.created_at),
        isRead: m.is_read,
        link: getNotificationLink("mention", null, m.link),
        createdAt: m.created_at,
      }));

      setNotifications(formattedGeneral);
      setMentions(formattedMentions);
    } catch (err) {
      console.error("Error fetching notifications/mentions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, supabase]);

  // Trigger fetch when dropdown is opened or user logs in
  useEffect(() => {
    if (isOpen && userId) {
      fetchNotificationsAndMentions();
    }
  }, [isOpen, userId, fetchNotificationsAndMentions]);

  const toggleDropdown = () => setIsOpen(!isOpen);

  // 3. Mark Single Notification/Mention as Read
  const handleMarkAsRead = async (id: string) => {
    if (!userId) return;
    const isMention = mentions.some((m) => m.id === id);

    try {
      if (isMention) {
        await supabase.rpc("mark_mention_as_read", { p_mention_id: id, p_user_id: userId });
        setMentions((prev) => prev.map((m) => (m.id === id ? { ...m, isRead: true } : m)));
      } else {
        await supabase.from("notifications").update({ is_read: true }).eq("id", id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!userId) return;
    const isMention = mentions.some((m) => m.id === id);

    try {
      if (isMention) {
        setMentions((prev) => prev.filter((m) => m.id !== id));
      } else {
        await supabase.from("notifications").delete().eq("id", id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
      toast.success("Notification deleted");
    } catch (err) {
      console.error("Failed to delete notification:", err);
      toast.error("Failed to delete notification");
    }
  };

  // 4. Mark All as Read (Context-specific: All or Mentions only)
  const handleMarkAllAsRead = async () => {
    if (!userId) return;

    try {
      if (activeTab === "all") {
        await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
        await supabase.rpc("mark_all_mentions_as_read", { p_user_id: userId });
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setMentions((prev) => prev.map((m) => ({ ...m, isRead: true })));
      } else {
        await supabase.rpc("mark_all_mentions_as_read", { p_user_id: userId });
        setMentions((prev) => prev.map((m) => ({ ...m, isRead: true })));
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // 5. Click outside handler to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 6. Filter and display logic
  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;
  const unreadMentionsCount = mentions.filter((m) => !m.isRead).length;
  const totalUnreadCount = unreadNotificationsCount + unreadMentionsCount;

  const currentList = activeTab === "all" ? [...notifications, ...mentions] : mentions;
  const sortedList = currentList.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const filteredItems = sortedList.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeTabUnreadCount = activeTab === "all" ? totalUnreadCount : unreadMentionsCount;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none rounded-full transition-colors flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" strokeWidth={1.5} />

        {totalUnreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {totalUnreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[500px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 origin-top-right overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex flex-col gap-2 shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm text-gray-700">Notifications</h3>
              {activeTabUnreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-semibold"
                >
                  Mark {activeTab === "all" ? "all" : "mentions"} as read
                </button>
              )}
            </div>

            {/* Filter Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === "all" ? "notifications" : "mentions"}...`}
                className="pl-7 pr-7 text-xs bg-white"
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

            {/* Premium Tab Navigation */}
            <div className="flex border-b border-gray-200 text-xs font-semibold mt-1">
              <button
                onClick={() => {
                  setActiveTab("all");
                  setSearchQuery("");
                }}
                className={`flex-1 py-1.5 text-center border-b-2 transition-all ${
                  activeTab === "all"
                    ? "border-black text-black font-bold"
                    : "border-transparent text-gray-500 hover:text-black"
                }`}
              >
                All
                {unreadNotificationsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-black text-white rounded-full">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab("mentions");
                  setSearchQuery("");
                }}
                className={`flex-1 py-1.5 text-center border-b-2 transition-all ${
                  activeTab === "mentions"
                    ? "border-black text-black font-bold"
                    : "border-transparent text-gray-500 hover:text-black"
                }`}
              >
                Mentions
                {unreadMentionsCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-red-500 text-white rounded-full">
                    {unreadMentionsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* List Area */}
          <div className="divide-y divide-gray-100 overflow-y-auto flex-1 max-h-[350px]">
            {isLoading ? (
              <div className="flex items-center justify-center p-8 gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                Loading...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400 flex flex-col items-center justify-center gap-2">
                <BellOff size={24} className="text-gray-300" />
                <span>
                  {searchQuery
                    ? "No matching items."
                    : activeTab === "all"
                      ? "No notifications yet."
                      : "No mentions yet."}
                </span>
              </div>
            ) : (
              filteredItems.map((item) => (
                <NotificationItem
                  key={item.id}
                  notification={item}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDeleteNotification}
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
