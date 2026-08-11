import type { SupabaseClient } from "@supabase/supabase-js";

export const CLUB_PROFILE_STALE_TIME_MS = 1000 * 60 * 5;

export function getClubProfileQueryKey(slug: string) {
  return ["club", slug] as string[];
}

export function createClubProfileQueryOptions(supabase: SupabaseClient, slug: string) {
  return {
    queryKey: getClubProfileQueryKey(slug),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select(
          `
id, name, slug, description, github_repo_url, visibility, promo_video_url, primary_color, secondary_color,
          club_members (id, role, status, user_id, profiles (full_name, avatar_url, handle, bio)),
          events (id, title, event_date),
          club_tags (club_tag_labels (id, name))        `,
        )
        .eq("slug", slug)
        .eq("status", "approved")
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: CLUB_PROFILE_STALE_TIME_MS,
  };
}
