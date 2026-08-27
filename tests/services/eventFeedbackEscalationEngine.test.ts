import { describe, it, expect, beforeEach } from "vitest";
import { EventFeedbackEscalationService } from "../../src/services/eventFeedbackEscalationService";

describe("EventFeedbackEscalationEngine Integration Tests", () => {
  let service: EventFeedbackEscalationService;

  beforeEach(() => {
    service = new EventFeedbackEscalationService();
    service.clear();
  });

  it("manages multiple simultaneous event escalations and isolated club treasuries", async () => {
    // Setup Club Alpha & Event 1
    service.registerAttendees("ev-1", [
      {
        userId: "u1",
        name: "User 1",
        email: "u1@test.com",
        checkedInAt: "2026-08-26",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
      {
        userId: "u2",
        name: "User 2",
        email: "u2@test.com",
        checkedInAt: "2026-08-26",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
    ]);
    const poolAlpha = service.getOrCreateClubPool("club-alpha", "Alpha Society", 3000);

    // Setup Club Beta & Event 2
    service.registerAttendees("ev-2", [
      {
        userId: "u3",
        name: "User 3",
        email: "u3@test.com",
        checkedInAt: "2026-08-26",
        hasSubmittedFeedback: false,
        notificationSent: false,
      },
    ]);
    const poolBeta = service.getOrCreateClubPool("club-beta", "Beta Society", 4000);

    const res1 = await service.evaluateEventFeedbackCompletion(
      "ev-1",
      "Event One",
      "club-alpha",
      "Alpha Society",
      "2026-08-26T00:00:00Z",
    );
    const res2 = await service.evaluateEventFeedbackCompletion(
      "ev-2",
      "Event Two",
      "club-beta",
      "Beta Society",
      "2026-08-26T00:00:00Z",
    );

    expect(res1.isEscalationTriggered).toBe(true);
    expect(res2.isEscalationTriggered).toBe(true);

    expect(poolAlpha.availableBalance).toBe(3000 - 300); // 2 * 150
    expect(poolBeta.availableBalance).toBe(4000 - 150); // 1 * 150

    expect(service.getDispatchedNotifications()).toHaveLength(3);
  });
});
