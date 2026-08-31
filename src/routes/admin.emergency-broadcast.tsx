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
import Radio from "lucide-react/dist/esm/icons/radio";
import Wifi from "lucide-react/dist/esm/icons/wifi";
import WifiOff from "lucide-react/dist/esm/icons/wifi-off";
import Key from "lucide-react/dist/esm/icons/key";
import Lock from "lucide-react/dist/esm/icons/lock";
import Unlock from "lucide-react/dist/esm/icons/unlock";
import FileText from "lucide-react/dist/esm/icons/file-text";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Server from "lucide-react/dist/esm/icons/server";
import type { CampusEmergency } from "@/hooks/useEmergencyBroadcast";
import { CampusSafetyAccessControlService } from "@/services/campusSafetyAccessControlService";

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

  // Access Control states
  const [selectedBuilding, setSelectedBuilding] = useState("Science Building");
  const [networkBlackout, setNetworkBlackout] = useState(false);
  const [lockingInProgress, setLockingInProgress] = useState(false);
  const [doors, setDoors] = useState<any[]>([]);
  const [transmissionsCount, setTransmissionsCount] = useState(0);
  const [safetyLogs, setSafetyLogs] = useState<string[]>([]);

  const refreshDoors = useCallback(async () => {
    const { data: doorsData } = await supabase
      .from("exterior_doors")
      .select("*")
      .eq("building", selectedBuilding);
    if (doorsData) setDoors(doorsData);

    const { count } = await supabase
      .from("lorawan_transmissions")
      .select("*", { count: "exact", head: true });
    setTransmissionsCount(count || 0);
  }, [selectedBuilding]);

  useEffect(() => {
    if (role === "system_admin") {
      void refreshDoors();
    }
  }, [role, selectedBuilding, refreshDoors]);

  const handleLockdownDoors = async () => {
    setLockingInProgress(true);
    setSafetyLogs([]);
    try {
      const result = await CampusSafetyAccessControlService.lockDoors(selectedBuilding, {
        simulateNetworkBlackout: networkBlackout,
      });
      setSafetyLogs(result.logs);
      if (result.success) {
        if (result.method === "LORAWAN") {
          toast.warning(`Lockdown Broadcast Successful via LoRaWAN Radio Fallback!`);
        } else {
          toast.success(`Lockdown Successful via Primary REST API.`);
        }
      } else {
        toast.error("Lockdown failed or incomplete. Check safety logs.");
      }
      void refreshDoors();
    } catch (err: any) {
      toast.error(err.message || "Lockdown trigger error");
    } finally {
      setLockingInProgress(false);
    }
  };

  const handleUnlockDoors = async () => {
    setLockingInProgress(true);
    try {
      const success = await CampusSafetyAccessControlService.unlockAllDoors(selectedBuilding);
      if (success) {
        toast.success(`Exterior doors for ${selectedBuilding} reset to OPEN.`);
      } else {
        toast.error("Failed to unlock doors.");
      }
      void refreshDoors();
    } catch (err: any) {
      toast.error(err.message || "Unlock trigger error");
    } finally {
      setLockingInProgress(false);
    }
  };

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

        {/* ===================================================================== */}
        {/* PHYSICAL ACCESS CONTROL (LoRaWAN FALLBACK) PANEL                      */}
        {/* ===================================================================== */}
        <div className="mt-12 border-4 border-black bg-cream p-6 shadow-[6px_6px_0px_rgba(0,0,0,1)]">
          <h2 className="flex items-center gap-2 font-display text-2xl font-black uppercase text-black">
            <Server className="h-6 w-6" /> Physical Access Control (Lockdown)
          </h2>
          <p className="mt-2 font-mono text-xs text-muted-foreground border-b-2 border-black pb-4">
            Manage physical door magnetic locks. If the primary REST API connection to a building is severed (e.g. fiber cut),
            the system automatically switches to the long-range off-grid LoRaWAN radio gateway.
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs font-bold uppercase mb-1">Target Campus Building</label>
                <select
                  value={selectedBuilding}
                  onChange={(e) => setSelectedBuilding(e.target.value)}
                  className="w-full border-2 border-black p-2 font-mono text-sm outline-none bg-white"
                  data-testid="safety-building-select"
                >
                  <option value="Science Building">Science Building (Vulnerable)</option>
                  <option value="Main Library">Main Library</option>
                  <option value="Student Union">Student Union</option>
                </select>
              </div>

              {/* Simulation switch */}
              <div className="border-2 border-black bg-white p-3 flex items-center justify-between">
                <div>
                  <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase">
                    {networkBlackout ? <WifiOff className="h-4 w-4 text-red-600" /> : <Wifi className="h-4 w-4 text-green-600" />}
                    Simulate Server Network Blackout
                  </span>
                  <p className="font-mono text-[10px] text-gray-500 mt-1">
                    Forces primary REST requests to fail/timeout, simulating a severed fiber optic internet cable.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={networkBlackout}
                  onChange={(e) => setNetworkBlackout(e.target.checked)}
                  className="h-5 w-5 cursor-pointer accent-black"
                  data-testid="simulate-blackout-toggle"
                />
              </div>

              {/* Trigger Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLockdownDoors}
                  disabled={lockingInProgress}
                  className="neu-border neu-press flex items-center justify-center gap-1.5 bg-red-600 p-3 text-white font-mono text-xs font-black uppercase disabled:opacity-50"
                  data-testid="trigger-lockdown-btn"
                >
                  <Lock className="h-4 w-4" /> Trigger Lockdown
                </button>
                <button
                  type="button"
                  onClick={handleUnlockDoors}
                  disabled={lockingInProgress}
                  className="neu-border neu-press flex items-center justify-center gap-1.5 bg-white p-3 text-black font-mono text-xs font-black uppercase disabled:opacity-50"
                  data-testid="clear-lockdown-btn"
                >
                  <Unlock className="h-4 w-4" /> Reset / Open Doors
                </button>
              </div>

              {/* Status Stats */}
              <div className="border-2 border-black bg-yellow-100 p-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-yellow-900">
                  <Radio className="h-4 w-4 animate-pulse" />
                  LoRaWAN Radio Transmissions
                </span>
                <span className="font-mono text-sm font-black border-2 border-black bg-black text-white px-2 py-0.5" data-testid="transmissions-counter">
                  {transmissionsCount} Broad-cast(s)
                </span>
              </div>
            </div>

            {/* Doors and Telemetry */}
            <div className="space-y-4">
              <div>
                <span className="block font-mono text-xs font-bold uppercase mb-2">Exterior Doors Status</span>
                <div className="border-2 border-black bg-white divide-y-2 divide-black max-h-48 overflow-y-auto" data-testid="doors-status-list">
                  {doors.length === 0 ? (
                    <p className="p-3 font-mono text-xs text-gray-500 italic">No doors found for this building.</p>
                  ) : (
                    doors.map((door) => (
                      <div key={door.id} className="p-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-mono text-xs font-bold text-black">{door.door_name}</p>
                          <p className="font-mono text-[10px] text-gray-400">EUI: {door.lora_device_eui}</p>
                        </div>
                        <span
                          className={`
                            font-mono text-[10px] font-black uppercase px-2.5 py-1 border border-black shadow-[1px_1px_0_0_#000]
                            ${
                              door.status === "OPEN"
                                ? "bg-green-300 text-green-950"
                                : door.status === "LOCKED"
                                ? "bg-yellow-300 text-yellow-950"
                                : "bg-red-400 text-red-950"
                            }
                          `}
                          data-testid={`door-status-${door.id}`}
                        >
                          {door.status === "LOCKED_BY_LORA" ? "LOCKED (LoRa Fallback)" : door.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Real-time Logs */}
              <div>
                <span className="block font-mono text-xs font-bold uppercase mb-1">Safety Telemetry Logs</span>
                <div className="border-2 border-black bg-black text-lime-400 p-3 font-mono text-[11px] h-32 overflow-y-auto space-y-1" data-testid="telemetry-logs">
                  {safetyLogs.length === 0 ? (
                    <p className="text-gray-500 italic">// System standby. Initiate lockdown to see logs.</p>
                  ) : (
                    safetyLogs.map((log, index) => (
                      <p key={index} className="leading-tight">{log}</p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}