import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

interface SafetyCheckPromptProps {
  eventId: string;
  userId: string;
}

export function SafetyCheckPrompt({ eventId, userId }: SafetyCheckPromptProps) {
  const [supabase] = useState(() => createClient());
  const [pendingResponse, setPendingResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const checkPending = async () => {
    setLoading(true);
    // Find active safety checks for this event
    const { data: checks } = await supabase
      .from("safety_checks")
      .select("id, expires_at")
      .eq("event_id", eventId)
      .order("initiated_at", { ascending: false })
      .limit(1);

    if (checks && checks.length > 0) {
      const activeCheck = checks[0];
      if (new Date(activeCheck.expires_at).getTime() > Date.now()) {
        // Check if user has a pending response
        const { data: response } = await supabase
          .from("safety_check_responses")
          .select("*")
          .eq("safety_check_id", activeCheck.id)
          .eq("user_id", userId)
          .eq("status", "PENDING")
          .maybeSingle();

        if (response) {
          setPendingResponse(response);
        } else {
          setPendingResponse(null);
        }
      } else {
        setPendingResponse(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    checkPending();

    // Subscribe to new safety checks and updates
    const responsesChannel = supabase
      .channel("my_safety_responses")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "safety_check_responses",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          checkPending();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "safety_check_responses",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          checkPending();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(responsesChannel);
    };
  }, [eventId, userId, supabase]);

  const captureLastKnownLocation = () => {
    if (!pendingResponse || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition((position) => {
      supabase
        .from("safety_check_responses")
        .update({
          last_known_latitude: position.coords.latitude,
          last_known_longitude: position.coords.longitude,
          location_updated_at: new Date().toISOString(),
        })
        .eq("id", pendingResponse.id);
    });
  };

  useEffect(() => {
    if (!pendingResponse) return;
    captureLastKnownLocation();
    const locationInterval = setInterval(captureLastKnownLocation, 60000);
    return () => clearInterval(locationInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingResponse?.id]);

  const markSafe = async () => {
    if (!pendingResponse) return;

    const { error } = await supabase
      .from("safety_check_responses")
      .update({ status: "SAFE", responded_at: new Date().toISOString() })
      .eq("id", pendingResponse.id);
    if (error) {
      toast.error("Failed to mark as safe.");
    } else {
      toast.success("Check-in successful. Stay safe!");
      setPendingResponse(null);
    }
  };

  if (loading || !pendingResponse) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="max-w-md w-full bg-red-600 p-8 border-4 border-black shadow-[8px_8px_0_0_#000] text-white animate-in zoom-in-95 flex flex-col items-center text-center space-y-6">
        <ShieldAlert size={64} className="animate-pulse" />
        <div>
          <h2 className="font-display text-4xl font-bold uppercase mb-2">Safety Check</h2>
          <p className="font-mono text-lg font-bold">
            The organizer has initiated a safety check. Please confirm you are safe immediately.
          </p>
        </div>
        <Button
          onClick={markSafe}
          size="lg"
          className="w-full h-20 text-2xl font-bold bg-green-500 hover:bg-green-600 text-black border-4 border-black shadow-[4px_4px_0_0_#000] transition-all hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000]"
        >
          I AM SAFE
        </Button>
      </div>
    </div>
  );
}
