import React from "react";
import { SwipeToDismiss } from "@/components/ui/SwipeToDismiss";

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    isRead: boolean;
    link?: string;
    metadata?: Record<string, unknown> | null;
  };
  onMarkAsRead: (id: string) => void;
  /**
   * Called after a successful swipe-to-dismiss gesture. Parents should treat
   * this as the trigger for an optimistic delete (remove from local state /
   * cache immediately, then fire the deletion mutation).
   */
  onDelete?: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
}) => {
  const handleItemClick = () => {
    onMarkAsRead(notification.id);
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleItemClick();
    }
  };

  const card = (
    <div
      onClick={handleItemClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${notification.isRead ? "Read" : "Unread"} notification: ${notification.title}`}
      className={`p-3 border-b border-gray-100 cursor-pointer transition-colors duration-200 hover:bg-gray-50 flex flex-col gap-1 text-left ${
        !notification.isRead ? "bg-blue-50/60 font-medium" : "bg-white"
      }`}
    >
      {" "}
      <div className="flex justify-between items-start gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {notification.type}
        </span>
        <span className="text-[10px] text-gray-400">{notification.timestamp}</span>
      </div>
      <h4 className="text-sm text-gray-800 line-clamp-1">{notification.title}</h4>
      <p className="text-xs text-gray-500 line-clamp-2">{notification.message}</p>
      {!notification.isRead && <span className="w-2 h-2 bg-blue-600 rounded-full mt-1 self-end" />}
    </div>
  );

  if (!onDelete) return card;

  return (
    <SwipeToDismiss
      onDismiss={() => onDelete(notification.id)}
      ariaLabel={`Swipe to dismiss notification: ${notification.title}`}
    >
      {card}
    </SwipeToDismiss>
  );
};

export default NotificationItem;
