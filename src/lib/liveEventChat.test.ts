import { describe, it, expect } from "vitest";
import {
  processLiveChatFeed,
  buildAnnouncementPushPayload,
  getChatMessageCssClass,
  EventChatMessage,
} from "./liveEventChat";

describe("Build Live Event Chat with Pinned Announcements Suite (#3882)", () => {
  const sampleMessages: EventChatMessage[] = [
    {
      id: "m1",
      eventId: "evt_hackathon",
      userId: "usr_alice",
      senderName: "Alice",
      messageText: "Where is room 204?",
      isAnnouncement: false,
      isPinned: false,
      createdAtIso: "2026-08-21T18:00:00Z",
    },
    {
      id: "m2",
      eventId: "evt_hackathon",
      userId: "usr_organizer",
      senderName: "Head Organizer",
      messageText: "Midnight Pizza has arrived in the lobby!",
      isAnnouncement: true,
      isPinned: true,
      createdAtIso: "2026-08-21T18:05:00Z",
    },
  ];

  it("locks announcement messages to pinned section while keeping feed chronologically organized", () => {
    const feedState = processLiveChatFeed(sampleMessages);

    expect(feedState.pinnedAnnouncements.length).toBe(1);
    expect(feedState.pinnedAnnouncements[0].messageText).toContain("Midnight Pizza");
    expect(feedState.chatFeedMessages.length).toBe(1);
    expect(feedState.chatFeedMessages[0].senderName).toBe("Alice");
  });

  it("generates browser push notification payload when an announcement is broadcast", () => {
    const announcementMsg = sampleMessages[1];
    const push = buildAnnouncementPushPayload(announcementMsg, "Campus Hackathon 2026");

    expect(push).not.toBeNull();
    expect(push?.title).toBe("📢 Announcement: Campus Hackathon 2026");
    expect(push?.body).toContain("Head Organizer: Midnight Pizza has arrived in the lobby!");
  });

  it("returns bright yellow highlighted CSS classes for announcement messages", () => {
    const announcementCss = getChatMessageCssClass(true);
    const standardCss = getChatMessageCssClass(false);

    expect(announcementCss).toContain("bg-amber-100");
    expect(announcementCss).toContain("border-amber-500");
    expect(standardCss).toContain("bg-white");
  });
});
