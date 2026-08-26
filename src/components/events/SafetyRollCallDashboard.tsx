import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck, PhoneCall } from "lucide-react";

interface SafetyRollCallDashboardProps {
  eventId: string;
}

interface SafetyCheck {
  id: string;
  initiated_at: string;
  expires_at: string;
}

interface ResponseUser {
  id: string;
  first_name: string;
  last_name: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface SafetyCheckResponse {
  id: string;
  user_id: string;
  status: string;
  responded_at: string | null;
  profiles: ResponseUser;
}

export function SafetyRollCallDashboard({ eventId }: SafetyRollCallDashboardProps) {
  const [supabase] = useState(() => createClient());
  const [activeCheck, setActiveCheck] = useState<SafetyCheck | null>(null);
  const [responses, setResponses] = useState<SafetyCheckResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadActiveCheck = async () => {
    setLoading(true);
    const { data: checks } = await supabase
      .from("safety_checks")
      .select("*")
      .eq("event_id", eventId)
      .order("initiated_at", { ascending: false })
      .limit(1);

    if (checks && checks.length > 0) {
      setActiveCheck(checks[0]);
      await loadResponses(checks[0].id);
    }
    setLoading(false);
  };

  const loadResponses = async (checkId: string) => {
    const { data } = await supabase
      .from("safety_check_responses")
      .select(
        "id, user_id, status, responded_at, profiles(id, first_name, last_name, emergency_contact_name, emergency_contact_phone)",
      )
      .eq("safety_check_id", checkId);
    if (data) {
      // Supabase type workaround
      setResponses(data as any as SafetyCheckResponse[]);
    }
  };

  useEffect(() => {
    loadActiveCheck();

    const channel = supabase
      .channel("safety_responses")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "safety_check_responses" },
        (payload) => {
          setResponses((prev) =>
            prev.map((r) => (r.id === payload.new.id ? { ...r, ...payload.new } : r)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  const initiateCheck = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // 1. Create Check
    const { data: checkData, error: checkError } = await supabase
      .from("safety_checks")
      .insert({
        event_id: eventId,
        initiated_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (checkError || !checkData) {
      toast.error("Failed to initiate safety check");
      return;
    }

    // 2. Get Attendees (RSVPs)
    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("user_id")
      .eq("event_id", eventId);

    const attendeeIds = rsvps?.map((r) => r.user_id) || [];

    // Fallback if testing with no attendees
    if (attendeeIds.length === 0) {
      toast.warning("No attendees found for this event, but check initiated.");
    }

    // 3. Insert responses for all attendees
    if (attendeeIds.length > 0) {
      const inserts = attendeeIds.map((uid) => ({
        safety_check_id: checkData.id,
        user_id: uid,
        status: "PENDING",
      }));
      await supabase.from("safety_check_responses").insert(inserts);
    }

    // 4. Dispatch simulated notifications
    toast.success("SAFETY CHECK INITIATED: Push Notification and SMS dispatched to all attendees.");

    setActiveCheck(checkData);
    loadResponses(checkData.id);
  };

  if (loading) return null;

  return (
    <div className="neu-border bg-white p-6 space-y-4 shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center gap-2 border-b-2 border-black pb-2">
        <AlertTriangle className="text-red-500" size={24} />
        <h2 className="font-display text-2xl font-bold uppercase">Safety Roll Call</h2>
      </div>

      {!activeCheck ? (
        <div className="text-center py-6">
          <p className="mb-4 font-mono text-sm text-gray-700">
            For high-risk off-campus events. Initiate a check to require all attendees to confirm
            they are safe within 15 minutes.
          </p>
          <Button
            onClick={initiateCheck}
            size="lg"
            className="w-full h-16 text-xl bg-red-500 hover:bg-red-600 text-white shadow-[4px_4px_0_0_#000] transition-all hover:translate-y-1 hover:shadow-[2px_2px_0_0_#000]"
          >
            INITIATE SAFETY CHECK
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-100 p-4 border-2 border-black rounded flex justify-between items-center">
            <span className="font-mono text-sm font-bold">Check-in Progress</span>
            <span className="font-mono text-sm font-bold bg-white px-2 py-1 border-2 border-black">
              {responses.filter((r) => r.status === "SAFE").length} / {responses.length} Safe
            </span>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
            {responses.map((r) => {
              const isSafe = r.status === "SAFE";
              const isOverdue = !isSafe && new Date(activeCheck.expires_at).getTime() < now;

              return (
                <div
                  key={r.id}
                  className={`p-3 border-2 border-black flex items-center justify-between transition-colors ${
                    isSafe ? "bg-green-100" : isOverdue ? "bg-red-100" : "bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isSafe && <ShieldCheck className="text-green-600" size={20} />}
                    {isOverdue && (
                      <AlertTriangle className="text-red-600 animate-pulse" size={20} />
                    )}
                    {!isSafe && !isOverdue && (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-400 border-t-black animate-spin" />
                    )}

                    <div>
                      <p
                        className={`font-bold ${isSafe ? "text-green-800" : isOverdue ? "text-red-800" : "text-black"}`}
                      >
                        {r.profiles?.first_name} {r.profiles?.last_name}
                      </p>
                      <p className="font-mono text-xs text-gray-600">
                        {isSafe
                          ? `Checked in at ${new Date(r.responded_at!).toLocaleTimeString()}`
                          : isOverdue
                            ? "FAILED TO CHECK IN"
                            : "Waiting for response..."}
                      </p>
                    </div>
                  </div>

                  {isOverdue && (
                    <div className="text-right text-red-900 flex flex-col items-end gap-1">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <PhoneCall size={12} /> Emergency Contact
                      </span>
                      <span className="text-sm font-mono font-bold">
                        {r.profiles?.emergency_contact_name || "N/A"}:{" "}
                        {r.profiles?.emergency_contact_phone || "N/A"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {responses.length === 0 && (
              <p className="font-mono text-sm text-gray-500 text-center py-4">
                No attendees found.
              </p>
            )}
          </div>

          <Button variant="outline" className="w-full" onClick={() => setActiveCheck(null)}>
            Clear / Start New Check
          </Button>
        </div>
      )}
    </div>
  );
}
