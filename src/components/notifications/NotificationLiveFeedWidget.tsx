import React, { useEffect, useState, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import Bell from "lucide-react/dist/esm/icons/bell";
import CheckCheck from "lucide-react/dist/esm/icons/check-check";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Settings from "lucide-react/dist/esm/icons/settings";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Building from "lucide-react/dist/esm/icons/building";
import MessageSquare from "lucide-react/dist/esm/icons/message-square";
import Shield from "lucide-react/dist/esm/icons/shield";
import AtSign from "lucide-react/dist/esm/icons/at-sign";
import { createClient } from "@/lib/supabase/client";
import { Link } from "react-router-dom";
import { formatTime } from "@/lib/dateFormatter";
import { EmptyState } from "@/components/EmptyState";
import { useGraphQLSubscription } from "@/hooks/useGraphQLSubscription";

const NOTIFICATION_SUBSCRIPTION = `
  subscription OnNotificationReceived($userId: ID!) {
    notificationReceived(userId: $userId) {
      id
      userId
      type
      title
      message
      link
      isRead
      createdAt
    }
  }
`;

type WidgetNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
};

export function NotificationLiveFeedWidget() {
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const seenNotifIds = useRef<Set<string>>(new Set());

  const [notifications, setNotifications] = useState<WidgetNotification[]>([
    {
      id: "n_1",
      type: "event",
      title: "AI Innovation Hackathon 2026",
      message: "RSVP confirmed! Event starts tomorrow at 10:00 AM in Science Hall.",
      is_read: false,
      link: "/events",
      created_at: new Date().toISOString(),
    },
    {
      id: "n_2",
      type: "club",
      title: "Robotics Club Announcement",
      message: "Weekly meeting moved to Room 402 this Thursday.",
      is_read: false,
      link: "/clubs",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "n_3",
      type: "security",
      title: "Passkey Added",
      message: "New MacBook TouchID passkey registered to your account.",
      is_read: true,
      link: "/settings",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ]);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        setCurrentUserId(data.user.id);
      }
    });
  }, [supabase.auth]);

  const subscriptionOperation = currentUserId
    ? { query: NOTIFICATION_SUBSCRIPTION, variables: { userId: currentUserId } }
    : null;

  const { data: subData } = useGraphQLSubscription<{
    notificationReceived: {
      id: string;
      userId: string;
      type: string;
      title: string;
      message: string;
      link: string | null;
      isRead: boolean;
      createdAt: string;
    };
  }>(subscriptionOperation, { skip: !currentUserId });

  useEffect(() => {
    const notif = subData?.notificationReceived;
    if (!notif) return;
    if (seenNotifIds.current.has(notif.id)) return;
    seenNotifIds.current.add(notif.id);

    const newWidgetNotif: WidgetNotification = {
      id: notif.id,
      type: notif.type.toLowerCase(),
      title: notif.title,
      message: notif.message,
      is_read: notif.isRead,
      link: notif.link ?? undefined,
      created_at: notif.createdAt,
    };

    setNotifications((prev) => [newWidgetNotif, ...prev]);
  }, [subData]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "event":
      case "event_update":
        return <Calendar className="h-4 w-4 text-blue-600" />;
      case "club":
        return <Building className="h-4 w-4 text-amber-600" />;
      case "reply":
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case "mention":
        return <AtSign className="h-4 w-4 text-pink-600" />;
      default:
        return <Shield className="h-4 w-4 text-purple-600" />;
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Open realtime notifications feed"
          className="relative neu-border bg-white p-2 hover:bg-cream transition-colors cursor-pointer shadow-[2px_2px_0_0_#000]"
        >
          <Bell size={20} className="text-black" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center bg-red-500 text-[10px] font-bold text-white rounded-full border border-black animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="neu-border z-50 w-88 bg-white p-4 shadow-[6px_6px_0_0_#000]"
        >
          <div className="flex items-center justify-between pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-xs font-black uppercase tracking-widest text-black">
                Live Feed
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-lime border border-black font-mono text-[10px] font-bold">
                  {unreadCount} New
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="font-mono text-[10px] font-bold uppercase text-gray-600 hover:text-black flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck size={14} /> Mark Read
              </button>
            )}
          </div>

          <div className="py-2 space-y-2 max-h-80 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                illustrationType="no-notifications"
                title="All caught up"
                description="No notifications yet. We’ll ring the bell when something happens."
                className="border-0 px-2 py-4 shadow-none [&>div:first-child]:h-16 [&>div:first-child]:w-16 [&>h3]:text-sm [&>p]:text-xs"
              />
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  to={n.link || "/notifications"}
                  onClick={() => setIsOpen(false)}
                  className={`block p-3 border border-black transition-all hover:-translate-y-0.5 ${
                    !n.is_read ? "bg-sky/15 border-l-4 border-l-blue-600" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 border border-black bg-cream shrink-0 mt-0.5">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-black truncate">{n.title}</p>
                      <p className="text-[11px] font-mono text-gray-600 line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <span className="block font-mono text-[9px] text-gray-400 mt-1">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="pt-3 border-t-2 border-black flex justify-between items-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="font-mono text-xs font-bold uppercase text-blue-700 hover:underline flex items-center gap-1"
            >
              View All Notifications <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <Popover.Arrow className="fill-black" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
