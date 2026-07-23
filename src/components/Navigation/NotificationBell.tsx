import React, { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.read).length);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Open notifications"
          className="relative neu-border bg-white p-2 hover:bg-cream transition-colors cursor-pointer"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-black text-[10px] font-bold text-cream rounded-full">
              {unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="neu-border z-50 w-80 bg-white p-4 shadow-[4px_4px_0_0_#000]"
        >
          <div className="flex items-center justify-between pb-3 border-b-2 border-black">
            <h3 className="font-mono text-xs font-black uppercase tracking-widest text-black">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="font-mono text-[10px] font-bold uppercase text-gray-600 hover:text-black flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}
          </div>

          <div className="py-3 divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center font-mono text-xs text-gray-500 py-6">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`py-2.5 ${!n.read ? "font-semibold bg-sky/10 px-2 rounded" : ""}`}
                >
                  <p className="text-sm font-bold text-black">{n.title}</p>
                  <p className="text-xs font-mono text-gray-600 line-clamp-2">{n.message}</p>
                </div>
              ))
            )}
          </div>
          <Popover.Arrow className="fill-black" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
