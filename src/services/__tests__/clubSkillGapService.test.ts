import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClubSkillGapService, DEFAULT_HEURISTIC_MATRIX } from "../clubSkillGapService";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";

describe("ClubSkillGapService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBoardSkills()", () => {
    it("should call get_club_board_skills RPC and return data", async () => {
      const mockData = [
        { skill: "Marketing", count: 2 },
        { skill: "Finance", count: 1 },
      ];

      const mockRpc = vi.fn().mockResolvedValue({ data: mockData, error: null });
      (createClient as any).mockReturnValue({ rpc: mockRpc });

      const result = await ClubSkillGapService.getBoardSkills("test-club-123");

      expect(mockRpc).toHaveBeenCalledWith("get_club_board_skills", { p_club_id: "test-club-123" });
      expect(result).toEqual(mockData);
    });

    it("should throw error if RPC fails", async () => {
      const mockError = new Error("Database connection failed");
      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: mockError });

      (createClient as any).mockReturnValue({ rpc: mockRpc });

      await expect(ClubSkillGapService.getBoardSkills("test-club-123")).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("calculateGaps()", () => {
    it("should return no gaps if current skills meet or exceed heuristic", () => {
      const currentSkills = [
        { skill: "Finance", count: 2 },
        { skill: "Graphic Design", count: 1 },
        { skill: "Logistics", count: 3 },
        { skill: "Marketing", count: 1 },
        { skill: "Communications", count: 1 },
      ];

      const gaps = ClubSkillGapService.calculateGaps(currentSkills);
      expect(gaps).toHaveLength(0);
    });

    it("should return gaps for missing skills", () => {
      const currentSkills = [
        { skill: "Finance", count: 1 },
        { skill: "Logistics", count: 1 },
      ];

      const gaps = ClubSkillGapService.calculateGaps(currentSkills);
      expect(gaps).toHaveLength(3);

      // Sorted by gap size, then alphabetically
      expect(gaps).toEqual([
        { skill: "Communications", gap: 1, current: 0, required: 1 },
        { skill: "Graphic Design", gap: 1, current: 0, required: 1 },
        { skill: "Marketing", gap: 1, current: 0, required: 1 },
      ]);
    });

    it("should handle case insensitivity", () => {
      const currentSkills = [
        { skill: "fInAnCe", count: 1 },
        { skill: "gRaPhIc dEsIgN", count: 1 },
        { skill: "LOGISTICS", count: 1 },
      ];

      const gaps = ClubSkillGapService.calculateGaps(currentSkills);
      expect(gaps).toHaveLength(2); // Marketing and Communications missing

      expect(gaps.map((g) => g.skill).sort()).toEqual(["Communications", "Marketing"]);
    });

    it("should allow custom heuristic matrices", () => {
      const customHeuristic = {
        Photography: 2,
        "Project Management": 1,
      };

      const currentSkills = [{ skill: "Photography", count: 1 }];

      const gaps = ClubSkillGapService.calculateGaps(currentSkills, customHeuristic);
      expect(gaps).toHaveLength(2);

      expect(gaps).toEqual([
        { skill: "Photography", gap: 1, current: 1, required: 2 },
        { skill: "Project Management", gap: 1, current: 0, required: 1 },
      ]);
    });
  });
});
