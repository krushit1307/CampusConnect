import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ReferralLinkGenerator } from "@/components/referrals/ReferralLinkGenerator";
import { ReferralStats } from "@/components/referrals/ReferralStats";
import { ReferralCard, type Referral } from "@/components/referrals/ReferralCard";

export default function ReferralDashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: referrals } = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, referral_rewarded, created_at")
        .eq("referred_by_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Referral[];
    },
    enabled: !!user,
  });

  const { data: gamificationPoints } = useQuery({
    queryKey: ["gamification_points", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gamification_points")
        .select("points")
        .eq("user_id", user?.id)
        .eq("reason", "referral_attendance");
      if (error) throw error;
      return data.reduce((sum, row) => sum + row.points, 0);
    },
    enabled: !!user,
  });

  if (!user)
    return <div className="p-8 text-center">Please log in to view your referral dashboard.</div>;

  const totalReferrals = referrals?.filter((r) => r.referral_rewarded).length || 0;
  const pendingReferrals = referrals?.filter((r) => !r.referral_rewarded).length || 0;
  const pointsEarned = gamificationPoints || 0;

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col gap-8">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-4xl font-black uppercase">My Referrals</h1>
        <Link
          to="/referrals/leaderboard"
          className="neu-border neu-press flex items-center gap-2 bg-yellow-400 font-bold px-4 py-2"
        >
          <Trophy size={18} /> View Leaderboard
        </Link>
      </div>

      {profile?.referral_code && <ReferralLinkGenerator referralCode={profile.referral_code} />}

      <ReferralStats
        totalReferrals={totalReferrals}
        pendingReferrals={pendingReferrals}
        pointsEarned={pointsEarned}
      />

      <div>
        <h2 className="text-2xl font-bold border-b-4 border-black pb-2 mb-4 uppercase inline-block">
          Invited Friends
        </h2>
        {!referrals || referrals.length === 0 ? (
          <div className="neu-border p-8 text-center bg-gray-50 text-gray-500 font-medium">
            You haven't referred anyone yet. Share your link to get started!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {referrals.map((referral) => (
              <ReferralCard key={referral.id} referral={referral} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
