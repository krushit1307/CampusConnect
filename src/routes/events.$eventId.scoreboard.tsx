import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { ScoreData } from "@/types/scoreboard";
import { Button } from "@/components/ui/button";
import { Plus, Minus, ArrowLeft, Play, Pause, Square } from "lucide-react";
import { toast } from "sonner";

export default function EventScoreboardDashboard() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();

  const [scoreData, setScoreData] = useState<ScoreData>({
    homeTeam: "Home",
    awayTeam: "Away",
    homeScore: 0,
    awayScore: 0,
    status: "not_started",
    updatedAt: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const fetchScore = async () => {
      try {
        const { data, error } = await supabase
          .from("events")
          .select("score_data, title")
          .eq("id", eventId)
          .single();

        if (error) throw error;
        if (data?.score_data) {
          setScoreData(data.score_data as unknown as ScoreData);
        }
      } catch (err: any) {
        toast.error("Failed to load scoreboard data.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchScore();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [eventId, supabase]);

  const updateScore = async (updates: Partial<ScoreData>) => {
    if (isOffline) {
      toast.error("You are offline. Cannot update score.");
      return;
    }

    setIsUpdating(true);
    const newScoreData = { ...scoreData, ...updates, updatedAt: new Date().toISOString() };

    // Optimistic update
    setScoreData(newScoreData);

    try {
      const { error } = await supabase
        .from("events")
        .update({ score_data: newScoreData as any })
        .eq("id", eventId);

      if (error) throw error;
    } catch (err: any) {
      toast.error("Failed to sync score update.");
      console.error(err);
      // Revert could be handled here if we tracked previous state
    } finally {
      setIsUpdating(false);
    }
  };

  const handleScoreChange = (team: "home" | "away", delta: number) => {
    const currentScore = team === "home" ? scoreData.homeScore : scoreData.awayScore;
    const newScore = Math.max(0, currentScore + delta); // Prevent negative scores
    updateScore(team === "home" ? { homeScore: newScore } : { awayScore: newScore });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/events/${eventId}/dashboard`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Referee Dashboard</h1>
        </div>
        {isOffline && (
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded border border-red-400">
            Offline Mode
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Status Controls */}
        <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-center gap-4">
          <Button
            variant={scoreData.status === "in_progress" ? "default" : "outline"}
            onClick={() => updateScore({ status: "in_progress" })}
            className="w-32"
          >
            <Play className="w-4 h-4 mr-2" /> Start/Resume
          </Button>
          <Button
            variant={scoreData.status === "paused" ? "secondary" : "outline"}
            onClick={() => updateScore({ status: "paused" })}
            className="w-32"
          >
            <Pause className="w-4 h-4 mr-2" /> Pause
          </Button>
          <Button
            variant={scoreData.status === "finished" ? "destructive" : "outline"}
            onClick={() => updateScore({ status: "finished" })}
            className="w-32"
          >
            <Square className="w-4 h-4 mr-2" /> Finish
          </Button>
        </div>

        {/* Score Controls */}
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12 relative">
          {/* Divider */}
          <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-px bg-gray-200 -translate-x-1/2"></div>

          {/* Home Team */}
          <div className="flex flex-col items-center">
            <input
              type="text"
              value={scoreData.homeTeam}
              onChange={(e) => updateScore({ homeTeam: e.target.value })}
              className="text-2xl font-bold text-center border-b-2 border-transparent hover:border-gray-200 focus:border-primary focus:outline-none bg-transparent mb-6 w-full"
              placeholder="Home Team"
            />
            <div className="text-8xl font-black tabular-nums tracking-tighter mb-8 text-gray-900">
              {scoreData.homeScore}
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="icon"
                className="w-16 h-16 rounded-full"
                onClick={() => handleScoreChange("home", -1)}
                disabled={scoreData.homeScore === 0 || isUpdating}
              >
                <Minus className="w-8 h-8" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="w-16 h-16 rounded-full bg-primary"
                onClick={() => handleScoreChange("home", 1)}
                disabled={isUpdating}
              >
                <Plus className="w-8 h-8" />
              </Button>
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center">
            <input
              type="text"
              value={scoreData.awayTeam}
              onChange={(e) => updateScore({ awayTeam: e.target.value })}
              className="text-2xl font-bold text-center border-b-2 border-transparent hover:border-gray-200 focus:border-primary focus:outline-none bg-transparent mb-6 w-full"
              placeholder="Away Team"
            />
            <div className="text-8xl font-black tabular-nums tracking-tighter mb-8 text-gray-900">
              {scoreData.awayScore}
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="icon"
                className="w-16 h-16 rounded-full"
                onClick={() => handleScoreChange("away", -1)}
                disabled={scoreData.awayScore === 0 || isUpdating}
              >
                <Minus className="w-8 h-8" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="w-16 h-16 rounded-full bg-primary"
                onClick={() => handleScoreChange("away", 1)}
                disabled={isUpdating}
              >
                <Plus className="w-8 h-8" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
