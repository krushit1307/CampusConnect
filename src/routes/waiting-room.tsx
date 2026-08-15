import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { motion } from "framer-motion";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { toast } from "sonner";

interface QueueStatusResponse {
  status: "waiting" | "admitted" | "not_in_queue" | "error";
  ticket?: string;
  position?: number;
  total?: number;
  estimatedWaitTime?: number;
}

export default function WaitingRoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const supabase = createClient();

  const eventId = searchParams.get("event_id") || "";
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Event details for visual feedback
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from("events")
        .select("id, title, location, event_date")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // 2. Poll waiting room status
  useEffect(() => {
    if (!eventId) {
      setErrorMsg("Missing event_id parameter.");
      setIsJoining(false);
      return;
    }

    const checkStatus = async (isInitialJoin = false) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error("Please login to join the waiting room.");
          navigate("/auth");
          return;
        }

        const res = await supabase.functions.invoke("event-waiting-room", {
          body: {
            eventId,
            action: isInitialJoin ? "join" : "status",
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (res.error) throw res.error;

        const data = res.data as QueueStatusResponse;
        setQueueStatus(data);

        // If admitted, store ticket and redirect back
        if (data.status === "admitted" && data.ticket) {
          sessionStorage.setItem(`ticket_event_${eventId}`, data.ticket);
          toast.success("You have been admitted! Redirecting to RSVP...");
          setTimeout(() => {
            navigate(`/events/${eventId}`);
          }, 1500);
        }
      } catch (err: any) {
        console.error("Queue status check failed:", err);
        setErrorMsg(err.message || "Failed to check queue status.");
      } finally {
        setIsJoining(false);
      }
    };

    // Join queue on mount
    checkStatus(true);

    // Poll every 10 seconds
    const interval = setInterval(() => {
      checkStatus(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [eventId, navigate, supabase]);

  if (errorMsg) {
    return (
      <SiteShell>
        <div className="min-h-screen bg-cream flex items-center justify-center p-4">
          <div className="max-w-md w-full neu-border border-4 border-black bg-white p-8 text-center shadow-[6px_6px_0_0_#000000] space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="font-display text-2xl font-black uppercase text-black">Queue Error</h2>
            <p className="font-mono text-xs text-gray-600">{errorMsg}</p>
            <button
              onClick={() => navigate("/")}
              className="neu-border border-2 border-black bg-[#fb923c] px-4 py-2 font-mono text-xs font-bold uppercase text-black hover:-translate-y-0.5 transition-transform"
            >
              Back to Home
            </button>
          </div>
        </div>
      </SiteShell>
    );
  }

  const formatTime = (seconds?: number) => {
    if (!seconds) return "Calculating...";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    return `${mins} min${mins > 1 ? "s" : ""}`;
  };

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream flex items-center justify-center p-4 md:p-8">
        <div className="max-w-lg w-full neu-border border-4 border-black bg-white p-8 shadow-[8px_8px_0_0_#000000] relative space-y-8">
          {/* Header */}
          <div className="border-b-4 border-black pb-4 text-center space-y-2">
            <span className="font-mono text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5">
              Live Queue Waiting Room
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-black uppercase text-black">
              Spring Gala Tickets
            </h1>
            {event && (
              <p className="font-mono text-xs text-gray-500">
                {event.title} · {event.location || "Online"}
              </p>
            )}
          </div>

          {/* Loader or Status Area */}
          <div className="py-6 flex flex-col items-center justify-center space-y-6 text-center">
            {isJoining ? (
              <div className="space-y-3">
                <Loader2 className="h-12 w-12 animate-spin text-black mx-auto" />
                <p className="font-mono text-xs text-gray-600">Joining queue, please wait...</p>
              </div>
            ) : queueStatus?.status === "admitted" ? (
              <div className="space-y-4">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-lime/20 border-2 border-black p-6 rounded-none flex flex-col items-center space-y-3"
                >
                  <ShieldCheck className="h-12 w-12 text-black fill-lime" />
                  <h3 className="font-display text-lg font-black uppercase text-black">You are Admitted!</h3>
                  <p className="font-mono text-xs text-gray-600">
                    Your spot is secured. Redirecting you to complete your RSVP...
                  </p>
                </motion.div>
              </div>
            ) : (
              <div className="w-full space-y-8">
                {/* Visual Stats Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="neu-border border-2 border-black bg-cream p-4 text-center">
                    <span className="font-mono text-[9px] font-bold text-gray-500 uppercase block mb-1">
                      People Ahead
                    </span>
                    <span className="font-display text-3xl font-black text-black">
                      {queueStatus?.position ?? "..."}
                    </span>
                  </div>
                  <div className="neu-border border-2 border-black bg-cream p-4 text-center">
                    <span className="font-mono text-[9px] font-bold text-gray-500 uppercase block mb-1">
                      Est. Wait Time
                    </span>
                    <span className="font-display text-3xl font-black text-black">
                      {formatTime(queueStatus?.estimatedWaitTime)}
                    </span>
                  </div>
                </div>

                {/* Queue status visualizer */}
                <div className="neu-border border-2 border-black p-4 bg-[#fb923c]/10 text-left space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-black">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Status: Waiting in Queue
                  </div>
                  <p className="font-mono text-[10px] text-gray-600">
                    To maintain fairness, users are admitted in batches based on checkout capacity. Do not close this page or refresh to avoid losing your spot.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="border-t-2 border-black pt-4 text-center font-mono text-[10px] text-gray-400">
            * Tickets are reserved for 5 minutes once admitted.
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
