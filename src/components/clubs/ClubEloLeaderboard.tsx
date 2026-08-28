import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Swords,
  Crown,
  Loader2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ClubElo {
  id: string;
  name: string;
  elo_rating: number;
}

interface EloMatch {
  id: string;
  week_start: string;
  club_a_id: string;
  club_b_id: string;
  club_a_performance: number;
  club_b_performance: number;
  club_a_elo_before: number;
  club_a_elo_after: number;
  club_b_elo_before: number;
  club_b_elo_after: number;
  club_a: { name: string };
  club_b: { name: string };
}

export const ClubEloLeaderboard: React.FC = () => {
  const [clubs, setClubs] = useState<ClubElo[]>([]);
  const [recentMatches, setRecentMatches] = useState<EloMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: clubsData } = await supabase
        .from("clubs")
        .select("id, name, elo_rating")
        .order("elo_rating", { ascending: false })
        .limit(50);

      if (clubsData) setClubs(clubsData);

      const { data: matchesData } = await supabase
        .from("club_elo_matches")
        .select(
          `
          *,
          club_a:clubs!club_a_id(name),
          club_b:clubs!club_b_id(name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(10);

      if (matchesData) setRecentMatches(matchesData as unknown as EloMatch[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSimulateWeek = async () => {
    setSimulating(true);
    try {
      await supabase.functions.invoke("process-club-elo");
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <Swords className="h-8 w-8 text-indigo-500" />
            Global ELO Leaderboard
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-2xl">
            A zero-sum competitive ranking system. Host high-performing events (attendance ×
            reviews) to steal ELO from rival clubs.
          </p>
        </div>
        <Button
          onClick={handleSimulateWeek}
          disabled={simulating}
          className="bg-indigo-600 hover:bg-indigo-700 font-bold tracking-wider uppercase"
        >
          {simulating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Swords className="mr-2 h-4 w-4" />
          )}
          Simulate Week
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaderboard Table */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl">
            <CardHeader className="bg-slate-950/50 border-b border-slate-800">
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Top Rankings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Club</th>
                      <th className="px-6 py-4 text-right">ELO Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {clubs.map((club, index) => (
                      <tr key={club.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {index === 0 ? (
                            <Crown className="h-6 w-6 text-amber-500" />
                          ) : index === 1 ? (
                            <Crown className="h-6 w-6 text-slate-400" />
                          ) : index === 2 ? (
                            <Crown className="h-6 w-6 text-amber-700" />
                          ) : (
                            <span className="text-slate-500 font-mono font-bold pl-2">
                              #{index + 1}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-bold text-white">{club.name}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-bold text-lg">
                            {Math.round(club.elo_rating)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Match Feed */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="bg-slate-950/50 border-b border-slate-800">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-emerald-500" />
                Recent ELO Skirmishes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {recentMatches.length === 0 ? (
                <div className="text-center p-4 text-slate-500 text-sm font-mono">
                  No recent matches.
                </div>
              ) : (
                recentMatches.map((match) => {
                  const deltaA = match.club_a_elo_after - match.club_a_elo_before;
                  const deltaB = match.club_b_elo_after - match.club_b_elo_before;

                  return (
                    <div
                      key={match.id}
                      className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-sm"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-bold truncate max-w-[120px]">
                          {match.club_a?.name || "Club A"}
                        </span>
                        <span className="text-slate-600 font-mono text-xs">VS</span>
                        <span className="text-white font-bold truncate max-w-[120px] text-right">
                          {match.club_b?.name || "Club B"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center font-mono">
                        <div
                          className={`flex items-center gap-1 ${deltaA >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {deltaA >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {deltaA > 0 ? "+" : ""}
                          {deltaA.toFixed(1)}
                        </div>
                        <div
                          className={`flex items-center gap-1 ${deltaB >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {deltaB >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {deltaB > 0 ? "+" : ""}
                          {deltaB.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="bg-indigo-950/20 border-indigo-500/20 shadow-xl">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-xs text-indigo-200/80 leading-relaxed font-mono">
                  ELOs are calculated weekly. Clubs that host events steal ELO from rival clubs who
                  hosted inferior events in the same week. Base ELO starts at 1200.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Required missing import for Activity icon
import { Activity } from "lucide-react";
export default ClubEloLeaderboard;
