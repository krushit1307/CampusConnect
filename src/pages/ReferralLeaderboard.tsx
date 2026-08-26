import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { LeaderboardTable, type LeaderboardEntry } from "@/components/referrals/LeaderboardTable";

export default function ReferralLeaderboard() {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["referral_leaderboard"],
    queryFn: async () => {
      // Execute the leaderboard aggregation using Postgres RPC or a View.
      // Since we don't have an RPC yet, we can do it via a Supabase raw query or RPC.
      // For now, let's fetch profiles and referral_rewards and aggregate on the client
      // In a production app, we'd want a Postgres View for this: "SELECT ... GROUP BY ..."
      // We will emulate it by fetching rewards and grouping.

      const { data: rewards, error } = await supabase
        .from("referral_rewards")
        .select("points_awarded, referrer_id, profiles!referrer_id(id, full_name)");

      if (error) throw error;

      const aggMap = new Map<string, LeaderboardEntry>();

      rewards.forEach((r: any) => {
        const id = r.referrer_id;
        const name = r.profiles?.full_name || "Anonymous User";
        if (!aggMap.has(id)) {
          aggMap.set(id, { id, full_name: name, referrals: 0, points: 0 });
        }
        const entry = aggMap.get(id)!;
        entry.referrals += 1;
        entry.points += r.points_awarded;
      });

      const sorted = Array.from(aggMap.values()).sort(
        (a, b) => b.points - a.points || b.referrals - a.referrals,
      );
      return sorted;
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      <Link
        to="/referrals/dashboard"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-black font-medium w-fit"
      >
        <ArrowLeft size={16} /> Back to My Referrals
      </Link>

      <div className="flex items-center gap-4 border-b-4 border-black pb-4">
        <div className="p-3 bg-yellow-400 neu-border text-black">
          <Users size={32} />
        </div>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight">Top Promoters</h1>
          <p className="text-gray-600">
            The most influential students driving CampusConnect's growth.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-gray-500 font-bold animate-pulse">
          Loading Leaderboard...
        </div>
      ) : (
        <LeaderboardTable entries={leaderboard || []} />
      )}
    </div>
  );
}
