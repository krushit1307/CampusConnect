import { createClient } from "@/lib/supabase/client";

export interface SkillCount {
  skill: string;
  count: number;
}

export interface HeuristicMatrix {
  [skillName: string]: number;
}

export const DEFAULT_HEURISTIC_MATRIX: HeuristicMatrix = {
  Finance: 1,
  "Graphic Design": 1,
  Logistics: 1,
  Marketing: 1,
  Communications: 1,
};

export class ClubSkillGapService {
  /**
   * Fetches the aggregated skills of all club administrators
   */
  static async getBoardSkills(clubId: string): Promise<SkillCount[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_club_board_skills", {
      p_club_id: clubId,
    });

    if (error) {
      console.error("[ClubSkillGapService] Error fetching board skills:", error);
      throw error;
    }

    return (data as SkillCount[]) || [];
  }

  /**
   * Calculates the skill gaps based on the current skills and the heuristic matrix
   */
  static calculateGaps(
    currentSkills: SkillCount[],
    heuristic: HeuristicMatrix = DEFAULT_HEURISTIC_MATRIX,
  ): { skill: string; gap: number; current: number; required: number }[] {
    const currentMap = new Map<string, number>();

    // Normalize skills to lowercase for case-insensitive comparison
    for (const sc of currentSkills) {
      currentMap.set(sc.skill.toLowerCase(), sc.count);
    }

    const gaps = [];
    for (const [requiredSkill, requiredCount] of Object.entries(heuristic)) {
      const normalizedReq = requiredSkill.toLowerCase();

      // Some members might have slightly different names for their skills,
      // but we assume exact matches here as skills are 'verified skills' and standardized.
      const current = currentMap.get(normalizedReq) ?? 0;

      if (current < requiredCount) {
        gaps.push({
          skill: requiredSkill,
          gap: requiredCount - current,
          current,
          required: requiredCount,
        });
      }
    }

    // Sort by gap size descending, then alphabetically by skill name
    gaps.sort((a, b) => {
      if (b.gap !== a.gap) return b.gap - a.gap;
      return a.skill.localeCompare(b.skill);
    });

    return gaps;
  }
}
