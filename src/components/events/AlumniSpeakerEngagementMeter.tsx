// =============================================================================
// Component: AlumniSpeakerEngagementMeter
// Issue: #5128 - Dynamic "Alumni Speaker" Live Audience Sentiment Overlay
// Description: Attendee-facing interactive engagement slider (Bored <---> Mind Blown).
// Streams real-time sentiment updates via WebSockets/Socket.IO with debouncing.
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Smile, Frown, Sparkles, Radio } from "lucide-react";
import { getSocketClient } from "@/lib/socket";
import { globalSentimentAggregator } from "@/services/alumniSpeakerSentimentAggregator";

export interface AlumniSpeakerEngagementMeterProps {
  eventId: string;
  attendeeId: string;
  className?: string;
  onSentimentChange?: (sentiment: number) => void;
}

export const AlumniSpeakerEngagementMeter: React.FC<AlumniSpeakerEngagementMeterProps> = ({
  eventId,
  attendeeId,
  className = "",
  onSentimentChange,
}) => {
  const [sentiment, setSentiment] = useState<number>(50);
  const [lastEmitted, setLastEmitted] = useState<number | null>(null);
  const [isLive, setIsLive] = useState<boolean>(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to map numeric sentiment to human-readable label
  const getSentimentDescriptor = (val: number): { label: string; color: string } => {
    if (val < 20) return { label: "Bored", color: "text-rose-400" };
    if (val < 40) return { label: "Disengaged", color: "text-amber-400" };
    if (val < 60) return { label: "Interested", color: "text-slate-300" };
    if (val < 80) return { label: "Engaged", color: "text-indigo-300" };
    return { label: "Mind Blown! 🚀", color: "text-emerald-400 font-extrabold" };
  };

  const currentDescriptor = getSentimentDescriptor(sentiment);

  // Emit sentiment to backend aggregator / Socket.IO
  const sendSentimentUpdate = useCallback(
    (newVal: number) => {
      // 1. Record directly in local aggregator for instant response
      globalSentimentAggregator.recordSentiment(eventId, attendeeId, newVal);

      // 2. Emit via WebSocket / Socket.IO client wrapper if connected
      try {
        const socket = getSocketClient();
        if (socket && socket.isConnected) {
          socket.emit("attendee_sentiment_submit", {
            eventId,
            attendeeId,
            sentiment: newVal,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        // Fallback gracefully if WebSocket is unavailable
      }

      setLastEmitted(newVal);
      if (onSentimentChange) {
        onSentimentChange(newVal);
      }
    },
    [eventId, attendeeId, onSentimentChange],
  );

  // Handle slider input changes with 150ms debouncing to prevent network spam
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSentiment(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      sendSentimentUpdate(val);
    }, 150);
  };

  // Ensure initial baseline is registered
  useEffect(() => {
    sendSentimentUpdate(50);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [sendSentimentUpdate]);

  return (
    <div
      className={`rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl text-slate-100 space-y-4 ${className}`}
      data-testid="engagement-meter-container"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-sm sm:text-base text-white">Live Engagement Meter</h3>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>REALTIME STREAM</span>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Slide to share your live feedback with the speaker. Your individual rating stays private and
        anonymous.
      </p>

      {/* Sentiment Value Display */}
      <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
        <span className="text-xs text-slate-400">Current Feeling:</span>
        <span className={`text-sm ${currentDescriptor.color}`}>
          {currentDescriptor.label} ({sentiment}%)
        </span>
      </div>

      {/* Slider Visual Track & Control */}
      <div className="space-y-2 pt-1">
        <div className="relative">
          <input
            id={`engagement-slider-${eventId}`}
            type="range"
            min="0"
            max="100"
            step="1"
            value={sentiment}
            onChange={handleSliderChange}
            aria-label="Engagement Meter Slider: Bored to Mind Blown"
            aria-valuenow={sentiment}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        {/* Labels below slider */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400 pt-1">
          <div className="flex items-center gap-1.5 text-rose-400">
            <Frown className="w-4 h-4" />
            <span>Bored</span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-400">
            <span>Mind Blown</span>
            <Smile className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlumniSpeakerEngagementMeter;
