import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Film from "lucide-react/dist/esm/icons/film";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import ScanFace from "lucide-react/dist/esm/icons/scan-face";

interface LipSyncCheckerWidgetProps {
  userId: string;
}

interface CheckRecord {
  id: string;
  video_name: string;
  correlation_score: number;
  is_fake: boolean;
  status: "SAFE" | "QUARANTINED";
  created_at: string;
}

export function LipSyncCheckerWidget({ userId }: LipSyncCheckerWidgetProps) {
  const [records, setRecords] = useState<CheckRecord[]>([]);
  const [videoName, setVideoName] = useState("president_speech.mp4");
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecords = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("video_lipsync_checks")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setRecords(data);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleVerifyVideo = async () => {
    if (!videoName) return alert("Please enter a video file name.");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("analyze-video-lipsync", {
        body: {
          videoName,
          userId,
        },
      });

      if (error) throw error;

      alert(
        `Analysis Complete! Status: ${data.status} | Correlation Score: ${data.correlationScore}`,
      );
      fetchRecords();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to analyze video.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="lipsync-checker-widget"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs my-6 space-y-6"
    >
      <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2 border-b-4 border-black pb-3">
        <ScanFace className="text-fuchsia-600 animate-pulse" size={18} />
        Automated Multimodal Deepfake Lip-Sync Analyser
      </h3>

      <div className="space-y-4">
        <h4 className="font-bold uppercase flex items-center gap-1.5">
          <Film size={14} /> Scan Video Upload
        </h4>
        <div className="flex gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <label>Video File Name (Simulated Upload)</label>
            <input
              type="text"
              value={videoName}
              onChange={(e) => setVideoName(e.target.value)}
              className="border-2 border-black px-2 py-1.5"
              data-testid="lipsync-video-input"
            />
          </div>
          <button
            onClick={handleVerifyVideo}
            disabled={isLoading}
            data-testid="lipsync-verify-btn"
            className="border-2 border-black bg-yellow-300 px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000] self-end"
          >
            {isLoading ? "Scanning Sync..." : "Analyse Video"}
          </button>
        </div>
      </div>

      {/* Verification History Logs */}
      <div className="border-t-4 border-black pt-4">
        <h4 className="font-bold uppercase mb-3 text-zinc-700">Deepfake Lip-Sync Scan Logs</h4>
        {records.length === 0 ? (
          <div className="bg-slate-50 border-2 border-black p-4 text-center text-gray-500">
            No video files scanned yet.
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((r) => (
              <div
                key={r.id}
                data-testid={`lipsync-record-${r.id}`}
                className={`border-2 border-black p-3 flex justify-between items-center ${
                  r.status === "QUARANTINED" ? "bg-red-50" : "bg-slate-50"
                }`}
              >
                <div>
                  <span className="font-bold block flex items-center gap-1.5">
                    {r.status === "QUARANTINED" && (
                      <ShieldAlert className="text-red-650" size={14} />
                    )}
                    {r.video_name}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Phoneme Match Score: <strong>{r.correlation_score}</strong>
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-[10px] uppercase font-black px-2 py-1 border-2 border-black inline-block ${
                      r.status === "QUARANTINED"
                        ? "bg-red-200 text-red-800"
                        : "bg-emerald-200 text-emerald-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
