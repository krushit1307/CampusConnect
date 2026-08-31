// =============================================================================
// Route: /leaderboard
// Issue: #3894 - Build a 'Real-Time Gamification Leaderboard'
// Description: Campus-wide leaderboard showcasing top active students and clubs.
// Features beautiful podium UI for top 3, tabs, and neubrutalist styling.
// =============================================================================

import { useState, useMemo, useEffect } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import {
  getTopUsersMonthlyLeaderboard,
  getTopClubsMonthlyLeaderboard,
} from "@/services/gamificationLeaderboardService";
import { computeUnderdogClubLeaderboard, getMockUnderdogClubData } from "@/services/underdogLeaderboardService";
import type { LeaderboardMode } from "@/types/underdogLeaderboard";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import Award from "lucide-react/dist/esm/icons/award";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Users from "lucide-react/dist/esm/icons/users";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import Zap from "lucide-react/dist/esm/icons/zap";
import Flame from "lucide-react/dist/esm/icons/flame";
import { UnderdogLeaderboardToggle } from "@/components/leaderboard/UnderdogLeaderboardToggle";
import { UnderdogCatchUpPanel } from "@/components/leaderboard/UnderdogCatchUpPanel";
import { createClient } from "@/lib/supabase/client";

export default function GamificationLeaderboard() {
  const [activeTab, setActiveTab] = useState<"students" | "clubs">("students");
  const [clubMode, setClubMode] = useState<LeaderboardMode>("underdog");

  // -----------------------------------------------------------------------
  // Underdog Catch-Up Engine: user multiplier + active bounty
  // -----------------------------------------------------------------------
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userMultiplier, setUserMultiplier] = useState<number>(1.0);
  const [activeBounty, setActiveBounty] = useState<{
    id: string;
    club_id: string;
    club_name?: string;
    target_checkins: number;
    current_checkins: number;
    reward_points: number;
    expires_at: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Fetch multiplier via RPC
      const { data: multiplierData } = await supabase
        .rpc("get_user_underdog_multiplier", { p_user_id: user.id });
      if (multiplierData != null) setUserMultiplier(Number(multiplierData));

      // Fetch the user's club active bounty (if any)
      const { data: memberRows } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", user.id)
        .eq("status", "approved");

      if (memberRows && memberRows.length > 0) {
        const clubIds = memberRows.map((r: { club_id: string }) => r.club_id);
        const { data: bountyRow } = await supabase
          .from("underdog_bounties")
          .select("id, club_id, target_checkins, current_checkins, reward_points, expires_at, clubs(name)")
          .in("club_id", clubIds)
          .is("claimed_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (bountyRow) {
          setActiveBounty({
            id: bountyRow.id,
            club_id: bountyRow.club_id,
            club_name: (bountyRow as any).clubs?.name,
            target_checkins: bountyRow.target_checkins,
            current_checkins: bountyRow.current_checkins,
            reward_points: bountyRow.reward_points,
            expires_at: bountyRow.expires_at,
          });
        }
      }
    })();
  }, []);

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["monthly_users_leaderboard"],
    queryFn: () => getTopUsersMonthlyLeaderboard(50),
    refetchInterval: 10000, // Refresh every 10 seconds for real-time feel
  });

  const { data: rawClubs = [], isLoading: loadingClubs } = useQuery({
    queryKey: ["monthly_clubs_leaderboard"],
    queryFn: async () => {
      const dbClubs = await getTopClubsMonthlyLeaderboard(50);
      return dbClubs && dbClubs.length > 0 ? dbClubs : getMockUnderdogClubData();
    },
    refetchInterval: 10000,
  });

  const processedClubs = useMemo(() => {
    return computeUnderdogClubLeaderboard(rawClubs, clubMode);
  }, [rawClubs, clubMode]);

  const isLoading = activeTab === "students" ? loadingUsers : loadingClubs;

  // The Underdog Catch-Up Panel is only shown to users whose multiplier > 1.0
  // (i.e. they are in the bottom 50% of the leaderboard).
  const showCatchUpPanel = userMultiplier > 1.0 && activeTab === "clubs";

  // Split top 3 for the podium
  const currentList = activeTab === "students" ? users : (processedClubs as any[]);
  const podiumEntries = currentList.slice(0, 3);
  const remainingEntries = currentList.slice(3);

  // Re-order podium entries so Rank 2 is Left, Rank 1 is Middle, Rank 3 is Right
  const second = podiumEntries.find((e) => e.rank_position === 2);
  const first = podiumEntries.find((e) => e.rank_position === 1);
  const third = podiumEntries.find((e) => e.rank_position === 3);

  return (
    <SiteShell>
      <div
        className="min-h-screen bg-cream px-4 py-12 md:px-6 lg:px-8 text-black"
        data-testid="leaderboard-container"
      >
        <div className="mx-auto max-w-5xl space-y-8">
          {/* Header Banner */}
          <div className="neu-border bg-purple-100 p-8 shadow-[4px_4px_0_0_#000] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <p className="eyebrow flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-purple-900">
                <Sparkles className="h-4 w-4 text-purple-700 animate-pulse" /> Real-Time Engagement Engine
              </p>
              <h1 className="font-display text-4xl font-black text-black md:text-5xl uppercase">
                Campus Leaderboard
              </h1>
              <p className="max-w-xl font-mono text-sm text-black/70">
                Showcasing active students earning gamification points, and clubs fostering the most
                per-capita engagement on campus this month!
              </p>
            </div>
            <div className="p-4 bg-white border-2 border-black shadow-[2px_2px_0_0_#000] font-mono text-xs flex items-center gap-2 self-start md:self-auto">
              <Award className="w-5 h-5 text-amber-500" />
              <div>
                <p className="font-bold uppercase">Monthly Cycle</p>
                <p className="text-[10px] text-gray-500">Resets in 9 days</p>
              </div>
            </div>
          </div>

          {/* Toggle Tabs */}
          <div className="flex gap-4 border-b-4 border-black pb-2">
            <button
              onClick={() => setActiveTab("students")}
              className={`px-6 py-2.5 font-mono text-sm font-black uppercase transition-all neu-border ${
                activeTab === "students"
                  ? "bg-black text-cream shadow-none translate-y-0.5"
                  : "bg-white text-black hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000]"
              }`}
            >
              🧑‍🎓 Top Students
            </button>
            <button
              onClick={() => setActiveTab("clubs")}
              className={`px-6 py-2.5 font-mono text-sm font-black uppercase transition-all neu-border flex items-center gap-2 ${
                activeTab === "clubs"
                  ? "bg-black text-cream shadow-none translate-y-0.5"
                  : "bg-white text-black hover:-translate-y-0.5 shadow-[2px_2px_0_0_#000]"
              }`}
            >
              🏛 Top Clubs {clubMode === "underdog" && <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />}
            </button>
          </div>

          {/* Underdog Multiplier Mode Toggle (Visible when Clubs tab is active) */}
          {activeTab === "clubs" && (
            <UnderdogLeaderboardToggle mode={clubMode} onModeChange={setClubMode} />
          )}

          {/* Underdog Catch-Up Panel – shown only for boosted members in clubs tab */}
          {showCatchUpPanel && (
            <UnderdogCatchUpPanel
              multiplier={userMultiplier}
              activeBounty={activeBounty}
              data-testid="underdog-catchup-panel"
            />
          )}

          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Podium Section */}
              {podiumEntries.length > 0 && (
                <div
                  className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-end max-w-3xl mx-auto"
                  data-testid="leaderboard-podium"
                >
                  {/* Rank 2 (Silver) */}
                  {second ? (
                    <div className="flex flex-col items-center order-2 md:order-1">
                      <div className="w-16 h-16 rounded-full border-2 border-black overflow-hidden bg-white mb-2 shadow-[2px_2px_0_0_#000]">
                        <img
                          src={
                            activeTab === "students"
                              ? second.avatar_url || "/placeholder-avatar.png"
                              : second.logo_url || "/placeholder-logo.png"
                          }
                          alt={
                            activeTab === "students"
                              ? `${second.first_name} ${second.last_name}`
                              : second.club_name
                          }
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="font-mono font-black text-sm text-center line-clamp-1">
                        {activeTab === "students"
                          ? `${second.first_name} ${second.last_name}`
                          : second.club_name}
                      </p>
                      {activeTab === "clubs" && second.underdog_multiplier && (
                        <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded border border-black my-1">
                          ⚡ {second.underdog_multiplier}× Underdog Boost
                        </span>
                      )}
                      <div className="w-full bg-[#e2e8f0] neu-border shadow-[4px_4px_0_0_#000] p-4 text-center mt-2 h-28 flex flex-col justify-center">
                        <span className="font-mono text-xs font-bold text-gray-700 uppercase">
                          2nd Place
                        </span>
                        <h4 className="font-black text-xl font-mono text-gray-800">
                          {activeTab === "students"
                            ? `${second.monthly_points} pts`
                            : `${clubMode === "underdog" ? second.adjusted_score : second.raw_points} pts`}
                        </h4>
                      </div>
                    </div>
                  ) : (
                    <div className="order-2 md:order-1" />
                  )}

                  {/* Rank 1 (Gold) */}
                  {first ? (
                    <div className="flex flex-col items-center order-1 md:order-2">
                      <div className="relative">
                        <Trophy className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-amber-500 animate-bounce" />
                        <div className="w-20 h-20 rounded-full border-4 border-amber-500 overflow-hidden bg-white mb-2 shadow-[2px_2px_0_0_#000]">
                          <img
                            src={
                              activeTab === "students"
                                ? first.avatar_url || "/placeholder-avatar.png"
                                : first.logo_url || "/placeholder-logo.png"
                            }
                            alt={
                              activeTab === "students"
                                ? `${first.first_name} ${first.last_name}`
                                : first.club_name
                            }
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <p className="font-mono font-black text-base text-center line-clamp-1">
                        {activeTab === "students"
                          ? `${first.first_name} ${first.last_name}`
                          : first.club_name}
                      </p>
                      {activeTab === "clubs" && first.underdog_multiplier && (
                        <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-300 px-1.5 py-0.5 rounded border border-black my-1">
                          ⚡ {first.underdog_multiplier}× Underdog Boost
                        </span>
                      )}
                      <div className="w-full bg-[#fef08a] neu-border border-amber-500 shadow-[4px_4px_0_0_#000] p-5 text-center mt-2 h-36 flex flex-col justify-center">
                        <span className="font-mono text-xs font-black text-amber-800 uppercase flex items-center justify-center gap-1">
                          👑 CHAMPION
                        </span>
                        <h4 className="font-black text-2xl font-mono text-amber-950">
                          {activeTab === "students"
                            ? `${first.monthly_points} pts`
                            : `${clubMode === "underdog" ? first.adjusted_score : first.raw_points} pts`}
                        </h4>
                      </div>
                    </div>
                  ) : (
                    <div className="order-1 md:order-2" />
                  )}

                  {/* Rank 3 (Bronze) */}
                  {third ? (
                    <div className="flex flex-col items-center order-3">
                      <div className="w-16 h-16 rounded-full border-2 border-black overflow-hidden bg-white mb-2 shadow-[2px_2px_0_0_#000]">
                        <img
                          src={
                            activeTab === "students"
                              ? third.avatar_url || "/placeholder-avatar.png"
                              : third.logo_url || "/placeholder-logo.png"
                          }
                          alt={
                            activeTab === "students"
                              ? `${third.first_name} ${third.last_name}`
                              : third.club_name
                          }
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="font-mono font-black text-sm text-center line-clamp-1">
                        {activeTab === "students"
                          ? `${third.first_name} ${third.last_name}`
                          : third.club_name}
                      </p>
                      {activeTab === "clubs" && third.underdog_multiplier && (
                        <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-200 px-1.5 py-0.5 rounded border border-black my-1">
                          ⚡ {third.underdog_multiplier}× Underdog Boost
                        </span>
                      )}
                      <div className="w-full bg-[#ffedd5] neu-border shadow-[4px_4px_0_0_#000] p-4 text-center mt-2 h-24 flex flex-col justify-center">
                        <span className="font-mono text-xs font-bold text-orange-700 uppercase">
                          3rd Place
                        </span>
                        <h4 className="font-black text-lg font-mono text-orange-950">
                          {activeTab === "students"
                            ? `${third.monthly_points} pts`
                            : `${clubMode === "underdog" ? third.adjusted_score : third.raw_points} pts`}
                        </h4>
                      </div>
                    </div>
                  ) : (
                    <div className="order-3" />
                  )}
                </div>
              )}

              {/* Ranks 4 to 50 List */}
              <div className="pt-8">
                <div className="neu-border bg-white shadow-[4px_4px_0_0_#000] overflow-hidden">
                  <div className="bg-black text-cream p-4 font-mono text-xs font-bold uppercase tracking-wider grid grid-cols-12">
                    <div className="col-span-2 text-center">Rank</div>
                    <div className="col-span-6 md:col-span-6">Name / Club</div>
                    <div className="col-span-4 md:col-span-4 text-right">
                      {activeTab === "clubs" && clubMode === "underdog"
                        ? "Score (Underdog Boost)"
                        : "Points Earned"}
                    </div>
                  </div>

                  <div className="divide-y divide-black" data-testid="leaderboard-list">
                    {remainingEntries.length > 0 ? (
                      remainingEntries.map((entry) => (
                        <div
                          key={activeTab === "students" ? entry.user_id : entry.club_id}
                          className="p-4 grid grid-cols-12 items-center hover:bg-slate-50 transition-colors font-mono text-sm"
                        >
                          <div className="col-span-2 text-center font-bold flex items-center justify-center gap-1">
                            <span>#{entry.rank_position}</span>
                            {activeTab === "clubs" && clubMode === "underdog" && entry.rank_delta > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1 rounded">
                                ↑+{entry.rank_delta}
                              </span>
                            )}
                          </div>

                          <div className="col-span-6 md:col-span-6 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full border border-black overflow-hidden shrink-0 bg-slate-100">
                              <img
                                src={
                                  activeTab === "students"
                                    ? entry.avatar_url || "/placeholder-avatar.png"
                                    : entry.logo_url || "/placeholder-logo.png"
                                }
                                alt={
                                  activeTab === "students"
                                    ? `${entry.first_name} ${entry.last_name}`
                                    : entry.club_name
                                }
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="truncate">
                              <p className="font-bold truncate">
                                {activeTab === "students"
                                  ? `${entry.first_name} ${entry.last_name}`
                                  : entry.club_name}
                              </p>
                              {activeTab === "clubs" && entry.member_count && (
                                <p className="text-[11px] text-gray-500 font-normal">
                                  {entry.member_count} members • {entry.per_capita_points} pts/mbr
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="col-span-4 md:col-span-4 text-right font-bold text-purple-700">
                            {activeTab === "students" ? (
                              `${entry.monthly_points} pts`
                            ) : clubMode === "underdog" ? (
                              <div className="space-y-0.5">
                                <div>{entry.adjusted_score} pts</div>
                                <div className="text-[10px] font-normal text-amber-700 dark:text-amber-400">
                                  ⚡ {entry.underdog_multiplier}× Multiplier
                                </div>
                              </div>
                            ) : (
                              `${entry.raw_points} pts`
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500 font-mono text-xs">
                        No other active participants found in this monthly cycle.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

