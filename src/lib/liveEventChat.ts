export interface EventChatMessage {
  id: string;
  eventId: string;
  userId: string;
  senderName: string;
  messageText: string;
  isAnnouncement: boolean;
  isPinned: boolean;
  createdAtIso: string;
}

export interface LiveChatFeedState {
  pinnedAnnouncements: EventChatMessage[];
  chatFeedMessages: EventChatMessage[];
  pushNotificationPayload?: {
    title: string;
    body: string;
    tag: string;
  };
}

/**
 * Categorizes incoming real-time chat messages into top pinned announcements and scrolling feed messages.
 */
export function processLiveChatFeed(messages: EventChatMessage[]): LiveChatFeedState {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime(),
  );

  const pinnedAnnouncements = sorted.filter((m) => m.isAnnouncement || m.isPinned);
  const chatFeedMessages = sorted.filter((m) => !m.isAnnouncement);

  return {
    pinnedAnnouncements,
    chatFeedMessages,
  };
}

/**
 * Formats browser push notification payload when an organizer posts a pinned announcement.
 */
export function buildAnnouncementPushPayload(
  message: EventChatMessage,
  eventTitle: string,
): LiveChatFeedState["pushNotificationPayload"] | null {
  if (!message.isAnnouncement) {
    return null;
  }

  return {
    title: `📢 Announcement: ${eventTitle}`,
    body: `${message.senderName}: ${message.messageText}`,
    tag: `announcement_${message.eventId}_${message.id}`,
  };
}

/**
 * Returns Tailwind CSS styling for chat messages (highlighting pinned announcements in bright yellow).
 */
export function getChatMessageCssClass(isAnnouncement: boolean): string {
  if (isAnnouncement) {
    return "bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-3 rounded-r-md shadow-sm font-medium";
  }
  return "bg-white text-gray-800 p-2.5 rounded-lg border border-gray-100 shadow-2xs";
}
