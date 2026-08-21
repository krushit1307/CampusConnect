// =============================================================================
// Hook: useGamificationBadges
// Issue: #3171 - Develop a 'Custom Interactive Badges' Editor
// Description: CRUD access to gamification_badges for the admin Badge Studio,
// and read-only access to published badges for public-facing rendering.
// =============================================================================

import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import type { BadgeComposition } from "@/lib/gamification/badgeComposer";

export interface GamificationBadge {
  id: string;
  title: string;
  description: string;
  svg_payload_json: BadgeComposition;
  is_published: boolean;
  created_at: string;
}

export function useGamificationBadges(publishedOnly = false) {
  const supabase = createClient();

  const { data: badges, isLoading, error, refetch } = useQuery({
    queryKey: ["gamification_badges", publishedOnly],
    queryFn: async () => {
      let query = supabase.from("gamification_badges" as any).select("*").order("created_at", { ascending: false });
      if (publishedOnly) query = query.eq("is_published", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as GamificationBadge[];
    },
  });

  const createBadge = useMutation({
    mutationFn: async (badge: { title: string; description: string; svg_payload_json: BadgeComposition }) => {
      const { error } = await supabase.from("gamification_badges" as any).insert(badge);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const { error } = await supabase
        .from("gamification_badges" as any)
        .update({ is_published: isPublished })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const deleteBadge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gamification_badges" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  return { badges: badges || [], isLoading, error, createBadge, togglePublish, deleteBadge };
}