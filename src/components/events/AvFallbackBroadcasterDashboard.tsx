import React, { useState } from "react";
import {
  Radio,
  Video,
  Play,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  Sparkles,
  Zap,
  Mic,
  Monitor,
} from "lucide-react";
import {
  FallbackBroadcasterState,
  evaluatePresenterPingFailure,
  executeCutToLive,
  executeCutToFallback,
} from "@/lib/avFallbackBroadcaster";
import { cn } from "@/lib/utils";

export interface AvFallbackBroadcasterDashboardProps {
  eventId?: string;
  eventTitle?: string;
  initialState?: FallbackBroadcasterState;
  onSourceSwapped?: (state: FallbackBroadcasterState) => void;
  className?: string;
}

export const AvFallbackBroadcasterDashboard: React.FC<AvFallbackBroadcasterDashboardProps> = ({
  eventId = "evt-keynote-2026",
  eventTitle = "Keynote Address — Campus Innovation Summit 2026",
  initialState,
  onSourceSwapped,
  className,
}) => {
  const [broadcasterState, setBroadcasterState] = useState<FallbackBroadcasterState>(() => {
    return initialState || evaluatePresenterPingFailure(false, undefined, eventId);
  });

  const [isCrossfading, setIsCrossfading] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCutToLive = () => {
    setIsCrossfading(true);
    setTimeout(() => {
      const updated = executeCutToLive(broadcasterState);
      setBroadcasterState(updated);
      setIsCrossfading(false);

      if (onSourceSwapped) onSourceSwapped(updated);

      setNotice("Seamlessly crossfaded stream from Fallback Slate to Live Presenter WebRTC feed!");
      setTimeout(() => setNotice(null), 5000);
    }, 1000); // 1000ms crossfade
  };

  const handleEmergencyCutToFallback = () => {
    const updated = executeCutToFallback(broadcasterState);
    setBroadcasterState(updated);

    if (onSourceSwapped) onSourceSwapped(updated);

    setNotice("EMERGENCY CUT: Stream source reverted back to Fallback Slate MP4 loop.");
    setTimeout(() => setNotice(null), 5000);
  };

  const isLive = broadcasterState.activeSource === "live_webrtc";

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-rose-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-rose-950">
            <Radio className="w-5 h-5 text-rose-600 animate-pulse" />
            <span>"Audio/Visual Check" Fallback Broadcaster — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Automated WebRTC source swapping. Plays fallback MP4 slate loop on presenter ping failure and allows seamless 1-click crossfade to live presenter feed.
          </p>
        </div>

        <span
          className={cn(
            "px-3 py-1 text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
            isLive ? "bg-rose-600 animate-pulse" : "bg-indigo-900"
          )}
        >
          <Video className="w-3.5 h-3.5" />
          <span>{isLive ? "🔴 LIVE WebRTC Presenter Feed" : "🟢 Fallback Slate Active"}</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Broadcast Source Monitor Canvas & Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Left Column: Live Monitor Canvas */}
        <div className="lg:col-span-2 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-rose-600" />
              Live Broadcast Monitor Canvas (Output Stream)
            </h4>
            <span className="text-[11px] font-mono text-gray-500">
              Source: {broadcasterState.activeSource.toUpperCase()}
            </span>
          </div>

          {/* Video Canvas Container */}
          <div className="relative aspect-video bg-slate-950 border-2 border-black rounded-lg overflow-hidden flex flex-col justify-between p-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-white">
            <div className="flex justify-between items-center z-10">
              <span
                className={cn(
                  "px-2.5 py-1 text-[10px] font-bold rounded uppercase flex items-center gap-1 border border-black",
                  isLive ? "bg-rose-600 text-white animate-pulse" : "bg-indigo-600 text-white"
                )}
              >
                {isLive ? "🔴 LIVE BROADCAST" : "🟢 SLATE LOOP PLAYBACK"}
              </span>
              <span className="text-[10px] font-mono bg-black/70 px-2 py-1 rounded text-gray-300">
                Crossfade: {isCrossfading ? "TRANSITIONING (1000ms)..." : "STABLE"}
              </span>
            </div>

            {/* Video Content Graphics */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-2">
              {isLive ? (
                <div className="space-y-2">
                  <Mic className="w-12 h-12 text-rose-500 animate-pulse mx-auto" />
                  <p className="font-black text-base text-white uppercase font-mono tracking-wide">
                    Live Presenter WebRTC Stream Active
                  </p>
                  <p className="text-xs font-sans text-gray-300">
                    High-definition audio & video track broadcasting to 500 attendees.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 bg-indigo-950/80 p-6 rounded-lg border border-indigo-700 max-w-md">
                  <Play className="w-10 h-10 text-indigo-400 animate-bounce mx-auto" />
                  <p className="font-black text-sm text-indigo-200 uppercase font-mono">
                    "Starting Soon..." Fallback Slate Loop
                  </p>
                  <p className="text-xs font-sans text-indigo-300">
                    Presenter failed ping check. Playback slate loop active until organizer cuts to live.
                  </p>
                </div>
              )}
            </div>

            {/* Stream Telemetry Bar */}
            <div className="z-10 bg-slate-950/80 p-2 rounded text-[10px] font-mono text-gray-300 flex justify-between items-center border border-slate-800">
              <span className="truncate">Active Source: {broadcasterState.fallbackSlateUrl}</span>
              <span className="text-emerald-400 font-bold shrink-0 ml-2">WebRTC Sync OK</span>
            </div>
          </div>
        </div>

        {/* Right Column: Presenter Ping Status & Organizer Control Panel */}
        <div className="lg:col-span-1 p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Zap className="w-4 h-4 text-rose-600" />
            Organizer Stream Controls
          </h4>

          {/* Presenter Ping Readiness Card */}
          <div
            className={cn(
              "p-3.5 border-2 border-black rounded-lg space-y-1 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
              broadcasterState.presenterPingPassed ? "bg-emerald-50 text-emerald-950" : "bg-rose-50 text-rose-950"
            )}
          >
            <div className="flex items-center gap-1.5 font-bold uppercase text-[11px]">
              {broadcasterState.presenterPingPassed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              <span>Presenter Ping: {broadcasterState.presenterPingPassed ? "PASSED" : "FAILED / AFK"}</span>
            </div>
            <p className="text-[11px] font-sans leading-snug">
              {broadcasterState.presenterPingPassed
                ? "Presenter confirmed AV readiness. Ready for live broadcast."
                : "Presenter failed automated ping check. Fallback MP4 slate loop active to prevent black screen."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={isLive || isCrossfading}
              onClick={handleCutToLive}
              className="w-full py-3 px-4 border-2 border-black bg-rose-600 text-white font-bold text-xs uppercase rounded-md hover:bg-rose-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Scissors className="w-4 h-4 text-amber-300" />
              Cut to Live (1s Crossfade)
            </button>

            <button
              type="button"
              disabled={!isLive || isCrossfading}
              onClick={handleEmergencyCutToFallback}
              className="w-full py-2.5 px-4 border-2 border-black bg-slate-200 text-slate-900 font-bold text-xs uppercase rounded-md hover:bg-slate-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 text-indigo-700" />
              Emergency Cut to Slate Loop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
