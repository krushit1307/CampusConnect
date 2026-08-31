import React, { useState, useEffect } from "react";
import { createClient, getSupabaseUrl } from "@/lib/supabase/client";
import { SongSearch } from "./SongSearch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Music from "lucide-react/dist/esm/icons/music";
import ThumbsUp from "lucide-react/dist/esm/icons/thumbs-up";
import ThumbsDown from "lucide-react/dist/esm/icons/thumbs-down";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

export function SongRequestSection({
  eventId,
  isOrganizer,
}: {
  eventId: string;
  isOrganizer: boolean;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSpotifyLinked, setIsSpotifyLinked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  const loadRequests = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      setCurrentUserId(userData.user.id);
    }

    const { data, error } = await supabase
      .from("song_requests")
      .select("*, song_upvotes(user_id), song_downvotes(user_id)")
      .eq("event_id", eventId)
      .eq("played", false)
      .order("upvotes", { ascending: false })
      .order("downvotes", { ascending: true });

    if (data) setRequests(data);
    setLoading(false);
  };

  const checkSpotifyLink = async () => {
    const { data } = await supabase
      .from("event_spotify_auth")
      .select("event_id")
      .eq("event_id", eventId)
      .maybeSingle();
    setIsSpotifyLinked(!!data);
  };

  useEffect(() => {
    loadRequests();
    checkSpotifyLink();

    const channel = supabase
      .channel(`song_requests_changes_${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests", filter: `event_id=eq.${eventId}` },
        loadRequests,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "song_upvotes" }, loadRequests)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_downvotes" },
        loadRequests,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  const triggerQueueSync = async () => {
    try {
      await supabase.functions.invoke("sync-spotify-queue", {
        method: "POST",
        body: { eventId },
      });
    } catch (e) {
      console.warn("Queue sync trigger failed:", e);
    }
  };

  const handleRequestSong = async (track: any) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return toast.error("You must be logged in to request a song.");

    const { error } = await supabase.from("song_requests").insert({
      event_id: eventId,
      spotify_track_id: track.id,
      title: track.name,
      artist: track.artists.map((a: any) => a.name).join(", "),
      album_art_url: track.album?.images?.[0]?.url || "",
      requested_by: user.user.id,
      upvotes: 1,
      played: false,
    } as any);

    if (error) {
      if (error.code === "23505") {
        toast.info("This song is already in the queue.");
      } else {
        toast.error("Error requesting song");
      }
    } else {
      toast.success("Song requested!");
      loadRequests();
      // Trigger sync worker to inject to Spotify queue in real time
      triggerQueueSync();
    }
  };

  const handleVote = async (requestId: string, type: "up" | "down") => {
    if (!currentUserId) return toast.error(`You must be logged in to ${type}vote.`);

    const request = requests.find((r) => r.id === requestId);
    if (!request) return;

    const hasUpvoted = request.song_upvotes?.some((v: any) => v.user_id === currentUserId);
    const hasDownvoted = request.song_downvotes?.some((v: any) => v.user_id === currentUserId);

    if (type === "up") {
      if (hasUpvoted) {
        // Remove upvote
        await supabase
          .from("song_upvotes")
          .delete()
          .eq("song_request_id", requestId)
          .eq("user_id", currentUserId);
        await supabase
          .from("song_requests")
          .update({ upvotes: Math.max(0, request.upvotes - 1) })
          .eq("id", requestId);
      } else {
        // Add upvote
        await supabase
          .from("song_upvotes")
          .insert({ song_request_id: requestId, user_id: currentUserId } as any);
        let downvoteDelta = 0;
        if (hasDownvoted) {
          await supabase
            .from("song_downvotes")
            .delete()
            .eq("song_request_id", requestId)
            .eq("user_id", currentUserId);
          downvoteDelta = -1;
        }
        await supabase
          .from("song_requests")
          .update({
            upvotes: request.upvotes + 1,
            downvotes: Math.max(0, request.downvotes + downvoteDelta),
          })
          .eq("id", requestId);
      }
    } else {
      if (hasDownvoted) {
        // Remove downvote
        await supabase
          .from("song_downvotes")
          .delete()
          .eq("song_request_id", requestId)
          .eq("user_id", currentUserId);
        await supabase
          .from("song_requests")
          .update({ downvotes: Math.max(0, request.downvotes - 1) })
          .eq("id", requestId);
      } else {
        // Add downvote
        await supabase
          .from("song_downvotes")
          .insert({ song_request_id: requestId, user_id: currentUserId } as any);
        let upvoteDelta = 0;
        if (hasUpvoted) {
          await supabase
            .from("song_upvotes")
            .delete()
            .eq("song_request_id", requestId)
            .eq("user_id", currentUserId);
          upvoteDelta = -1;
        }
        await supabase
          .from("song_requests")
          .update({
            downvotes: request.downvotes + 1,
            upvotes: Math.max(0, request.upvotes + upvoteDelta),
          })
          .eq("id", requestId);
      }
    }

    loadRequests();
    // Trigger sync worker
    triggerQueueSync();
  };

  const handleLinkSpotify = () => {
    const supabaseUrl = getSupabaseUrl();
    const redirectBack = window.location.href;
    window.location.assign(
      `${supabaseUrl}/functions/v1/spotify-oauth?event_id=${eventId}&redirect_back=${encodeURIComponent(redirectBack)}`,
    );
  };

  const handleSyncQueue = async () => {
    setSyncing(true);
    toast.info("Syncing playlist queue with Spotify...");
    try {
      const { data, error } = await supabase.functions.invoke("sync-spotify-queue", {
        method: "POST",
        body: { eventId },
      });
      if (error || data?.error) {
        toast.error(data?.message || data?.error || "Failed to sync queue");
      } else {
        toast.success(data?.message || "Synced successfully!");
        loadRequests();
      }
    } catch (e: any) {
      toast.error(e.message || "Sync error");
    }
    setSyncing(false);
  };

  return (
    <div className="p-6 bg-[#0f172a] text-white border border-slate-800 rounded-2xl shadow-2xl space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#1DB954]/20 rounded-xl text-[#1DB954]">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight">
              Collaborative Event Soundtrack
            </h2>
            <p className="text-xs text-slate-400">
              Request and vote on songs to build the perfect queue
            </p>
          </div>
        </div>

        {isOrganizer && (
          <div className="flex items-center gap-3">
            {isSpotifyLinked ? (
              <>
                <span className="text-xs bg-[#1DB954]/20 text-[#1DB954] font-semibold px-2.5 py-1 rounded-full border border-[#1DB954]/30">
                  Spotify Linked
                </span>
                <Button
                  onClick={handleSyncQueue}
                  disabled={syncing}
                  className="bg-[#1DB954] text-black hover:bg-[#1ed760] font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  Sync Queue
                </Button>
              </>
            ) : (
              <Button
                onClick={handleLinkSpotify}
                className="bg-[#1DB954] text-black hover:bg-[#1ed760] font-semibold"
              >
                Link Spotify Account
              </Button>
            )}
          </div>
        )}
      </div>

      <SongSearch onSelect={handleRequestSong} />

      {loading ? (
        <div className="flex items-center gap-2 py-4 font-mono text-sm text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin text-[#1DB954]" />
          Loading requests...
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Soundtrack Queue
          </h3>
          {requests.map((req) => {
            const hasUpvoted = req.song_upvotes?.some((v: any) => v.user_id === currentUserId);
            const hasDownvoted = req.song_downvotes?.some((v: any) => v.user_id === currentUserId);

            return (
              <div
                key={req.id}
                className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {req.album_art_url ? (
                    <img
                      src={req.album_art_url}
                      className="w-12 h-12 rounded-lg border border-slate-800 object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-500">
                      <Music className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm text-white">{req.title}</p>
                    <p className="text-xs text-slate-400">{req.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center mr-1">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {req.upvotes - req.downvotes}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Score
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant={hasUpvoted ? "primary" : "outline"}
                      onClick={() => handleVote(req.id, "up")}
                      className={`h-8 w-12 px-0 flex items-center justify-center ${hasUpvoted ? "bg-[#1DB954] text-black hover:bg-[#1ed760]" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
                      aria-label="Upvote"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={hasDownvoted ? "primary" : "outline"}
                      onClick={() => handleVote(req.id, "down")}
                      className={`h-8 w-12 px-0 flex items-center justify-center ${hasDownvoted ? "bg-red-600 text-white hover:bg-red-500" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
                      aria-label="Downvote"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {requests.length === 0 && (
            <p className="text-slate-500 italic font-mono text-sm text-center py-6 border border-dashed border-slate-800 rounded-xl bg-slate-900/50">
              No songs requested yet. Be the first to build the soundtrack!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
