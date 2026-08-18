// =============================================================================
// Route: /admin/emergency-broadcast
// Issue: #3165 - Emergency Campus Broadcast Override Module
// Description: Highly restricted admin UI for Campus Security / University
// Admins to trigger (or clear) a life-safety emergency broadcast. Access is
// gated on the client by profiles.role === "system_admin", and enforced on
// the server by RLS requiring both is_system_admin() AND an aal2 (MFA
// verified) session — see 20261023000000_campus_emergencies.sql. A typed
// confirmation phrase guards against accidental triggers.
// =============================================================================

import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { SiteShell } from "@/components/site/SiteShell";
import { supabase } from "@/lib/supabase/client";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import type { CampusEmergency } from "@/hooks/useEmergencyBroadcast";

const CONFIRMATION_PHRASE = "BROADCAST EMERGENCY";

export default function AdminEmergencyBroadcast() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"warning" | "critical">("critical");
  const [confirmText, setConfirmText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const [activeEmergency, setActiveEmergency] = useState<CampusEmergency | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Authenticate user + look up their role (mirrors the pattern used by
  // the other restricted /admin/* routes, e.g. admin.users.tsx).
  useEffect(() => {
    let active = true;
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setAuthChecked(true);
        return;
      }
      if (active) setUser(user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile && active) setRole(profile.role);
      if (active) setAuthChecked(true);
    };
    void init();
    return () => {
      active = false;
    };
  }, []);

  const loadActiveEmergency = useCallback(async () => {
    const { data } = await supabase
      .from("campus_emergencies" as any)
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveEmergency((data as CampusEmergency | null) ?? null);
  }, []);

  useEffect(() => {
    if (role === "system_admin") void loadActiveEmergency();
  }, [role, loadActiveEmergency]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) {
      toast.error("Title and message are required.");
      return;
    }
    if (confirmText !== CONFIRMATION_PHRASE) {
      toast.error(`Please type "${CONFIRMATION_PHRASE}" to confirm.`);
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.from("campus_emergencies" as any).insert({
        title,
        message,
        severity,
        active: true,
        triggered_by: user?.id ?? null,
      });

      if (error) throw error;

      toast.success("Emergency broadcast sent to all connected clients.");
      setTitle("");
      setMessage("");
      setConfirmText("");
      void loadActiveEmergency();
    } catch (error) {
      console.error("Emergency broadcast failed:", error);
      const errorMsg =
        error instanceof Error ? error.message : "Failed to send emergency broadcast.";
      toast.error(errorMsg);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = async () => {
    if (!activeEmergency) return;
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from("campus_emergencies" as any)
        .update({ active: false, resolved_at: new Date().toISOString() })
        .eq("id", activeEmergency.id);

      if (error) throw error;

      toast.success("All-clear issued. The alert will disappear for all clients.");
      setActiveEmergency(null);
    } catch (error) {
      console.error("Failed to clear emergency:", error);
      toast.error("Failed to clear the emergency alert.");
    } finally {
      setIsClearing(false);
    }
  };

  if (authChecked && !user) {
    return <Navigate to="/auth" replace />;
  }

  if (authChecked && role !== "system_admin") {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6 min-h-screen">
          <div className="mx-auto max-w-lg text-center font-mono">
            <div className="inline-flex h-16 w-16 items-center justify-center bg-peach neu-border rounded-none mb-6">
              <ShieldAlert className="h-8 w-8 text-black" />
            </div>
            <h1 className="text-3xl font-bold text-black uppercase">Admin access required</h1>
            <p className="mt-4 text-black/70">
              Only Campus Security / University Admins can trigger emergency broadcasts.
            </p>
          </div>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <h1 className="mb-2 text-3xl font-bold text-red-700">Emergency Campus Broadcast</h1>
        <p className="mb-6 font-mono text-xs text-muted-foreground">
          This triggers a full-screen, un-dismissible alert on every connected client. Use only
          for genuine life-safety events (severe weather, active security threats).
        </p>

        {activeEmergency && (
          <div className="mb-6 border-2 border-red-700 bg-red-50 p-4">
            <p className="font-bold text-red-700">An emergency alert is currently LIVE:</p>
            <p className="mt-1 font-bold">{activeEmergency.title}</p>
            <p className="text-sm">{activeEmergency.message}</p>
            <button
              type="button"
              onClick={handleClear}
              disabled={isClearing}
              className="mt-4 neu-border neu-press bg-black px-4 py-2 text-cream font-bold disabled:opacity-50"
            >
              {isClearing ? "Clearing..." : "Issue All-Clear"}
            </button>
          </div>
        )}

        <form onSubmit={handleBroadcast} className="space-y-4 bg-white p-6 neu-border">
          <div>
            <label className="block font-bold mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-2 border-black p-2 outline-none focus:bg-lime/20"
              placeholder="e.g. Tornado Warning"
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border-2 border-black p-2 outline-none focus:bg-lime/20 h-32"
              placeholder="e.g. Seek shelter immediately. Move to the nearest interior room."
              required
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as "warning" | "critical")}
              className="w-full border-2 border-black p-2 outline-none focus:bg-lime/20"
            >
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">
              Type <span className="font-mono">{CONFIRMATION_PHRASE}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full border-2 border-red-700 p-2 outline-none focus:bg-red-50"
              placeholder={CONFIRMATION_PHRASE}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSending || confirmText !== CONFIRMATION_PHRASE}
            className="w-full neu-border neu-press bg-red-700 p-3 text-white font-bold disabled:opacity-50"
          >
            {isSending ? "Broadcasting..." : "Send Emergency Broadcast"}
          </button>
        </form>
      </div>
    </SiteShell>
  );
}