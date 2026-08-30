// =============================================================================
// Component: DMCATakedownPipeline
// Purpose: Allows university admins/legal team to view flagged copyright violations,
//   inspect match details, and download formal compliance logs.
// =============================================================================

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  DMCATakedownService,
  type DMCATakedownLog,
} from "@/services/dmcaTakedownService";
import { Button } from "@/components/ui/button";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Download from "lucide-react/dist/esm/icons/download";

export function DMCATakedownPipeline() {
  const [logs, setLogs] = useState<DMCATakedownLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock scan triggers for simulation/demo
  const [mockPhotoId, setMockPhotoId] = useState("");
  const [mockSong, setMockSong] = useState("Shake It Off");
  const [mockArtist, setMockArtist] = useState("Taylor Swift");
  const [mockConfidence, setMockConfidence] = useState(98.5);

  const loadLogs = async () => {
    setLoading(true);
    const data = await DMCATakedownService.fetchDMCALogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const handleExportCSV = () => {
    DMCATakedownService.exportComplianceCSV(logs);
    toast.success("DMCA compliance report exported successfully!");
  };

  const handleSimulateQuarantine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockPhotoId.trim()) {
      toast.error("Please enter a valid gallery photo/video UUID.");
      return;
    }

    try {
      const res = await DMCATakedownService.triggerDMCAQuarantine(
        mockPhotoId,
        mockSong,
        mockArtist,
        mockConfidence,
        { matched_song: mockSong, matched_artist: mockArtist, raw_response: "Simulated ACR Match" }
      );

      if (res.success) {
        toast.success(`DMCA Quarantine applied successfully! Student notified.`);
        setMockPhotoId("");
        void loadLogs();
      } else {
        toast.error(res.error || "Failed to trigger DMCA quarantine.");
      }
    } catch (err: any) {
      toast.error(err.message || "Simulated DMCA trigger error.");
    }
  };

  return (
    <div
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-none text-black font-mono mt-4"
      data-testid="dmca-pipeline-card"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-black pb-3 mb-6">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-black uppercase text-black">
            <ShieldAlert className="h-6 w-6 text-red-600 animate-bounce" /> DMCA Audio Fingerprint Quarantine Pipeline
          </h3>
          <p className="text-xs text-zinc-600 mt-1">
            Automated copyright infringement takedowns and formal compliance record keeping.
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          disabled={logs.length === 0}
          className="neu-border bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold uppercase px-4 py-2 border-2 border-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#000]"
          data-testid="export-compliance-btn"
        >
          <Download className="h-4 w-4" /> Export Compliance Log (CSV)
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Automated ACRCloud/AudibleMagic simulator trigger */}
        <div className="lg:col-span-1 border-2 border-black bg-zinc-50 p-4 shadow-[4px_4px_0_0_#000] h-fit">
          <span className="font-black text-xs uppercase text-zinc-700 block border-b pb-1 mb-3">
            ACRCloud Audio Scanner Mock
          </span>
          <form onSubmit={handleSimulateQuarantine} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase block text-zinc-500">Target Photo/Video UUID</label>
              <input
                type="text"
                placeholder="e.g. 00000000-0000-..."
                value={mockPhotoId}
                onChange={(e) => setMockPhotoId(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                data-testid="mock-photo-id-input"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase block text-zinc-500">Commercial Song Title</label>
              <input
                type="text"
                value={mockSong}
                onChange={(e) => setMockSong(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase block text-zinc-500">Commercial Artist Name</label>
              <input
                type="text"
                value={mockArtist}
                onChange={(e) => setMockArtist(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase block text-zinc-500">Match Confidence (%)</label>
              <input
                type="number"
                step="0.01"
                value={mockConfidence}
                onChange={(e) => setMockConfidence(Number(e.target.value))}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                required
              />
            </div>
            <Button
              type="submit"
              className="neu-border bg-red-500 hover:bg-red-400 text-black font-mono text-xs font-bold uppercase w-full py-2 shadow-[2px_2px_0_0_#000] border-2 border-black flex items-center justify-center gap-1.5 mt-4"
              data-testid="run-quarantine-btn"
            >
              Trigger Quarantine & Takedown
            </Button>
          </form>
        </div>

        {/* Right Column: Historical Takedown Compliance Logs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
            <span className="font-black text-xs uppercase text-zinc-700 block mb-3 flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Flagged Infringement Log History
            </span>

            {loading ? (
              <div className="text-center py-6 text-zinc-500 text-xs italic">
                Loading compliance log history...
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs italic border border-dashed border-zinc-200 bg-zinc-50 rounded">
                No copyright infringement takedown logs registered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-zinc-50">
                      <th className="p-2">Uploader</th>
                      <th className="p-2">Commercial Match</th>
                      <th className="p-2">Confidence</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Date Flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-black/5 hover:bg-zinc-50"
                        data-testid={`dmca-log-row-${log.id}`}
                      >
                        <td className="p-2 font-bold">{log.profiles?.full_name || "Unknown Student"}</td>
                        <td className="p-2">
                          <strong className="text-black font-black">{log.song_title}</strong> by {log.artist_name}
                        </td>
                        <td className="p-2 font-black text-red-600">{log.match_confidence.toFixed(1)}%</td>
                        <td className="p-2">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded border uppercase bg-red-50 border-red-200 text-red-800 animate-pulse">
                            QUARANTINED
                          </span>
                        </td>
                        <td className="p-2 text-zinc-500 text-[10px]">
                          {new Date(log.quarantined_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
