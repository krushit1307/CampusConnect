import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import Skull from "lucide-react/dist/esm/icons/skull";
import Play from "lucide-react/dist/esm/icons/play";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";

interface TarpitSession {
  id: string;
  ip_address: string;
  fingerprint: string | null;
  trigger_reason: string;
  is_active: boolean;
  session_start: string;
}

export function HoneyPotTrapWidget() {
  const [sessions, setSessions] = useState<TarpitSession[]>([]);
  const [currentFp, setCurrentFp] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchTarpitSessions = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tarpit_sessions")
      .select("*")
      .order("session_start", { ascending: false });
    if (data) setSessions(data);
  };

  useEffect(() => {
    fetchTarpitSessions();
    getDeviceFingerprint().then((fp) => setCurrentFp(fp));
  }, []);

  const triggerHoneyPotHit = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const fp = await getDeviceFingerprint();

      // Trigger the validate-secret-link Edge Function with a honeypot hash
      const { data, error } = await supabase.functions.invoke("validate-secret-link", {
        body: {
          eventId: "00000000-0000-0000-0000-000000000000", // Dummy UUID
          unlockHash: "honeypot",
        },
        headers: {
          "x-device-fingerprint": fp,
        },
      });

      alert("Honeypot link clicked! Device fingerprint logged and routed to tarpit.");
      fetchTarpitSessions();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const deactivateSession = async (id: string) => {
    try {
      const supabase = createClient();
      await supabase.from("tarpit_sessions").update({ is_active: false }).eq("id", id);
      alert("Session deactivated. Device released from tarpit.");
      fetchTarpitSessions();
    } catch (err) {
      alert("Deactivation failed.");
    }
  };

  return (
    <div
      data-testid="honeypot-trap-widget"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6 space-y-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 border-b-4 border-black pb-3">
        <Skull className="text-purple-600 animate-bounce" size={18} />
        WebGL Canvas Fingerprinting Honeypot Trap
      </h3>

      {/* Honey pot trap trigger */}
      <div className="space-y-3">
        <h4 className="font-bold uppercase">Honeypot Trigger Link</h4>
        <p className="text-[10px] text-gray-500">
          This invisible link is placed on pages to trap scraper bots. Clicking it immediately
          registers the WebGL fingerprint to the tarpit.
        </p>
        <button
          onClick={triggerHoneyPotHit}
          disabled={isLoading}
          data-testid="trigger-honeypot-btn"
          className="border-2 border-black bg-red-100 text-red-700 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000] flex items-center gap-2 hover:bg-red-200"
        >
          <Play size={14} /> Click Honeypot Link (Simulate Bot)
        </button>
      </div>

      {/* Current Browser Signature */}
      <div className="bg-slate-100 p-3 border-2 border-black space-y-1">
        <div>
          Your Browser Fingerprint:{" "}
          <strong className="text-indigo-600">{currentFp || "generating..."}</strong>
        </div>
      </div>

      {/* Log of trapped bots */}
      <div className="border-t-4 border-black pt-4 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="font-bold uppercase">Active Trapped Devices</h4>
          <button
            onClick={fetchTarpitSessions}
            className="border-2 border-black p-1 bg-slate-50 hover:bg-slate-100"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-slate-50 border-2 border-black p-4 text-center text-gray-500">
            No devices currently tarpitted.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                data-testid={`tarpit-session-${session.id}`}
                className={`border-2 border-black p-3 space-y-1.5 ${
                  session.is_active ? "bg-purple-50" : "bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <strong>Fingerprint: {session.fingerprint || "None"}</strong>
                  <span
                    className={`px-2 py-0.5 border text-[10px] font-bold uppercase ${
                      session.is_active
                        ? "bg-purple-100 text-purple-700 border-purple-600 animate-pulse"
                        : "bg-slate-200 text-slate-600 border-slate-500"
                    }`}
                  >
                    {session.is_active ? "Tarpitted" : "Released"}
                  </span>
                </div>
                <div className="text-[10px] text-gray-600">
                  IP: {session.ip_address} | Reason: {session.trigger_reason} | Start:{" "}
                  {new Date(session.session_start).toLocaleString()}
                </div>
                {session.is_active && (
                  <button
                    onClick={() => deactivateSession(session.id)}
                    className="border-2 border-black bg-white px-2 py-0.5 text-[10px] font-bold hover:bg-slate-100"
                  >
                    Release Device
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
