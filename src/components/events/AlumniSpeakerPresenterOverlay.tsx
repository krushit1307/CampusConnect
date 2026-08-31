// =============================================================================
// Component: AlumniSpeakerPresenterOverlay
// Issue: #5128 - Dynamic "Alumni Speaker" Live Audience Sentiment Overlay
// Description: Private teleprompter/presenter overlay displaying live crowd aggregate engagement.
// Turns RED with subtle glowing border when aggregate drops below 30%, signaling speaker to pivot.
// Strictly exposes only aggregate statistics for privacy.
// =============================================================================

import React, { useState, useEffect } from "react";
import { AlertTriangle, Radio, Users, Activity, Sparkles, RefreshCw } from "lucide-react";
import { getSocketClient } from "@/lib/socket";
import { globalSentimentAggregator } from "@/services/alumniSpeakerSentimentAggregator";
import { PresenterSentimentAggregatePayload } from "../../../contracts/websocket-schemas";

export interface AlumniSpeakerPresenterOverlayProps {
  eventId: string;
  speakerName?: string;
  className?: string;
}

export const AlumniSpeakerPresenterOverlay: React.FC<AlumniSpeakerPresenterOverlayProps> = ({
  eventId,
  speakerName = "Presenter Teleprompter",
  className = "",
}) => {
  const [aggregate, setAggregate] = useState<PresenterSentimentAggregatePayload>({
    eventId,
    engagement: 50,
    status: "healthy",
    activeCount: 0,
    timestamp: new Date().toISOString(),
  });

  const [secondsUntilNextTick, setSecondsUntilNextTick] = useState<number>(5);

  // Poll local aggregator & listen for WebSocket broadcast
  useEffect(() => {
    // 1. Initial catchup fetch
    const initial = globalSentimentAggregator.getLatestAggregate(eventId);
    if (initial) {
      setAggregate(initial);
    }

    // 2. Subscribe to global aggregator broadcast updates
    const unsubscribeLocal = globalSentimentAggregator.onBroadcast((payload) => {
      if (payload.eventId === eventId) {
        setAggregate(payload);
        setSecondsUntilNextTick(5);
      }
    });

    // 3. Socket.IO realtime listener fallback
    let unsubscribeSocket: (() => void) | undefined;
    try {
      const socket = getSocketClient();
      if (socket) {
        unsubscribeSocket = socket.on("presenter_sentiment_aggregate", (payload) => {
          if (payload.eventId === eventId) {
            setAggregate(payload);
            setSecondsUntilNextTick(5);
          }
        });
      }
    } catch (err) {
      // Graceful fallback
    }

    // 5-second countdown timer for UI visualization
    const countdownInterval = setInterval(() => {
      setSecondsUntilNextTick((prev) => (prev > 1 ? prev - 1 : 5));
    }, 1000);

    return () => {
      unsubscribeLocal();
      if (unsubscribeSocket) unsubscribeSocket();
      clearInterval(countdownInterval);
    };
  }, [eventId]);

  const isLowEngagement = aggregate.engagement < 30;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      data-testid="presenter-overlay-container"
      data-status={aggregate.status}
      className={`relative overflow-hidden rounded-3xl transition-all duration-500 p-6 ${
        isLowEngagement
          ? "bg-slate-950 border-2 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)] text-rose-100"
          : "bg-slate-900 border border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)] text-slate-100"
      } ${className}`}
    >
      {/* Background glow element */}
      <div
        className={`absolute top-0 right-0 -mt-10 -mr-10 w-60 h-60 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          isLowEngagement ? "bg-rose-500/20" : "bg-indigo-500/10"
        }`}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <Activity
            className={`w-5 h-5 ${isLowEngagement ? "text-rose-400 animate-bounce" : "text-indigo-400"}`}
          />
          <div>
            <h2 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
              {speakerName} — Live Crowd Overlay
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">Private Teleprompter Stream</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active Attendees Counter */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs font-mono">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-bold text-white">{aggregate.activeCount}</span>
            <span className="text-slate-400 hidden sm:inline">Audience</span>
          </div>

          {/* 5-Second Interval Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border ${
              isLowEngagement
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
            }`}
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>5s Tick ({secondsUntilNextTick}s)</span>
          </div>
        </div>
      </div>

      {/* Main Meter Metric Display */}
      <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Aggregate Crowd Engagement
          </div>

          <div className="flex items-baseline gap-3">
            <span
              data-testid="aggregate-score-display"
              className={`text-5xl sm:text-6xl font-black tracking-tight font-mono ${
                isLowEngagement ? "text-rose-400" : "text-white"
              }`}
            >
              {aggregate.engagement}%
            </span>

            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                isLowEngagement
                  ? "bg-rose-500 text-slate-950 font-black shadow-lg shadow-rose-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {isLowEngagement ? "CRITICAL: LOW ENGAGEMENT" : "HEALTHY ENGAGEMENT"}
            </span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="flex-1 max-w-xs space-y-1.5">
          <div className="flex justify-between text-xs font-mono text-slate-400">
            <span>0% (Bored)</span>
            <span className="font-bold text-slate-200">Threshold: 30%</span>
            <span>100% (Blown)</span>
          </div>

          <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden relative">
            {/* 30% Threshold Indicator Line */}
            <div className="absolute left-[30%] top-0 bottom-0 w-0.5 bg-rose-400 z-20 opacity-80" />

            <div
              className={`h-full transition-all duration-700 rounded-full ${
                isLowEngagement ? "bg-rose-500" : "bg-gradient-to-r from-indigo-500 to-emerald-400"
              }`}
              style={{ width: `${aggregate.engagement}%` }}
            />
          </div>
        </div>
      </div>

      {/* Critical Low Engagement Warning Alert Banner (Requirement #5) */}
      {isLowEngagement ? (
        <div
          data-testid="low-engagement-alert"
          className="rounded-2xl bg-rose-950/80 border border-rose-500/60 p-4 text-rose-100 flex items-start gap-3 shadow-lg relative z-10 animate-pulse"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs sm:text-sm text-white uppercase tracking-wider">
              Presenter Alert — Crowd Engagement Under 30%!
            </h4>
            <p className="text-xs text-rose-200 leading-relaxed">
              Audience engagement has dropped to <strong>{aggregate.engagement}%</strong>. Consider
              changing your topic, asking an interactive question, or opening the floor to Q&A!
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-950/60 border border-slate-800 p-3.5 text-xs text-slate-300 flex items-center gap-2 relative z-10">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            Audience feedback is healthy ({aggregate.engagement}%). Keep up the great pace!
          </span>
        </div>
      )}
    </div>
  );
};

export default AlumniSpeakerPresenterOverlay;
