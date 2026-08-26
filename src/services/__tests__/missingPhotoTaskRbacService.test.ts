import { describe, it, expect } from "vitest";
import {
  checkUserRbacPermission,
  resolveTargetRbacRole,
  dispatchPhotoChaserToTaskSystem,
  claimPhotoChaserWithRbacCheck,
  UserRbacRole,
} from "../missingPhotoTaskRbacService";

describe("Missing Photo Task Management & RBAC Service", () => {
  describe("checkUserRbacPermission", () => {
    it("authorizes media_lead, marketing_chair, event_organizer, club_officer, and admins", () => {
      expect(checkUserRbacPermission("media_lead")).toBe(true);
      expect(checkUserRbacPermission("marketing_chair")).toBe(true);
      expect(checkUserRbacPermission("event_organizer")).toBe(true);
      expect(checkUserRbacPermission("club_officer")).toBe(true);
      expect(checkUserRbacPermission("admin")).toBe(true);
    });

    it("denies unauthorized general_attendee role", () => {
      expect(checkUserRbacPermission("general_attendee")).toBe(false);
    });
  });

  describe("resolveTargetRbacRole", () => {
    it("prioritizes media_lead first, then marketing_chair, then event_organizer", () => {
      const roles1: UserRbacRole[] = ["event_organizer", "media_lead", "club_officer"];
      expect(resolveTargetRbacRole(roles1)).toBe("media_lead");

      const roles2: UserRbacRole[] = ["club_officer", "marketing_chair"];
      expect(resolveTargetRbacRole(roles2)).toBe("marketing_chair");

      const roles3: UserRbacRole[] = ["club_officer"];
      expect(resolveTargetRbacRole(roles3)).toBe("club_officer");
    });
  });

  describe("dispatchPhotoChaserToTaskSystem", () => {
    it("formats photo chaser task with 48h deadline and target role", () => {
      const task = dispatchPhotoChaserToTaskSystem("evt-gala", "Spring Gala", ["media_lead"]);

      expect(task.id).toBe("task-photo-chaser-evt-gala");
      expect(task.eventId).toBe("evt-gala");
      expect(task.eventTitle).toBe("Spring Gala");
      expect(task.assignedRole).toBe("media_lead");
      expect(task.bountyPoints).toBe(150);
      expect(task.bountyXp).toBe(100);
      expect(task.status).toBe("pending");
    });
  });

  describe("claimPhotoChaserWithRbacCheck", () => {
    it("rejects bounty claim from unauthorized general_attendee role", async () => {
      const result = await claimPhotoChaserWithRbacCheck(
        "task-123",
        "evt-99",
        "https://example.com/poster.jpg",
        "user-unauth",
        "general_attendee"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNAUTHORIZED_ROLE");
      expect(result.pointsAwarded).toBe(0);
      expect(result.message).toContain("lacks RBAC permission");
    });

    it("successfully claims bounty for authorized media_lead role", async () => {
      const result = await claimPhotoChaserWithRbacCheck(
        "task-123",
        "evt-99",
        "https://example.com/poster.jpg",
        "user-media",
        "media_lead"
      );

      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(150);
      expect(result.xpAwarded).toBe(100);
      expect(result.badgeUnlocked).toBe("Visual Maestro 📸");
    });
  });
});
