import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import NotificationItem from "./NotificationItem";

const mockNotifications = [
  {
    id: "1",
    type: "event",
    title: "Ekatra Techfest 2026",
    message:
      "Inauguration day 1 starts in 30 minutes! Make sure to grab your seats.",
    timestamp: "30m ago",
    isRead: false,
    link: "/events/ekatra",
  },
  {
    id: "2",
    type: "reply",
    title: "Discussion Reply",
    message:
      "Harsh Maurya replied to your post in the Web Dev group.",
    timestamp: "2h ago",
    isRead: false,
    link: "/discussions/web-dev",
  },
  {
    id: "3",
    type: "club",
    title: "New Club Announcement",
    message:
      "The AI & Robotics Club has published their recruitment schedule.",
    timestamp: "1d ago",
    isRead: true,
    link: "/clubs/ai-robotics",
  },
];

export const NavbarNotificationDropdown: React.FC = () => {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredNotifications = notifications.filter(
    (notification) =>
      notification.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      notification.message
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const toggleDropdown = () => {
    setIsOpen((previous) => !previous);
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id
          ? { ...notification, isRead: true }
          : notification,
      ),
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        isRead: true,
      })),
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={toggleDropdown}
        className="relative flex items-center justify-center rounded-full p-2 text-gray-600 transition-colors hover:text-gray-900 focus:outline-none dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 max-h-[480px] w-80 origin-top-right overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl sm:w-96">
          <div className="border-b border-gray-200 bg-gray-50 p-3 dark:bg-[#0B1120]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Notifications
              </h3>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 transition-colors hover:text-blue-800"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
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

          <div className="max-h-[400px] divide-y divide-gray-100 overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">
                {searchQuery
                  ? "No matching notifications."
                  : "No notifications yet."}
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
        </div>
      )}
    </div>
  );
};

