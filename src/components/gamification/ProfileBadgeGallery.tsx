// =============================================================================
// Component: ProfileBadgeGallery
// Issue: #3171 - Develop a 'Custom Interactive Badges' Editor
// Description: Renders a user's earned badges on their profile using the
// dynamic, JSON-driven DynamicBadge component. Matches each earned badge
// (user_badges.badge_name) to a published Badge Studio design by title, and
// falls back to a simple label for legacy badges with no matching design.
// =============================================================================

import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import Award from "lucide-react/dist/esm/icons/award";
import { DynamicBadge } from "./DynamicBadge";

interface ProfileBadgeGalleryProps {
  userId: string;
}

export function ProfileBadgeGallery({ userId }: ProfileBadgeGalleryProps) {
  const supabase = createClient();

  const { data: earnedBadges = [] } = useQuery({
    queryKey: ["profileBadges", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_badges")
        .select("id, badge_name")
        .eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: designedBadges = [] } = useQuery({
    queryKey: ["gamification_badges", "published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gamification_badges" as any)
        .select("title, svg_payload_json")
        .eq("is_published", true);
      if (error) throw error;
      return (data || []) as { title: string; svg_payload_json: unknown }[];
    },
  });

  if (earnedBadges.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
        <Award size={24} className="text-lime" />
        <h2>Badges</h2>
      </div>
      <div className="flex flex-wrap gap-4">
        {earnedBadges.map((badge) => {
          const design = designedBadges.find((d) => d.title === badge.badge_name);
          return (
            <div key={badge.id} className="flex flex-col items-center gap-1 w-20">
              {design ? (
                <DynamicBadge payload={design.svg_payload_json} title={badge.badge_name} size={64} />
              ) : (
                <span className="bg-black text-lime neu-border px-2 py-1 font-mono text-xs font-bold uppercase">
                  🏅
                </span>
              )}
              <p className="text-xs text-center font-mono">{badge.badge_name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}