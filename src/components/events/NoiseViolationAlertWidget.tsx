// =============================================================================
// Component: NoiseViolationAlertWidget
// Issue: #3684 - Build a 'Real-Time "Decibel/Noise" Violation Alert'
// Description: Organizer Dashboard alert banner displaying real-time decibel threshold
// violations (dB > 90 for 5 mins) and institutional liability audit logs.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getEventNoiseViolations,
  processIoTNoiseAlert,
  type NoiseViolationLog,
} from "@/services/noiseViolationService";
import Volume2 from "lucide-react/dist/esm/icons/volume-2";
import AlertOctagon from "lucide-react/dist/esm/icons/alert-octagon";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import History from "lucide-react/dist/esm/icons/history";
import Radio from "lucide-react/dist/esm/icons/radio";

interface NoiseViolationAlertWidgetProps {
  eventId: string;
  venueId?: string;
  venueName?: string;
}

export function NoiseViolationAlertWidget({
  eventId,
  venueId = "venue-student-union",
  venueName = "Student Union Hall",
}: NoiseViolationAlertWidgetProps) {
  const [logs, setLogs] = useState<NoiseViolationLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const fetchLogs = useCallback(async () => {
    if (!eventId) return;
    setIsLoading(true);
    const data = await getEventNoiseViolations(eventId);
    setLogs(data);
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    void fetchLogs();

    if (!eventId) return;
    const supabase = createClient();

    // Subscribe to Supabase Realtime noise_violation_logs table
    const channel = supabase
      .channel(`noise-alerts-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "noise_violation_logs",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newLog = payload.new as NoiseViolationLog;
          if (newLog) {
            setLogs((prev) => [newLog, ...prev]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchLogs]);

  const handleSimulateIoTAlert = async () => {
    setIsSimulating(true);
    await processIoTNoiseAlert(venueId, venueName, 94, 5, eventId);
    await fetchLogs();
    setIsSimulating(false);
  };

  if (isLoading) return null;

  const latestLog = logs[0];

  return (
    <div data-testid="noise-violation-widget" className="space-y-6 my-6">
      {/* MASSIVE RED FLASHING WARNING BANNER */}
      {latestLog && (
        <div
          data-testid="critical-noise-alert-banner"
          className="bg-red-950/90 border-4 border-red-500 rounded-3xl p-6 text-white shadow-2xl animate-pulse"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 bg-red-600 rounded-2xl shrink-0 shadow-lg shadow-red-600/40">
                <AlertOctagon className="w-8 h-8 text-yellow-300" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-wider text-red-100">
                    🚨 NOISE ORDINANCE VIOLATION ALERT
                  </h3>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-yellow-400 text-slate-950">
                    WARNING #{latestLog.warning_count}
                  </span>
                </div>

                <p className="text-base md:text-lg font-bold text-yellow-200 mt-2 leading-relaxed">
                  {latestLog.alert_message}
                </p>

                <div className="flex items-center gap-4 text-xs font-mono text-slate-300 mt-2">
                  <span>
                    Detected Noise:{" "}
                    <strong className="text-red-400 font-black">{latestLog.decibels} dB</strong>
                  </span>
                  <span>
                    Duration:{" "}
                    <strong className="text-red-400 font-black">
                      {latestLog.duration_minutes} mins
                    </strong>
                  </span>
                  <span>Venue: {latestLog.venue_name}</span>
                </div>
              </div>
            </div>

            {/* Test Hardware Trigger */}
            <button
              type="button"
              onClick={handleSimulateIoTAlert}
              disabled={isSimulating}
              data-testid="simulate-noise-alert-btn"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-colors shrink-0"
            >
              {isSimulating ? "Simulating..." : "Simulate IoT Telemetry"}
            </button>
          </div>
        </div>
      )}

      {/* LIABILITY AUDIT LOG TABLE */}
      {logs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-indigo-400" />
              <div>
                <h4 className="text-base font-bold text-white">
                  Institutional Liability Audit Log
                </h4>
                <p className="text-xs text-slate-400">
                  Recorded decibel violations to document warning compliance & protect against
                  liability
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-xs font-mono flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> {logs.length} Warnings Logged
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase">
                  <th className="pb-3">Warning #</th>
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3">Noise (dB)</th>
                  <th className="pb-3">Sustained Duration</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} data-testid={`liability-log-row-${log.id}`}>
                    <td className="py-3 font-bold text-red-400">Warning #{log.warning_count}</td>
                    <td className="py-3 text-slate-400">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-3 font-bold text-white">{log.decibels} dB</td>
                    <td className="py-3">{log.duration_minutes} mins</td>
                    <td className="py-3">
                      <span className="px-2.5 py-1 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                        Logged for Liability Audit
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
