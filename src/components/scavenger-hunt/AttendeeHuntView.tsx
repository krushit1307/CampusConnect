import { useState, useEffect, useCallback } from "react";
import {
  QrCode,
  MapPin,
  Trophy,
  Award,
  Sparkles,
  WifiOff,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import {
  getUserCurrentClue,
  submitClueScan,
  flushOfflineScans,
  getQueuedScans,
  type ClueItem,
} from "../../lib/scavengerHuntEngine";
import { createClient } from "../../lib/supabase/client";

export interface AttendeeHuntViewProps {
  huntId: string;
  userId: string;
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  current_clue_order: number;
  total_score: number;
  completed_at: string | null;
  duration_seconds: number | null;
}

export function AttendeeHuntView({ huntId, userId }: AttendeeHuntViewProps) {
  const [currentClue, setCurrentClue] = useState<ClueItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scannedCode, setScannedCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"clue" | "leaderboard">("clue");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  const fetchClue = useCallback(async () => {
    setIsLoading(true);
    const res = await getUserCurrentClue(huntId, userId);
    if (res.success && res.data) {
      setCurrentClue(res.data);
    }
    setIsLoading(false);
  }, [huntId, userId]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.rpc("get_scavenger_hunt_leaderboard", {
        p_hunt_id: huntId,
      });
      if (data) {
        setLeaderboard(data as LeaderboardEntry[]);
      }
    } catch {
      // ignore
    }
  }, [huntId]);

  useEffect(() => {
    fetchClue();
    fetchLeaderboard();
    setPendingOfflineCount(getQueuedScans().length);

    const handleOnline = async () => {
      const synced = await flushOfflineScans();
      if (synced > 0) {
        setFeedback({
          type: "success",
          text: `Online sync: Processed ${synced} pending offline check-in(s)!`,
        });
        fetchClue();
        fetchLeaderboard();
      }
      setPendingOfflineCount(getQueuedScans().length);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [fetchClue, fetchLeaderboard]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode.trim()) return;

    setIsSubmitting(true);
    setFeedback(null);

    // Get current GPS position if available for geo-fencing validation
    let userLat: number | null = null;
    let userLng: number | null = null;

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 4000,
            enableHighAccuracy: true,
          });
        });
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
      } catch {
        // Fallback without strict GPS if permission denied
      }
    }

    const res = await submitClueScan(huntId, userId, scannedCode, userLat, userLng);

    if (res.success) {
      setFeedback({ type: "success", text: res.message });
      setScannedCode("");
      await fetchClue();
      await fetchLeaderboard();
    } else {
      setFeedback({ type: "error", text: res.message });
    }

    setPendingOfflineCount(getQueuedScans().length);
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Locating your active checkpoint...
          </p>
        </div>
      </div>
    );
  }

  const isCompleted = currentClue?.is_completed;
  const progressPercent = currentClue
    ? Math.round(((currentClue.sequence_order - 1) / Math.max(1, currentClue.total_clues)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("clue")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "clue"
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Active Mission
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "leaderboard"
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Trophy className="h-4 w-4" />
            Leaderboard
          </button>
        </div>

        {pendingOfflineCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <WifiOff className="h-3.5 w-3.5" />
            {pendingOfflineCount} queued offline
          </span>
        )}
      </div>

      {activeTab === "clue" ? (
        <div className="space-y-6">
          {/* Progress Tracker */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {isCompleted
                  ? "🎉 Hunt Completed!"
                  : `Checkpoint ${currentClue?.sequence_order || 1} of ${currentClue?.total_clues || 1}`}
              </span>
              <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                <Award className="h-4 w-4" />
                {currentClue?.current_score || 0} pts
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                style={{ width: `${isCompleted ? 100 : progressPercent}%` }}
              />
            </div>
          </div>

          {feedback && (
            <div
              role="alert"
              className={`rounded-xl p-4 text-sm font-medium ${
                feedback.type === "success"
                  ? "border border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-300"
                  : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300"
              }`}
            >
              {feedback.text}
            </div>
          )}

          {isCompleted ? (
            /* Celebration Complete View */
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-gradient-to-b from-indigo-50/50 to-purple-50/50 p-8 text-center dark:border-slate-800 dark:from-indigo-950/20 dark:to-purple-950/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
                Champion Explorer!
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                You have successfully decoded and discovered all campus checkpoints with a score of{" "}
                <strong className="text-indigo-600 dark:text-indigo-400">
                  {currentClue?.current_score} points
                </strong>
                .
              </p>
            </div>
          ) : (
            /* Active Clue View */
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  <MapPin className="h-4 w-4" />
                  Your Current Clue
                </div>
                <p className="mt-3 text-lg font-medium leading-relaxed text-slate-900 dark:text-white">
                  "{currentClue?.hint_text || "Search around campus for the next QR marker."}"
                </p>
              </div>

              {/* QR Scanner / Manual Verification Form */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Found the Checkpoint?
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Scan the QR code on the checkpoint sign or enter the secret code found on it.
                </p>

                <form onSubmit={handleScanSubmit} className="mt-4 space-y-4">
                  <div className="relative">
                    <QrCode className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={scannedCode}
                      onChange={(e) => setScannedCode(e.target.value)}
                      placeholder="e.g. CAMPUSHUNT:..."
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isSubmitting ? "Verifying Checkpoint..." : "Verify & Unlock Next Clue"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Leaderboard View */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Live Leaderboard
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ranked by completion time and total score.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLeaderboard}
              className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {leaderboard.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No completions yet. Be the first to finish!
              </p>
            ) : (
              leaderboard.map((player, idx) => (
                <div key={player.user_id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : idx === 1
                            ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                            : idx === 2
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                              : "text-slate-500"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {player.full_name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {player.completed_at
                          ? `Finished in ${Math.round((player.duration_seconds || 0) / 60)}m`
                          : `Checkpoint ${player.current_clue_order}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {player.total_score} pts
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
