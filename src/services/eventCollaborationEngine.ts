/**
 * Event Collaboration Engine
 * Room chat message models, task assignment reducers, and active team member listings.
 */

export interface EventChatMessage {
    id: string;
    senderName: string;
    senderRole: string;
    messageText: string;
    timestamp: string;
}

export interface EventTaskItem {
    id: string;
    taskTitle: string;
    assigneeName: string;
    status: 'Todo' | 'In Progress' | 'Done';
}

export const MOCK_ROOM_CHAT_MESSAGES: EventChatMessage[] = [
    {
        id: "msg_1",
        senderName: "Dipanshu Batra",
        senderRole: "Lead Organizer",
        messageText: "We have finalized the venue booking for Auditorium B!",
        timestamp: "10:14 AM"
    },
    {
        id: "msg_2",
        senderName: "Sarah Chen",
        senderRole: "Design Lead",
        messageText: "Awesome! The promo flyers are ready for print review.",
        timestamp: "10:18 AM"
    }
];

export const MOCK_COLLAB_TASKS: EventTaskItem[] = [
    { id: "task_1", taskTitle: "Confirm Sponsor Keynote Speaker", assigneeName: "Dipanshu Batra", status: "In Progress" },
    { id: "task_2", taskTitle: "Order Catering Snacks & Drinks", assigneeName: "Sarah Chen", status: "Done" },
    { id: "task_3", taskTitle: "Test Live Streaming Microphones", assigneeName: "Alex Rivera", status: "Todo" }
];
