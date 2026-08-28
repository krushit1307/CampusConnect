import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import Volume2 from "lucide-react/dist/esm/icons/volume-2";
import Info from "lucide-react/dist/esm/icons/info";
import Radio from "lucide-react/dist/esm/icons/radio";

interface EventNoiseMonitorProps {
  eventId: string;
}

function getNoiseVibe(db: number) {
  if (db < 40) {
    return {
      label: "Dead Silence",
      description: "Absolutely quiet. Perfect for deep concentration.",
      badgeColor: "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
      gaugeColor: "bg-zinc-400",
    };
  }
  if (db < 55) {
    return {
      label: "Pin Drop",
      description: "Extremely quiet. Whispers or typing only.",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
      gaugeColor: "bg-emerald-500",
    };
  }
  if (db < 70) {
    return {
      label: "Moderate Buzz",
      description: "A comfortable level of low-volume conversation.",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
      gaugeColor: "bg-blue-500",
    };
  }
  if (db < 85) {
    return {
      label: "Lively",
      description: "Active atmosphere with prominent background sound.",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
      gaugeColor: "bg-amber-500",
    };
  }
  return {
    label: "Loud",
    description: "Highly energetic and noisy environment.",
    badgeColor: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    gaugeColor: "bg-red-500",
  };
}

export function EventNoiseMonitor({ eventId }: EventNoiseMonitorProps) {
  const supabase = createClient();
  const [decibels, setDecibels] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`event-noise-${eventId}`)
      .on("broadcast", { event: "noise_level_update" }, (payload) => {
        if (payload?.payload?.decibels !== undefined) {
          setDecibels(payload.payload.decibels);
          setIsLive(true);
          setLastUpdateTime(new Date().toLocaleTimeString());
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[NoiseMonitor] Subscribed to realtime channel");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  const vibe = decibels !== null ? getNoiseVibe(decibels) : null;
  const percentage = decibels !== null ? Math.min(100, Math.max(0, ((decibels - 30) / 90) * 100)) : 0;

  return (
    <div className="neu-border bg-white p-5 text-black shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white dark:text-white space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-display font-black text-sm uppercase tracking-wider flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-purple-600" />
          Acoustic Vibe Monitor
        </h3>
        
        {isLive ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
            <Radio className="w-3.5 h-3.5" />
            Live Feed
          </span>
        ) : (
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
            Offline
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {decibels !== null && vibe ? (
          <motion.div
            key="gauge"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Current Vibe
                </span>
                <p className="font-display text-2xl font-black uppercase text-purple-900 dark:text-purple-300">
                  {vibe.label}
                </p>
              </div>

              <div className="text-right">
                <span className={`text-xs font-bold font-mono px-2.5 py-0.5 border-2 border-black ${vibe.badgeColor}`}>
                  {decibels} dB
                </span>
              </div>
            </div>

            {/* Progress Gauge */}
            <div className="relative h-4 bg-zinc-100 border-2 border-black overflow-hidden dark:bg-zinc-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`h-full ${vibe.gaugeColor} border-r-2 border-black`}
              />
            </div>

            <div className="flex items-start gap-2 bg-purple-50/50 p-2.5 border border-purple-200 text-xs font-mono dark:bg-purple-950/20 dark:border-purple-800/40">
              <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-zinc-600 dark:text-zinc-300">{vibe.description}</p>
                <p className="text-[9px] text-zinc-400">Last updated: {lastUpdateTime}</p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 bg-zinc-50 dark:bg-zinc-950 dark:border-zinc-800 p-4 text-center rounded-none"
          >
            <p className="font-mono text-xs text-zinc-400 font-bold uppercase tracking-wider">
              No Live Noise Feed Yet
            </p>
            <p className="text-[10px] text-zinc-400 mt-1 max-w-[240px]">
              Vibe readings will appear automatically once the organizer activates the Crowd Noise monitor.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
