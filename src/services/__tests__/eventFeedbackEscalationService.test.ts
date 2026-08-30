import { describe, it, expect, beforeEach } from "vitest";
import { EventFeedbackEscalationService } from "../eventFeedbackEscalationService";
import { NonRespondentAttendee } from "../../types/eventFeedbackEscalation";

describe("EventFeedbackEscalationService Unit Tests", () => {
  let service: EventFeedbackEscalationService;

  beforeEach(() => {
    service = new EventFeedbackEscalationService();
    service.clear();
  });

  it("triggers escalation when completion rate is under 15% 24h post-event", async () => {
    const attendees: NonRespondentAttendee[] = [
      {
        userId: "u1",
        name: "Alice",
        email: "alice@campus.edu",
        checkedInAt: "2026-08-26T10:00:00Z",
        hasSubmittedFeedback: true,
        notificationSent: false,
      },
      {
        userId: "u2",
        name: "Bob",
        email: "bob@campus.edu",
        checkedInAt: "2026-08-26T10:05:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u3",
        name: "Charlie",
        email: "charlie@campus.edu",
        checkedInAt: "2026-08-26T10:10:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u4",
        name: "Diana",
        email: "diana@campus.edu",
        checkedInAt: "2026-08-26T10:15:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u5",
        name: "Evan",
        email: "evan@campus.edu",
        checkedInAt: "2026-08-26T10:20:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u6",
        name: "Frank",
        email: "frank@campus.edu",
        checkedInAt: "2026-08-26T10:25:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u7",
        name: "Grace",
        email: "grace@campus.edu",
        checkedInAt: "2026-08-26T10:30:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u8",
        name: "Hank",
        email: "hank@campus.edu",
        checkedInAt: "2026-08-26T10:35:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u9",
        name: "Ivy",
        email: "ivy@campus.edu",
        checkedInAt: "2026-08-26T10:40:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u10",
        name: "Jack",
        email: "jack@campus.edu",
        checkedInAt: "2026-08-26T10:45:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
    ]; // 1 out of 10 = 10% (< 15%)

    service.registerAttendees("event-hackathon", attendees);
    service.getOrCreateClubPool("club-cs", "Computer Science Club", 5000);

    const result = await service.evaluateEventFeedbackCompletion(
      "event-hackathon",
      "AI & Web3 Hackathon",
      "club-cs",
      "Computer Science Club",
      "2026-08-26T00:00:00Z",
    );

    expect(result.isEscalationTriggered).toBe(true);
    expect(result.completionRatePercent).toBe(10);
    expect(result.rewardPoints).toBe(200); // Increased from 50 to 200
    expect(result.nonRespondentsNotified).toBe(9);
    expect(result.clubPointsDeducted).toBe(9 * 150); // 1350 extra points escrowed

    const activeEscalation = service.getActiveEscalation("event-hackathon");
    expect(activeEscalation?.status).toBe("ESCALATED");
    expect(activeEscalation?.currentRewardPoints).toBe(200);

    // Verify push notifications were queued
    const notifs = service.getDispatchedNotifications();
    expect(notifs).toHaveLength(9);
    expect(notifs[0].message).toContain(
      "URGENT: We need your feedback! The reward has been quadrupled to 200 points for the next 4 hours!",
    );
  });

  it("does not trigger escalation when completion rate is >= 15%", async () => {
    const attendees: NonRespondentAttendee[] = [
      {
        userId: "u1",
        name: "Alice",
        email: "alice@campus.edu",
        checkedInAt: "2026-08-26T10:00:00Z",
        hasSubmittedFeedback: true,
        notificationSent: false,
      },
      {
        userId: "u2",
        name: "Bob",
        email: "bob@campus.edu",
        checkedInAt: "2026-08-26T10:05:00Z",
        hasSubmittedFeedback: true,
        notificationSent: false,
      },
      {
        userId: "u3",
        name: "Charlie",
        email: "charlie@campus.edu",
        checkedInAt: "2026-08-26T10:10:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u4",
        name: "Diana",
        email: "diana@campus.edu",
        checkedInAt: "2026-08-26T10:15:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u5",
        name: "Evan",
        email: "evan@campus.edu",
        checkedInAt: "2026-08-26T10:20:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
    ]; // 2 out of 5 = 40% (>= 15%)

    service.registerAttendees("event-gaming", attendees);
    service.getOrCreateClubPool("club-esports", "Esports Society", 5000);

    const result = await service.evaluateEventFeedbackCompletion(
      "event-gaming",
      "Esports LAN Tournament",
      "club-esports",
      "Esports Society",
      "2026-08-26T00:00:00Z",
    );

    expect(result.isEscalationTriggered).toBe(false);
    expect(result.completionRatePercent).toBe(40);
    expect(result.rewardPoints).toBe(50);
    expect(result.clubPointsDeducted).toBe(0);
    expect(service.getDispatchedNotifications()).toHaveLength(0);
  });

  it("awards 200 escalated points during active window and deducts from club ledger", async () => {
    const attendees: NonRespondentAttendee[] = [
      {
        userId: "u_test",
        name: "Sam",
        email: "sam@campus.edu",
        checkedInAt: "2026-08-26T10:00:00Z",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
    ];
    service.registerAttendees("event-workshop", attendees);
    service.getOrCreateClubPool("club-design", "Design Guild", 2000);

    await service.evaluateEventFeedbackCompletion(
      "event-workshop",
      "Figma Masterclass",
      "club-design",
      "Design Guild",
      "2026-08-26T00:00:00Z",
    );

    const claim = await service.submitFeedback("event-workshop", "u_test");
    expect(claim.pointsAwarded).toBe(200);
    expect(claim.status).toBe("ESCALATED_REWARD_CLAIMED");

    const logs = service.getDeductionLogsByClub("club-design");
    expect(logs).toHaveLength(1);
    expect(logs[0].pointsDeducted).toBe(150);
  });
});
