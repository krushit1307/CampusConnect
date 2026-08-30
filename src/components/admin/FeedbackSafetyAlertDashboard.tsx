import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Lock,
  Unlock,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { triggerLockdown, clearLockdown } from "@/services/lockdownService";

type AlertStatus = "open" | "acknowledged" | "resolved";
type SafetyAlert = {
  id: string;
  event_id: string;
  feedback_id: string;
  raw_feedback: string;
  detection_source: "llm_marker" | "deterministic_safety_language" | "both";
  status: AlertStatus;
  sms_sent_at: string | null;
  email_sent_at: string | null;
  last_delivery_error: string | null;
  created_at: string;
};

export function FeedbackSafetyAlertDashboard() {
  const [supabase] = useState(() => createClient());
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null);

  // Lockdown state
  const [isLockingDown, setIsLockingDown] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isLockedDown, setIsLockedDown] = useState(false);

  const loadAlerts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.rpc("get_open_feedback_safety_alerts");
    if (error) {
      toast.error(error.message || "Could not load safety alerts.");
      setIsLoading(false);
      return;
    }
    const nextAlerts = (data ?? []) as SafetyAlert[];
    setAlerts(nextAlerts);
    const eventIds = [...new Set(nextAlerts.map((alert) => alert.event_id))];
    if (eventIds.length > 0) {
      const { data: events } = await supabase.from("events").select("id, title").in("id", eventIds);
      setEventTitles(Object.fromEntries((events ?? []).map((event) => [event.id, event.title])));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadAlerts();
    const channel = supabase
      .channel("feedback-safety-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_feedback_safety_alerts" },
        () => void loadAlerts(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const updateStatus = async (alertId: string, status: AlertStatus) => {
    setBusyAlertId(alertId);
    const { error } = await supabase
      .from("event_feedback_safety_alerts")
      .update({ status })
      .eq("id", alertId);
    setBusyAlertId(null);
    if (error) {
      toast.error(error.message || "Could not update the safety alert.");
      return;
    }
    toast.success(status === "resolved" ? "Safety alert resolved." : "Safety alert updated.");
    await loadAlerts();
  };

  const handleLockdown = async () => {
    setIsLockingDown(true);
    const res = await triggerLockdown();
    if (res.success) {
      toast.success(res.message || "PHYSICAL LOCKDOWN INITIATED.");
      setIsLockedDown(true);
    } else {
      toast.error(res.error || "Failed to trigger lockdown.");
    }
    setIsLockingDown(false);
  };

  const handleClearLockdown = async () => {
    setIsClearing(true);
    const res = await clearLockdown();
    if (res.success) {
      toast.success(res.message || "ALL CLEAR - DOORS UNLOCKED.");
      setIsLockedDown(false);
    } else {
      toast.error(res.error || "Failed to clear lockdown.");
    }
    setIsClearing(false);
  };

  return (
    <section
      className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-6"
      aria-labelledby="safety-alerts-title"
    >
      {/* Physical Access Control Panel */}
      <div
        className={`border-4 p-6 shadow-[8px_8px_0_0_#000] transition-colors ${isLockedDown ? "border-red-600 bg-red-50" : "border-black bg-white"}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl font-black uppercase text-red-700">
              <ShieldAlert className="h-6 w-6" /> Physical Access Control
            </h2>
            <p className="mt-1 font-mono text-sm text-black/70">
              Instantly lock exterior building doors during an active threat (Mass Override).
            </p>
            {isLockedDown && (
              <p className="mt-2 inline-block bg-red-600 px-3 py-1 font-mono text-xs font-bold text-white uppercase animate-pulse">
                STATUS: ACTIVE LOCKDOWN
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {!isLockedDown ? (
              <Button
                size="lg"
                onClick={handleLockdown}
                disabled={isLockingDown}
                className="neu-border bg-red-600 hover:bg-red-700 text-white font-mono text-sm font-bold uppercase w-full sm:w-auto h-14"
              >
                {isLockingDown ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-5 w-5" />
                )}
                Lockdown Campus
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleClearLockdown}
                disabled={isClearing}
                className="neu-border bg-green-600 hover:bg-green-700 text-white font-mono text-sm font-bold uppercase w-full sm:w-auto h-14"
              >
                {isClearing ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Unlock className="mr-2 h-5 w-5" />
                )}
                All Clear - Unlock
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b-2 border-black pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-red-700">
            <AlertTriangle className="h-4 w-4" /> Priority interrupt
          </p>
          <h2 id="safety-alerts-title" className="mt-1 font-display text-3xl font-black uppercase">
            Critical feedback alerts
          </h2>
          <p className="mt-2 max-w-2xl font-mono text-xs text-black/65">
            Restricted reports are separated from ordinary event summaries. Contact Campus Police
            through the configured emergency process when immediate danger is reported.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadAlerts()}
          disabled={isLoading}
          className="neu-border font-mono text-xs font-bold uppercase"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading priority alerts…
        </div>
      ) : alerts.length === 0 ? (
        <div className="border-2 border-dashed border-black/30 bg-white p-8 text-center font-mono text-sm text-black/60">
          No unresolved critical feedback alerts.
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <article
              key={alert.id}
              className="border-2 border-black bg-red-50 p-5 shadow-[4px_4px_0_0_#000]"
            >
              <div className="flex flex-col gap-3 border-b-2 border-black pb-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-bold uppercase text-red-800">
                    Critical safety feedback
                  </p>
                  <h3 className="mt-1 font-display text-xl font-black uppercase">
                    {eventTitles[alert.event_id] || "Event"}
                  </h3>
                  <p className="font-mono text-[11px] text-black/60">
                    Detected {new Date(alert.created_at).toLocaleString()} · source:{" "}
                    {alert.detection_source.replaceAll("_", " ")}
                  </p>
                </div>
                <span className="border-2 border-black bg-yellow-200 px-2 py-1 font-mono text-[10px] font-bold uppercase">
                  {alert.status}
                </span>
              </div>
              <blockquote className="mt-4 border-l-4 border-red-700 bg-white p-4 font-mono text-sm leading-relaxed">
                {alert.raw_feedback}
              </blockquote>
              <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px] font-bold uppercase">
                <span
                  className={`border-2 border-black px-2 py-1 ${alert.email_sent_at ? "bg-lime" : "bg-white"}`}
                >
                  {alert.email_sent_at ? "Email dispatched" : "Email pending"}
                </span>
                <span
                  className={`border-2 border-black px-2 py-1 ${alert.sms_sent_at ? "bg-lime" : "bg-white"}`}
                >
                  {alert.sms_sent_at ? "SMS dispatched" : "SMS pending"}
                </span>
                {alert.last_delivery_error && (
                  <span className="border-2 border-black bg-orange-200 px-2 py-1">
                    Delivery issue logged
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {alert.status === "open" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void updateStatus(alert.id, "acknowledged")}
                    disabled={busyAlertId === alert.id}
                    className="neu-border font-mono text-xs font-bold uppercase"
                  >
                    Acknowledge
                  </Button>
                )}
                {alert.status !== "resolved" && (
                  <Button
                    type="button"
                    onClick={() => void updateStatus(alert.id, "resolved")}
                    disabled={busyAlertId === alert.id}
                    className="neu-border font-mono text-xs font-bold uppercase"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
