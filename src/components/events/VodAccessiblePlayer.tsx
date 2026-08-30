import React, { useState } from "react";
import {
  PlayCircle,
  Captions,
  Loader2,
  CheckCircle2,
  Clock,
  Settings,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const VodAccessiblePlayer: React.FC = () => {
  const [vodStatus, setVodStatus] = useState<"pending" | "processing" | "ready">("ready");
  const [useSyncedCaptions, setUseSyncedCaptions] = useState(true);

  const mockVod = {
    title: "Keynote: The Future of Quantum Computing",
    date: "Aug 29, 2026",
    duration: "45:20",
    video_url: "https://example.com/mock-video.mp4",
    raw_vtt_url: "https://example.com/raw.vtt",
    synced_vtt_url: "https://example.com/synced.vtt",
  };

  const handleSyncCaptions = () => {
    setVodStatus("processing");
    setTimeout(() => {
      setVodStatus("ready");
      setUseSyncedCaptions(true);
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <PlayCircle className="h-8 w-8 text-indigo-500" />
            Video-On-Demand (VOD) Replay
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-2xl leading-relaxed">
            Accessible, perfectly timed closed captions generated asynchronously via FFmpeg audio
            extraction and Deepgram batch processing.
          </p>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800 shadow-2xl overflow-hidden">
        <CardHeader className="bg-slate-950 border-b border-slate-800 flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-white text-lg">{mockVod.title}</CardTitle>
            <CardDescription className="text-slate-400 font-mono text-xs mt-1">
              Recorded: {mockVod.date} | {mockVod.duration}
            </CardDescription>
          </div>

          {vodStatus === "pending" && (
            <Button
              onClick={handleSyncCaptions}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-xs"
            >
              <RefreshCw className="mr-2 h-3 w-3" /> Fix Caption Sync (Start Worker)
            </Button>
          )}
          {vodStatus === "processing" && (
            <div className="flex items-center gap-2 text-indigo-400 bg-indigo-950/30 px-3 py-1.5 rounded-full border border-indigo-900/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">
                FFmpeg Aligning Audio...
              </span>
            </div>
          )}
          {vodStatus === "ready" && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-900/50">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Captions Perfectly Synced
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0 relative bg-black aspect-video flex items-center justify-center group">
          {/* Mock Video Player Element */}
          <div className="absolute inset-0 flex flex-col justify-end pb-12 bg-gradient-to-t from-black/80 via-transparent to-transparent">
            {/* The actual video element would be here */}
            {/* <video controls className="absolute inset-0 w-full h-full">
                <source src={mockVod.video_url} type="video/mp4" />
                <track 
                  kind="captions" 
                  src={useSyncedCaptions ? mockVod.synced_vtt_url : mockVod.raw_vtt_url} 
                  srcLang="en" 
                  label="English" 
                  default 
                />
            </video> */}

            {/* Mock Subtitles Overlay */}
            {vodStatus === "ready" && useSyncedCaptions ? (
              <div className="text-center w-full px-12 mb-8">
                <span className="bg-black/80 text-white font-bold text-2xl px-4 py-2 rounded">
                  Welcome to the Machine Learning Seminar.
                </span>
              </div>
            ) : (
              <div className="text-center w-full px-12 mb-8 opacity-50">
                <span className="bg-red-900/80 text-red-100 font-bold text-2xl px-4 py-2 rounded border border-red-500">
                  (Out of sync by -5.2s) Welcome to...
                </span>
              </div>
            )}
          </div>

          {/* Fake Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-slate-900/90 border-t border-slate-800 flex items-center px-4 justify-between backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-4">
              <PlayCircle className="h-6 w-6 text-white cursor-pointer hover:text-indigo-400" />
              <div className="text-xs text-white font-mono">00:00:00 / {mockVod.duration}</div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setUseSyncedCaptions(!useSyncedCaptions)}
                disabled={vodStatus !== "ready"}
                className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded transition-colors ${useSyncedCaptions ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}
                title="Toggle Captions Track"
              >
                <Captions className="h-4 w-4" />
                {useSyncedCaptions ? "Synced VTT" : "Raw WebRTC VTT (Laggy)"}
              </button>
              <Settings className="h-5 w-5 text-white cursor-pointer" />
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-slate-950 p-4 border-t border-slate-800">
          <div className="w-full flex justify-between text-xs font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Audio Extraction Offset Compensated: +5.20s
            </span>
            <span>Deepgram Engine: Nova-2</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VodAccessiblePlayer;
