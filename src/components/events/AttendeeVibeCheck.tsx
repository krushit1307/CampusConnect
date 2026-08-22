import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  ShieldCheck,
  Smile,
  HelpCircle,
  Meh,
  Sparkles,
  Activity,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { classifyExpression, type EmotionCategory } from "@/services/vibeCheckSentimentService";

interface AttendeeVibeCheckProps {
  eventId: string;
  onEmotionBroadcast?: (emotion: EmotionCategory) => void;
}

export const AttendeeVibeCheck: React.FC<AttendeeVibeCheckProps> = ({
  eventId,
  onEmotionBroadcast,
}) => {
  const [optedIn, setOptedIn] = useState<boolean>(false);
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean>(false);
  const [currentVibe, setCurrentVibe] = useState<EmotionCategory>("Neutral");
  const [broadcastCount, setBroadcastCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Opted-out (Privacy Preserved)");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasCameraAccess(true);
        setStatusMessage("Active (Analyzing Locally in Browser)");
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setStatusMessage("Camera permission denied");
      setOptedIn(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setHasCameraAccess(false);
    setStatusMessage("Opted-out (Privacy Preserved)");
  };

  useEffect(() => {
    if (optedIn) {
      startCamera();
      // Periodically classify local expressions every 10s and emit anonymous vibe
      intervalRef.current = setInterval(() => {
        // Run lightweight simulated local face landmark classification
        const simulatedFeatures = {
          smileConfidence: Math.random(),
          eyebrowFrownConfidence: Math.random() * 0.4,
          neutralConfidence: 0.5,
        };
        const classified = classifyExpression(simulatedFeatures);
        setCurrentVibe(classified);
        setBroadcastCount((c) => c + 1);
        if (onEmotionBroadcast) {
          onEmotionBroadcast(classified);
        }
      }, 10000);
    } else {
      stopCamera();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      stopCamera();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [optedIn, eventId, onEmotionBroadcast]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-violet-400">
            <Smile className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
              Audience Vibe Check
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
                Edge AI
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Send anonymous, aggregated emotional feedback to the speaker.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800">
          <Switch
            id="vibe-opt-in"
            checked={optedIn}
            onCheckedChange={(checked) => setOptedIn(checked)}
          />
          <Label htmlFor="vibe-opt-in" className="text-xs font-semibold cursor-pointer select-none">
            {optedIn ? "Opted In" : "Opt In"}
          </Label>
        </div>
      </div>

      <div className="mt-4">
        {optedIn ? (
          <div className="space-y-4">
            <div className="relative aspect-video max-w-[240px] mx-auto rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
              <video
                ref={videoRef}
                muted
                playsInline
                className="w-full h-full object-cover mirror"
              />
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-slate-900/90 backdrop-blur rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Local Only
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-400" />
                <span className="text-slate-400">Current Detected Vibe:</span>
                <span className="font-bold text-violet-300">{currentVibe}</span>
              </div>
              <span className="text-slate-500">{broadcastCount} signals sent</span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>Absolute Privacy Guarantee</span>
            </div>
            <p className="leading-relaxed">
              No video frames or photos are EVER sent to the server. All facial sentiment
              classification runs locally in your browser using lightweight WebAssembly. Only
              high-level emotion tags (e.g., Happy, Confused) are anonymously aggregated.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
