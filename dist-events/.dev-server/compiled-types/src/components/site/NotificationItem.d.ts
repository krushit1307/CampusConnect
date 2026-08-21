import React from "react";
interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    isRead: boolean;
    link?: string;
  };
  onMarkAsRead: (id: string) => void;
}
declare const NotificationItem: React.FC<NotificationItemProps>;
export default NotificationItem;
