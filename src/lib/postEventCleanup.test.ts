import { describe, it, expect } from "vitest";
import {
  resolveCleanupTaskVisibility,
  buildPostEventCleanupNotification,
  canClaimCleanupTask,
  CleanupTask,
} from "./postEventCleanup";

describe("Implement Automated Post-Event Clean-Up Task Assignments Suite (#3884)", () => {
  const mockTask: CleanupTask = {
    id: "task_trash",
    eventId: "evt_hackathon",
    title: "Take out trash & pizza boxes",
    pointBounty: 500,
    maxVolunteers: 2,
    claimedVolunteersCount: 0,
    status: "hidden",
  };

  const pastEndTime = "2026-08-21T21:00:00Z";
  const futureEndTime = "2026-08-21T23:59:59Z";
  const now = new Date("2026-08-21T22:00:00Z");

  it("activates hidden cleanup tasks when current time reaches event end_time", () => {
    const activated = resolveCleanupTaskVisibility(mockTask, pastEndTime, now);
    expect(activated.status).toBe("active");

    const stillHidden = resolveCleanupTaskVisibility(mockTask, futureEndTime, now);
    expect(stillHidden.status).toBe("hidden");
  });

  it("builds push notification payload for checked-in attendees upon event conclusion", () => {
    const notif = buildPostEventCleanupNotification("Annual Hackathon", [mockTask]);

    expect(notif).not.toBeNull();
    expect(notif?.notificationPayload.title).toContain("Help Clean Up & Earn Points!");
    expect(notif?.notificationPayload.body).toContain("Earn up to 500 gamification points");
    expect(notif?.notificationPayload.actionUrl).toBe("/events/evt_hackathon/cleanup-board");
  });

  it("validates volunteer claim eligibility and capacity limits", () => {
    const activeTask: CleanupTask = { ...mockTask, status: "active" };

    expect(canClaimCleanupTask(activeTask, "usr_alice", [])).toBe(true);

    // Block duplicate claim
    expect(canClaimCleanupTask(activeTask, "usr_alice", ["task_trash"])).toBe(false);

    // Block when full
    const fullTask: CleanupTask = { ...activeTask, claimedVolunteersCount: 2 };
    expect(canClaimCleanupTask(fullTask, "usr_bob", [])).toBe(false);
  });
});
