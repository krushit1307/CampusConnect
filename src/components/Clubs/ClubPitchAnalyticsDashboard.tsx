import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  TrendingDown,
  Clock,
  Users,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronRight,
  Radio,
} from "lucide-react";
import {
  PitchTelemetryPing,
  PitchRetentionAnalytics,
  calculatePitchRetentionCurve,
  formatRetentionTimestamp,
} from "@/lib/clubPitchAnalytics";
import { cn } from "@/lib/utils";

export interface ClubPitchAnalyticsDashboardProps {
  clubId?: string;
  clubName?: string;
  pitchId?: string;
  pitchTitle?: string;
  pitchDurationSec?: number;
  initialTelemetry?: PitchTelemetryPing[];
  onPingSent?: (ping: PitchTelemetryPing) => void;
  className?: string;
}

export const MOCK_TELEMETRY_PINGS: PitchTelemetryPing[] = [
  // 10 listens, heavy drop-off around 15 seconds
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-1", maxTimeListenedSec: 60, totalDurationSec: 60, swipedAway: false },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-2", maxTimeListenedSec: 60, totalDurationSec: 60, swipedAway: false },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-3", maxTimeListenedSec: 55, totalDurationSec: 60, swipedAway: false },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-4", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-5", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-6", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-7", maxTimeListenedSec: 20, totalDurationSec: 60, swipedAway: true },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-8", maxTimeListenedSec: 10, totalDurationSec: 60, swipedAway: true },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-9", maxTimeListenedSec: 30, totalDurationSec: 60, swipedAway: true },
  { clubId: "club-1", pitchId: "pitch-60s", sessionId: "sess-10", maxTimeListenedSec: 60, totalDurationSec: 60, swipedAway: false },
];

export const ClubPitchAnalyticsDashboard: React.FC<ClubPitchAnalyticsDashboardProps> = ({
  clubId = "club-cs-1",
  clubName = "Computer Science Society",
  pitchId = "pitch-60s",
  pitchTitle = "Join the 2026 Hackathon Team! (60-Sec Audio Pitch)",
  pitchDurationSec = 60,
  initialTelemetry = MOCK_TELEMETRY_PINGS,
  onPingSent,
  className,
}) => {
  const [telemetry, setTelemetry] = useState<PitchTelemetryPing[]>(initialTelemetry);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [sessionId] = useState<string>(() => `sess-sim-${Math.floor(Math.random() * 10000)}`);
  const [lastPingTime, setLastPingTime] = useState<number>(0);
  const [pingLogMessage, setPingLogMessage] = useState<string | null>(null);

  const analytics: PitchRetentionAnalytics = calculatePitchRetentionCurve(telemetry, pitchDurationSec);

  // Simulated audio player timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentTimeSec((prev) => {
          if (prev >= pitchDurationSec) {
            setIsPlaying(false);
            return pitchDurationSec;
          }
          const next = prev + 1;

          // Send telemetry ping every 5 seconds (#4271)
          if (next > 0 && next % 5 === 0 && next > lastPingTime) {
            sendTelemetryPing(next, false);
            setLastPingTime(next);
          }
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, lastPingTime, pitchDurationSec]);

  const sendTelemetryPing = (maxSec: number, swipedAway: boolean) => {
    const newPing: PitchTelemetryPing = {
      clubId,
      pitchId,
      sessionId,
      maxTimeListenedSec: maxSec,
      totalDurationSec: pitchDurationSec,
      swipedAway,
      timestamp: Date.now(),
    };

    setTelemetry((prev) => [...prev, newPing]);
    if (onPingSent) onPingSent(newPing);

    setPingLogMessage(
      swipedAway
        ? `Logged audience drop-off ping at ${formatRetentionTimestamp(maxSec)} (Swiped away)`
        : `Sent 5-second playback telemetry ping at ${formatRetentionTimestamp(maxSec)}`
    );
    setTimeout(() => setPingLogMessage(null), 4000);
  };

  const handleTogglePlay = () => {
    if (currentTimeSec >= pitchDurationSec) {
      setCurrentTimeSec(0);
      setLastPingTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSwipeAway = () => {
    setIsPlaying(false);
    sendTelemetryPing(currentTimeSec, true);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-amber-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-amber-950">
            <Volume2 className="w-5 h-5 text-amber-700" />
            <span>Interactive "Club Pitch" Audio Sandbox Analytics — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            YouTube Studio-style granular retention analytics for 60-second audio pitches. Identifies exact audience drop-off timestamps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>Telemetry Active</span>
          </span>
        </div>
      </div>

      {/* Telemetry Ping Notification Banner */}
      {pingLogMessage && (
        <div className="p-3 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{pingLogMessage}</span>
        </div>
      )}

      {/* Overview Analytics Metrics Cards */}
      <div className="p-5 bg-slate-50 border-b-2 border-black grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Listens</span>
          <span className="text-2xl font-black text-black">{analytics.totalListens}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Unique user sessions</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Completion Rate</span>
          <span className="text-2xl font-black text-emerald-600">{analytics.completionRate}%</span>
          <span className="text-[11px] font-sans text-gray-600 block">Listened to end (&ge;54s)</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Avg Listen Time</span>
          <span className="text-2xl font-black text-sky-600">{analytics.avgTimeListenedSec}s</span>
          <span className="text-[11px] font-sans text-gray-600 block">Out of {pitchDurationSec}s total</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-amber-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-amber-900 uppercase block">Highest Audience Drop-Off</span>
          <span className="text-2xl font-black text-amber-600">{analytics.highestDropOffFormatted}</span>
          <span className="text-[11px] font-sans text-amber-900 block font-medium truncate">
            {analytics.highestDropOffSecond > 0 ? "Peak listener swipe-away point" : "Consistent retention"}
          </span>
        </div>
      </div>

      {/* Main Sandbox Grid: Interactive Retention Curve & Audio Telemetry Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Retention Curve Visualizer */}
        <div className="lg:col-span-2 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              60-Second Audio Retention Curve (%)
            </h4>
            <span className="text-[11px] font-sans text-gray-500">5-second interval pings</span>
          </div>

          {/* Retention Insight Banner */}
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs font-sans text-amber-950 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold font-mono text-[11px]">Retention Insight: </span>
              <span>{analytics.dropOffInsight}</span>
            </div>
          </div>

          {/* Visual Retention Bar/Curve Chart */}
          <div className="p-4 border-2 border-black rounded-lg bg-slate-900 space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-white">
            <div className="flex justify-between text-[11px] font-mono text-gray-400 border-b border-slate-700 pb-2">
              <span>Timeline</span>
              <span>Active Audience Retained (%)</span>
            </div>

            <div className="space-y-2">
              {analytics.retentionCurve.map((bucket) => {
                const isPeakDropOff = bucket.second === analytics.highestDropOffSecond;
                return (
                  <div key={bucket.second} className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-gray-300 w-12">{bucket.timeLabel}</span>
                      <div className="flex items-center gap-2">
                        {isPeakDropOff && (
                          <span className="text-[10px] font-bold bg-amber-400 text-black px-1.5 py-0.5 rounded border border-black">
                            ⚠️ Peak Drop-Off (-{bucket.dropOffRate}%)
                          </span>
                        )}
                        <span className="font-bold text-emerald-400 w-12 text-right">
                          {bucket.retentionPercentage}%
                        </span>
                      </div>
                    </div>

                    {/* Bar Indicator */}
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                      <div
                        className={cn(
                          "h-full transition-all duration-500 rounded-full",
                          isPeakDropOff ? "bg-amber-400" : "bg-emerald-500"
                        )}
                        style={{ width: `${bucket.retentionPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Audio Pitch Player & Live Telemetry Simulator */}
        <div className="lg:col-span-1 p-5 bg-slate-50 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-sky-600" />
              Pitch Telemetry Simulator
            </h4>
            <span className="text-[10px] font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-300">
              HTML5 Audio Ping
            </span>
          </div>

          <div className="p-4 border-2 border-black rounded-lg bg-white space-y-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Active Pitch:</span>
              <h5 className="font-bold text-xs text-black leading-snug">{pitchTitle}</h5>
            </div>

            {/* Playhead Progress Meter */}
            <div className="space-y-1 font-mono">
              <div className="flex justify-between text-xs font-bold text-gray-700">
                <span>{formatRetentionTimestamp(currentTimeSec)}</span>
                <span>{formatRetentionTimestamp(pitchDurationSec)}</span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden border border-black">
                <div
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${(currentTimeSec / pitchDurationSec) * 100}%` }}
                />
              </div>
            </div>

            {/* Simulated Player Controls */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="flex-1 py-2 px-3 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-1.5"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? "Pause Pitch" : "Play Pitch"}</span>
              </button>

              <button
                type="button"
                onClick={handleSwipeAway}
                className="py-2 px-3 border-2 border-black bg-amber-300 text-black hover:bg-amber-400 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                title="Simulate student swiping away"
              >
                Swipe Away
              </button>
            </div>
          </div>

          <div className="p-3 bg-sky-50 border border-sky-300 rounded-lg text-xs font-sans text-sky-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold font-mono text-[11px] text-sky-900">
              <Info className="w-4 h-4 text-sky-600" />
              High-Frequency Telemetry
            </div>
            <p className="text-[11px] leading-relaxed">
              Pings max time listened every 5 seconds. Automatically aggregates audience drop-off curves on the Club Dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
