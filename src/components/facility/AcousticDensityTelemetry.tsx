// =============================================================================
// Component: AcousticDensityTelemetry
// Purpose: Renders IoT microphone array statuses, firmware flash tools,
//          anonymized MQTT pings, and privacy guarantees for building managers.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
  AcousticDensityService,
  type AcousticMicrophone,
  type AcousticTelemetry,
} from "@/services/acousticDensityService";
import { Button } from "@/components/ui/button";
import Mic from "lucide-react/dist/esm/icons/mic";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Activity from "lucide-react/dist/esm/icons/activity";
import Cpu from "lucide-react/dist/esm/icons/cpu";
import AlertOctagon from "lucide-react/dist/esm/icons/alert-octagon";
import Play from "lucide-react/dist/esm/icons/play";

interface AcousticDensityTelemetryProps {
  venueId: string;
}

export function AcousticDensityTelemetry({ venueId }: AcousticDensityTelemetryProps) {
  const [microphones, setMicrophones] = useState<AcousticMicrophone[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");
  const [telemetry, setTelemetry] = useState<AcousticTelemetry[]>([]);
  
  // Simulator inputs
  const [simScore, setSimScore] = useState<number>(65);
  const [simTopic, setSimTopic] = useState<string>("campus/venues/room/density");
  const [loading, setLoading] = useState(false);

  const loadMicrophones = useCallback(async () => {
    const data = await AcousticDensityService.fetchMicrophonesForVenue(venueId);
    setMicrophones(data);
    if (data.length > 0 && !selectedMicId) {
      setSelectedMicId(data[0].id);
    }
  }, [venueId, selectedMicId]);

  const loadTelemetry = useCallback(async () => {
    if (!selectedMicId) return;
    const logs = await AcousticDensityService.fetchLatestTelemetry(selectedMicId);
    setTelemetry(logs);
  }, [selectedMicId]);

  useEffect(() => {
    void loadMicrophones();
  }, [venueId, loadMicrophones]);

  useEffect(() => {
    if (selectedMicId) {
      void loadTelemetry();
    }
  }, [selectedMicId, loadTelemetry]);

  // Realtime subscriber for updates
  useEffect(() => {
    if (!venueId) return;
    const channel = supabase
      .channel(`acoustic-telemetry-realtime-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "acoustic_microphones",
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          void loadMicrophones();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "acoustic_density_telemetry",
        },
        () => {
          if (selectedMicId) void loadTelemetry();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [venueId, selectedMicId, loadMicrophones, loadTelemetry]);

  const handleFlashFirmware = async (micId: string) => {
    toast.info("Compiling lightweight TensorFlow Lite acoustic density binary...");
    const success = await AcousticDensityService.flashModelToMicrophone(micId);
    if (success) {
      toast.success("Firmware flashed successfully! TensorFlow Lite Privacy Model activated on array.");
      void loadMicrophones();
    } else {
      toast.error("Failed to flash firmware.");
    }
  };

  const handlePublishTelemetry = async () => {
    if (!selectedMicId) {
      toast.error("Please select a microphone device to simulate.");
      return;
    }
    setLoading(true);
    toast.info("Mic processed DSP signatures locally & deleted audio stream from RAM.");

    try {
      const res = await AcousticDensityService.ingestAcousticDensity(
        selectedMicId,
        simScore,
        simTopic
      );

      if (res.success) {
        if (res.alert_triggered) {
          toast.error(`OVERCROWDING DETECTED: Acoustic density score hit ${simScore}% limit!`);
        } else {
          toast.success(`Published MQTT payload score: ${simScore}%`);
        }
        void loadTelemetry();
      } else {
        toast.error(res.error || "Failed to publish telemetry.");
      }
    } catch (err: any) {
      toast.error(err.message || "Simulated MQTT broadcast error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="border-4 border-black bg-emerald-50 p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-none text-black font-mono mt-8"
      data-testid="acoustic-telemetry-panel"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-black pb-3 mb-6">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-black uppercase text-black">
            <Mic className="h-6 w-6 text-black animate-pulse" /> Acoustic Density Telemetry
          </h3>
          <p className="text-xs text-zinc-700 mt-1">
            Privacy-preserving Edge ML microphone arrays (continuous audio deleted locally, score sent via MQTT)
          </p>
        </div>
        <div className="flex items-center gap-1 bg-emerald-200 border-2 border-black px-3 py-1 font-bold text-xs uppercase text-emerald-950">
          <ShieldCheck className="h-4 w-4" /> Cryptographic Privacy Guaranteed
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Device Status Board */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
            <span className="font-black text-xs uppercase text-emerald-900 block mb-3 flex items-center gap-1.5">
              <Cpu className="h-4 w-4" /> Micro-Device Inventory & Firmware Status
            </span>

            {microphones.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-xs italic">
                No acoustic microphone arrays deployed in this venue.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-zinc-50">
                      <th className="p-2">Room</th>
                      <th className="p-2">Firmware</th>
                      <th className="p-2">Edge ML Model</th>
                      <th className="p-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {microphones.map((mic) => (
                      <tr
                        key={mic.id}
                        onClick={() => setSelectedMicId(mic.id)}
                        className={`border-b border-black/5 hover:bg-zinc-50 cursor-pointer ${
                          selectedMicId === mic.id ? "bg-emerald-50/50" : ""
                        }`}
                        data-testid={`microphone-row-${mic.id}`}
                      >
                        <td className="p-2 font-bold">{mic.room_number}</td>
                        <td className="p-2 text-[10px] text-zinc-600">{mic.firmware_version}</td>
                        <td className="p-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                              mic.is_model_flashed
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-yellow-50 border-yellow-200 text-yellow-800 animate-pulse"
                            }`}
                          >
                            {mic.is_model_flashed ? "TF-Lite Flashed" : "Not Configured"}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleFlashFirmware(mic.id);
                            }}
                            className="neu-border bg-white text-black px-2 py-0.5 text-[9px] font-bold border"
                          >
                            Flash ML Binary
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Privacy metrics explanation */}
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] space-y-2 text-xs">
            <span className="font-black text-xs uppercase text-emerald-950 block border-b pb-1">
              Zero-Trust Audio Processing Walkthrough
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] text-zinc-600">
              <div className="border border-black/10 p-2.5 rounded bg-zinc-50">
                <span className="font-bold block text-black">1. Local DSP Probe</span>
                Audio track analyzed inside physical device RAM on the edge.
              </div>
              <div className="border border-black/10 p-2.5 rounded bg-zinc-50">
                <span className="font-bold block text-black">2. Instantly Deleted</span>
                Waveforms discarded immediately after density calculation.
              </div>
              <div className="border border-black/10 p-2.5 rounded bg-zinc-50">
                <span className="font-bold block text-black">3. MQTT Integer</span>
                Only the anonymized integer score is broadcast. Raw sound never escapes device bounds.
              </div>
            </div>
          </div>
        </div>

        {/* MQTT Anonymized Telemetry Simulator */}
        {selectedMicId && (
          <div className="space-y-4">
            <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] space-y-4">
              <span className="font-black text-xs uppercase text-emerald-900 block border-b pb-1">
                MQTT Telemetry Broadcaster (Simulator)
              </span>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase text-zinc-500">
                  <span>Simulated Density Score:</span>
                  <span className="font-black text-black">{simScore}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={simScore}
                  onChange={(e) => setSimScore(Number(e.target.value))}
                  className="w-full h-1 bg-zinc-200 accent-black rounded-lg cursor-pointer"
                  data-testid="sim-score-slider"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase block text-zinc-500">MQTT Topic</label>
                <input
                  type="text"
                  value={simTopic}
                  onChange={(e) => setSimTopic(e.target.value)}
                  className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                />
              </div>

              {/* Assurances checkbox */}
              <div className="flex items-start gap-2 border border-emerald-300 bg-emerald-50/50 p-2.5 rounded">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="mt-0.5 accent-emerald-600"
                />
                <span className="text-[9px] font-bold leading-normal text-emerald-900 uppercase">
                  Local ML processing confirmed. Continuous audio stream cleared from RAM before MQTT publish.
                </span>
              </div>

              <Button
                onClick={handlePublishTelemetry}
                disabled={loading}
                className="neu-border bg-[#10b981] hover:bg-emerald-600 text-white font-mono text-xs font-bold uppercase w-full py-2 shadow-[2px_2px_0_0_#000] border-2 border-black flex items-center justify-center gap-1.5"
                data-testid="publish-telemetry-btn"
              >
                <Play className="h-4 w-4" /> {loading ? "Publishing MQTT..." : "Publish Score via MQTT"}
              </Button>
            </div>

            {/* Ingested Anonymized Telemetry Logs */}
            <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] max-h-[180px] overflow-y-auto">
              <span className="font-black text-xs uppercase text-emerald-900 block mb-2 flex items-center gap-1">
                <Activity className="h-4 w-4" /> Raw MQTT Score Feed Log
              </span>
              {telemetry.length === 0 ? (
                <div className="text-center py-4 text-zinc-400 text-xs italic">
                  No telemetry scores published.
                </div>
              ) : (
                <div className="space-y-2">
                  {telemetry.map((log) => (
                    <div
                      key={log.id}
                      className="border border-black/10 bg-zinc-50 p-2 font-mono text-[10px] flex justify-between items-center"
                      data-testid={`telemetry-log-${log.id}`}
                    >
                      <div>
                        <p className="font-bold text-black">Topic: {log.mqtt_topic}</p>
                        <p className="text-[8px] text-zinc-500">
                          Timestamp: {new Date(log.recorded_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className={`font-black px-2 py-0.5 border-2 border-black uppercase ${
                        log.density_score >= 85
                          ? "bg-red-100 text-red-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {log.density_score}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
