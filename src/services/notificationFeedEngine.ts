/**
 * Notification Feed Engine
 * Campus notification schemas, unread state reducers, category filter matchers.
 */

export interface CampusNotificationItem {
    id: string;
    title: string;
    description: string;
    category: 'announcement' | 'event' | 'mention' | 'academic';
    timestamp: string;
    isRead: boolean;
    actionUrl?: string;
}

export const MOCK_CAMPUS_NOTIFICATIONS: CampusNotificationItem[] = [
    {
        id: "notif_1",
        title: "Hackathon Registration Open!",
        description: "Annual Tech Innovation Hackathon registration is now live. Team submissions close in 3 days.",
        category: "event",
        timestamp: "10 mins ago",
        isRead: false,
        actionUrl: "#events"
    },
    {
        id: "notif_2",
        title: "CS301 Midterm Grade Published",
        description: "Professor Allen has uploaded the midterm examination scores to the portal.",
        category: "academic",
        timestamp: "1 hour ago",
        isRead: false,
        actionUrl: "#grades"
    },
    {
        id: "notif_3",
        title: "Mentorship Request Accepted",
        description: "@dipanshubatra accepted your request for 1-on-1 code review mentorship.",
        category: "mention",
        timestamp: "3 hours ago",
        isRead: true
    }
];
