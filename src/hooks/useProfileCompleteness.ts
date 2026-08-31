import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  calculateProfileCompleteness,
  type ProfileCompletenessData,
} from "@/components/profile/ProgressRing";

interface ProfileCompletenessFields {
  avatar_url: string | null;
  bio: string | null;
  college: string | null;
  skills: string[] | null;
}

/**
 * Fetches the current user's profile row and derives a 0-100 completion
 * percentage using the same four criteria as the profile page ring (#2389).
 */
export function useProfileCompleteness(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-completeness", userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;

      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, bio, college, skills")
        .eq("id", userId)
        .single();

      const fields = (data ?? null) as ProfileCompletenessFields | null;
      const criteria: ProfileCompletenessData = {
        hasAvatar: !!fields?.avatar_url,
        hasBio: !!fields?.bio,
        hasMajor: !!fields?.college,
        hasInterests: !!fields?.skills?.length,
      };
      return calculateProfileCompleteness(criteria);
    },
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });
}
