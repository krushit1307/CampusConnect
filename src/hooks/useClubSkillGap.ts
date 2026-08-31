import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import type { SkillGapData } from "@/components/Clubs/SkillGapAnalyzer";

/**
 * Fetches the Executive Board Skill Gap Analysis for a club.
 * Calls the `get_skill_gap_analysis` RPC which aggregates admin skills
 * and compares them against the "Healthy Board" heuristic matrix.
 */
export function useClubSkillGap(clubId: string | undefined, enabled = true) {
  const supabase = createClient();

  return useQuery<SkillGapData | null>({
    queryKey: ["clubSkillGap", clubId],
    queryFn: async () => {
      if (!clubId) return null;

      const { data, error } = await supabase.rpc("get_skill_gap_analysis", {
        p_club_id: clubId,
      });

      if (error) {
        console.error("[useClubSkillGap] RPC failed:", error);
        throw error;
      }

      return data as SkillGapData;
    },
    enabled: !!clubId && enabled,
    staleTime: 1000 * 60 * 10, // 10 minutes — skills don't change often
    refetchOnWindowFocus: false,
  });
}
