import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  scanAndGenerateMissingPhotoTasks,
  claimMissingPhotoBounty,
  getMockMissingPhotoTasks,
} from "../missingPhotoIncentiveService";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe("Automated Missing Photo Incentive Engine Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("scanAndGenerateMissingPhotoTasks", () => {
    it("detects events lacking cover images and generates incentive tasks with 150pt bounties", () => {
      const sampleEvents = [
        {
          id: "evt-photo-1",
          title: "Tech Summit 2026",
          cover_image_url: "https://images.unsplash.com/photo-tech.jpg",
          created_by: "org-1",
        },
        {
          id: "evt-no-photo-2",
          title: "Campus Hackathon 2026",
          cover_image_url: null, // Missing photo!
          created_by: "org-1",
        },
      ];

      const tasks = scanAndGenerateMissingPhotoTasks(sampleEvents, "org-1");

      expect(tasks.length).toBe(1);
      expect(tasks[0].eventId).toBe("evt-no-photo-2");
      expect(tasks[0].bountyPoints).toBe(150);
      expect(tasks[0].bountyXp).toBe(100);
      expect(tasks[0].status).toBe("pending");
    });

    it("returns empty task list if all events have cover photos", () => {
      const completeEvents = [
        {
          id: "evt-1",
          title: "Gala",
          cover_image_url: "https://photo.png",
        },
      ];

      const tasks = scanAndGenerateMissingPhotoTasks(completeEvents);
      expect(tasks.length).toBe(0);
    });
  });

  describe("claimMissingPhotoBounty", () => {
    it("updates event cover image and awards +150 gamification points to organizer", async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { gamification_points: 500 },
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === "events") return { update: mockUpdate };
        if (table === "profiles") return { select: mockSelect, update: mockUpdate };
        return {};
      });

      const result = await claimMissingPhotoBounty(
        "task-123",
        "evt-no-photo-2",
        "https://images.unsplash.com/new-uploaded-poster.jpg",
        "user-org-77"
      );

      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(150);
      expect(result.xpAwarded).toBe(100);
      expect(result.badgeUnlocked).toBe("Visual Maestro 📸");
      expect(result.newTotalPoints).toBe(650); // 500 + 150
    });

    it("throws error if valid photo URL is not provided", async () => {
      await expect(
        claimMissingPhotoBounty("task-123", "evt-1", "", "org-1")
      ).rejects.toThrow("Valid photo URL is required");
    });
  });

  describe("getMockMissingPhotoTasks", () => {
    it("returns baseline missing photo task for demonstration", () => {
      const tasks = getMockMissingPhotoTasks("evt-demo-123");
      expect(tasks.length).toBe(1);
      expect(tasks[0].eventId).toBe("evt-demo-123");
      expect(tasks[0].bountyPoints).toBe(150);
    });
  });
});
