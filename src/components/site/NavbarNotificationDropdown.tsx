import React, { useState, useEffect, useRef } from "react";
import NotificationItem from "./NotificationItem";

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
  const [notifications, setNotifications] = useState(mockNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
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

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[480px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 origin-top-right">
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-semibold text-sm text-gray-700">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => setNotifications(notifications.map((n) => ({ ...n, isRead: true })))}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No notifications yet.</div>
            ) : (
              notifications.map((notification) => (
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
