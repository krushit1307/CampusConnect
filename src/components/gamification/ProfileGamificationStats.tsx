import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Trophy, TrendingUp } from "lucide-react";

interface ProfileGamificationStatsProps {
  userId: string;
  isOwnProfile: boolean;
}

export function ProfileGamificationStats({ userId, isOwnProfile }: ProfileGamificationStatsProps) {
  const supabase = createClient();

  const { data: scores, isLoading } = useQuery({
    queryKey: ["userScores", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_scores", { p_user_id: userId }).single();
      if (error) throw error;
      return data as { active_score: number; lifetime_score: number };
    },
    enabled: !!userId,
  });

  if (isLoading || !scores) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b-2 border-black pb-2 text-xl font-bold font-display">
        <Trophy size={24} className="text-yellow-500" />
        <h2>Gamification Stats</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Active Score (Publicly relevant for Leaderboards) */}
        <div className="neu-border bg-peach p-6 flex items-center justify-between">
          <div>
            <p className="font-mono text-sm text-gray-700 font-bold uppercase">Active Score</p>
            <p className="font-display text-4xl font-black mt-1">{scores.active_score}</p>
          </div>
          <TrendingUp size={48} className="text-black opacity-20" />
        </div>

        {/* Lifetime Score (Private Badge of Honor) */}
        {isOwnProfile && (
          <div className="neu-border bg-lime/20 p-6 flex items-center justify-between border-2 border-dashed border-black">
            <div>
              <p className="font-mono text-sm text-gray-700 font-bold uppercase">Lifetime Score</p>
              <p className="font-display text-4xl font-black mt-1 text-lime-700">
                {scores.lifetime_score}
              </p>
              <p className="font-mono text-xs text-gray-500 mt-2 max-w-[200px]">
                Your all-time ConnectCoins earned. This is only visible to you.
              </p>
            </div>
            <Trophy size={48} className="text-lime-600 opacity-20" />
          </div>
        )}
      </div>
    </div>
  );
}
