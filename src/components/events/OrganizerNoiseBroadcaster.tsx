import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Volume2 from "lucide-react/dist/esm/icons/volume-2";
import Mic from "lucide-react/dist/esm/icons/mic";
import MicOff from "lucide-react/dist/esm/icons/mic-off";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";

interface OrganizerNoiseBroadcasterProps {
  eventId: string;
}

export function OrganizerNoiseBroadcaster({ eventId }: OrganizerNoiseBroadcasterProps) {
  const supabase = createClient();
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isSampling, setIsSampling] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [lastDecibel, setLastDecibel] = useState<number | null>(null);
  const [lastBroadcastTime, setLastBroadcastTime] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Initialize Realtime Channel
  useEffect(() => {
    const channel = supabase.channel(`event-noise-${eventId}`);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelRef.current = channel;
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Request permissions and start monitoring
  const startMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the test stream tracks immediately
      stream.getTracks().forEach((track) => track.stop());
      setPermissionGranted(true);
      setIsMonitoring(true);
      toast.success("Microphone permission granted. Starting ambient noise monitor.");

      // Run immediately first
      void sampleAndBroadcast();

      // Schedule every 60 seconds
      intervalRef.current = setInterval(() => {
        void sampleAndBroadcast();
      }, 60000);
    } catch (err) {
      console.error("Mic permission denied:", err);
      setPermissionGranted(false);
      toast.error("Microphone permission denied. Cannot start noise monitor.");
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    setIsSampling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    toast.info("Ambient noise monitor stopped.");
  };

  // Perform 4-second sound sample using Web Audio API
  const sampleAndBroadcast = async () => {
    if (isSampling) return;
    setIsSampling(true);

    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    let interval: NodeJS.Timeout | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error("Web Audio API not supported in this browser.");
      }
      audioContext = new AudioCtx();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 512;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const samples: number[] = [];

      // Sample every 200ms for 4 seconds
      interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Map average amplitude to approximate dB level (30 dB - 120 dB)
        const approxDb = Math.min(120, Math.max(30, Math.round(30 + (avg / 255) * 65)));
        samples.push(approxDb);
      }, 200);

      // Finish sampling after 4 seconds
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (interval) clearInterval(interval);
          resolve();
        }, 4000);
      });

      // Stop mic tracks and close context for privacy-first resource efficiency
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();

      const finalAvgDb = Math.round(
        samples.reduce((a, b) => a + b, 0) / (samples.length || 1)
      );

      setLastDecibel(finalAvgDb);
      const nowStr = new Date().toLocaleTimeString();
      setLastBroadcastTime(nowStr);
      setIsSampling(false);

      // Broadcast update over Supabase Realtime channel
      if (channelRef.current) {
        await channelRef.current.send({
          type: "broadcast",
          event: "noise_level_update",
          payload: { decibels: finalAvgDb },
        });
      }
    } catch (err) {
      console.error("Sampling error:", err);
      setIsSampling(false);
      if (interval) clearInterval(interval);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (audioContext) void audioContext.close();
      toast.error("Failed to sample ambient noise level.");
    }
  };

  return (
    <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white text-black dark:text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-black uppercase flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-600" />
            Live Crowd Noise Monitor (Study Sessions)
          </h2>
          <p className="font-mono text-xs text-zinc-500/80 mt-1 dark:text-zinc-400">
            Broadcasting ambient room volume to public view. Web Audio API samples sound locally; actual audio is never stored or transmitted.
          </p>
        </div>

        <div>
          {isMonitoring ? (
            <button
              onClick={stopMonitoring}
              className="neu-border neu-press bg-red-400 text-black px-4 py-2 font-mono text-xs font-bold uppercase flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
            >
              <MicOff className="w-4 h-4" />
              Stop Monitor
            </button>
          ) : (
            <button
              onClick={startMonitoring}
              className="neu-border neu-press bg-purple-400 text-black px-4 py-2 font-mono text-xs font-bold uppercase flex items-center gap-2 hover:-translate-y-0.5 transition-transform"
            >
              <Mic className="w-4 h-4" />
              Start Monitor
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t-2 border-dashed border-zinc-200 pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="font-bold">STATUS:</span>
          {isMonitoring ? (
            isSampling ? (
              <span className="text-amber-500 animate-pulse flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                Sampling ambient room level (4s)...
              </span>
            ) : (
              <span className="text-green-500 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
                Active (Next check in 60s)
              </span>
            )
          ) : (
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-zinc-400 rounded-full"></span>
              Idle
            </span>
          )}
        </div>

        {lastDecibel !== null && (
          <div className="flex items-center gap-4">
            <div className="border border-black bg-zinc-50 px-3 py-1 font-mono text-xs dark:bg-zinc-800 dark:border-white">
              LAST RECORDED: <span className="font-bold text-purple-600 dark:text-purple-400">{lastDecibel} dB</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Broadcasted at {lastBroadcastTime}
            </div>
          </div>
        )}

        {permissionGranted === false && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-red-500">
            <AlertCircle className="w-4 h-4" />
            Mic access denied by browser
          </div>
        )}

        {permissionGranted === true && isMonitoring && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-green-500">
            <CheckCircle2 className="w-4 h-4" />
            Local edge processing active
          </div>
        )}
      </div>
    </div>
  );
}
