import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MapPin, Trophy, Navigation, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useSupabaseSubscription } from "@/hooks/useSupabaseSubscription";

interface ScavengerHuntWidgetProps {
  eventId: string;
}

interface ClueData {
  success: boolean;
  message?: string;
  is_completed?: boolean;
  completed_steps?: number;
  total_steps?: number;
  clue_text?: string;
}

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string;
  completed_steps: number;
  last_completed_at: string;
}

export const ScavengerHuntWidget: React.FC<ScavengerHuntWidgetProps> = ({ eventId }) => {
  const [supabase] = useState(() => createClient());
  const [clueData, setClueData] = useState<ClueData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("get_current_scavenger_hunt_clue", {
        p_event_id: eventId,
      });

      if (rpcError) throw rpcError;
      setClueData(data as ClueData);

      const { data: boardData, error: boardError } = await supabase.rpc(
        "get_scavenger_hunt_leaderboard",
        {
          p_event_id: eventId,
        },
      );

      if (boardError) throw boardError;
      setLeaderboard(boardData as LeaderboardEntry[]);
    } catch (err: any) {
      setError(err.message || "Failed to load scavenger hunt data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
  }, [eventId]);

  // Real-time leaderboard updates
  useSupabaseSubscription(
    {
      table: "hunt_progress",
      event: "*",
      filter: `event_id=eq.${eventId}`,
    },
    undefined,
    () => {
      // Re-fetch leaderboard on progress change
      supabase.rpc("get_scavenger_hunt_leaderboard", { p_event_id: eventId }).then(({ data }) => {
        if (data) setLeaderboard(data as LeaderboardEntry[]);
      });
    },
  );

  const handleVerifyLocation = () => {
    setVerifying(true);
    setError(null);
    setSuccessMsg(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setVerifying(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const { data, error: rpcError } = await supabase.rpc("verify_scavenger_hunt_location", {
            p_event_id: eventId,
            p_user_lat: latitude,
            p_user_lng: longitude,
          });

          if (rpcError) throw rpcError;

          if (data.success) {
            setSuccessMsg(data.message);
            // Re-fetch to get next clue
            await fetchState();
          } else {
            setError(data.message);
          }
        } catch (err: any) {
          setError(err.message || "Failed to verify location.");
        } finally {
          setVerifying(false);
        }
      },
      (geoError) => {
        setError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access to play."
            : "Failed to retrieve your location.",
        );
        setVerifying(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  if (loading) {
    return (
      <div className="p-6 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // If not a scavenger hunt (no total steps) or not authenticated (success=false), don't show the hunt widget if total_steps is undefined
  if (!clueData || clueData.total_steps === 0 || !clueData.success) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="p-6 bg-amber-50 border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono">
        <div className="flex items-center gap-3 border-b-2 border-black pb-4 mb-4">
          <MapPin className="w-6 h-6 text-amber-600" />
          <h2 className="text-xl font-bold uppercase text-amber-900">Scavenger Hunt</h2>
          <div className="ml-auto bg-amber-200 border-2 border-black px-3 py-1 text-sm font-bold">
            Step {clueData.completed_steps! + (clueData.is_completed ? 0 : 1)} /{" "}
            {clueData.total_steps}
          </div>
        </div>

        {clueData.is_completed ? (
          <div className="text-center py-6 space-y-4">
            <Trophy className="w-16 h-16 text-amber-500 mx-auto" />
            <h3 className="text-xl font-bold">Hunt Completed!</h3>
            <p className="text-sm">You have found all the clues and earned your reward points.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white border-2 border-black p-4 rounded-lg">
              <h4 className="text-xs uppercase font-bold text-gray-500 mb-2">Current Clue</h4>
              <p className="text-lg whitespace-pre-wrap">{clueData.clue_text}</p>
            </div>

            {error && (
              <div className="p-3 bg-rose-100 border-2 border-rose-500 text-rose-800 text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-100 border-2 border-emerald-500 text-emerald-800 text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {successMsg}
              </div>
            )}

            <button
              onClick={handleVerifyLocation}
              disabled={verifying}
              className="w-full bg-black text-white hover:bg-gray-800 transition-colors py-3 px-4 border-2 border-transparent focus:border-amber-400 font-bold uppercase flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying Location...
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  Verify My Location
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {leaderboard.length > 0 && (
        <div className="bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6 font-mono">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h3 className="font-bold uppercase">Live Leaderboard</h3>
          </div>
          <div className="space-y-3">
            {leaderboard.map((entry, idx) => (
              <div
                key={entry.user_id}
                className="flex items-center justify-between p-3 border-2 border-gray-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-500 w-4">{idx + 1}.</span>
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full border border-black"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-200 border border-black" />
                  )}
                  <span className="font-bold text-sm truncate max-w-[150px]">
                    {entry.full_name}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">
                    {entry.completed_steps} / {clueData.total_steps}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
