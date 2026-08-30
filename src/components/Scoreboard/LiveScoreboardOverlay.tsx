import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScoreData } from "@/types/scoreboard";
import { Trophy, Clock, AlertCircle } from "lucide-react";

interface LiveScoreboardOverlayProps {
  eventId: string;
  initialScoreData?: ScoreData | null;
}

export function LiveScoreboardOverlay({ eventId, initialScoreData }: LiveScoreboardOverlayProps) {
  const [scoreData, setScoreData] = useState<ScoreData | null>(initialScoreData || null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (!initialScoreData) {
      // Fetch initial if not provided
      const fetchScore = async () => {
        try {
          const { data, error: fetchErr } = await supabase
            .from("events")
            .select("score_data")
            .eq("id", eventId)
            .single();
          if (fetchErr) throw fetchErr;
          if (data?.score_data) {
            setScoreData(data.score_data as unknown as ScoreData);
          }
        } catch (err: any) {
          console.error("Failed to fetch initial score:", err);
          setError("Failed to load live score");
        }
      };
      fetchScore();
    }
  }, [eventId, initialScoreData, supabase]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setError(null);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const channel = supabase
      .channel(`scoreboard-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.new && payload.new.score_data) {
            setScoreData(payload.new.score_data as unknown as ScoreData);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setError(null);
        } else if (status === "CHANNEL_ERROR") {
          setError("Live updates unavailable");
        }
      });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  if (!scoreData) return null; // Only show if score data is active

  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-4 md:p-6 w-full max-w-lg mx-auto relative overflow-hidden neu-border">
      {/* Offline/Error Indicators */}
      {(isOffline || error) && (
        <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-2 z-10">
          <AlertCircle className="w-3 h-3" />
          {isOffline ? "Offline - Showing last known score" : error}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4 pt-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-sm uppercase tracking-wider">Live Score</span>
        </div>
        <div className="flex items-center gap-2">
          {scoreData.status === "in_progress" && (
            <div className="flex items-center gap-1.5 text-green-400 text-xs font-bold animate-pulse">
              <div className="w-2 h-2 rounded-full bg-green-400"></div>
              LIVE
            </div>
          )}
          {scoreData.status === "paused" && (
            <div className="text-yellow-400 text-xs font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> PAUSED
            </div>
          )}
          {scoreData.status === "finished" && (
            <div className="text-slate-400 text-xs font-bold">FINAL</div>
          )}
        </div>
      </div>

      {/* Score Display */}
      <div className="flex items-center justify-between gap-4">
        {/* Home Team */}
        <div className="flex-1 text-center">
          <div className="text-sm md:text-base font-bold text-slate-300 truncate mb-2">
            {scoreData.homeTeam}
          </div>
          <div className="text-5xl md:text-7xl font-black tabular-nums tracking-tighter leading-none">
            {scoreData.homeScore}
          </div>
        </div>

        {/* Divider */}
        <div className="flex flex-col items-center justify-center text-slate-500">
          <div className="text-2xl font-black mb-1">-</div>
        </div>

        {/* Away Team */}
        <div className="flex-1 text-center">
          <div className="text-sm md:text-base font-bold text-slate-300 truncate mb-2">
            {scoreData.awayTeam}
          </div>
          <div className="text-5xl md:text-7xl font-black tabular-nums tracking-tighter leading-none">
            {scoreData.awayScore}
          </div>
        </div>
      </div>
    </div>
  );
}
