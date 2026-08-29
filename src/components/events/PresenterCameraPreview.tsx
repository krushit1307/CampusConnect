import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

interface PresenterCameraPreviewProps {
  stream: MediaStream | null;
  pc: RTCPeerConnection | null;
  eventId: string;
}

export function PresenterCameraPreview({ stream, pc, eventId }: PresenterCameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [latency, setLatency] = useState<number>(0);
  const [packetLoss, setPacketLoss] = useState<number>(0);
  const [isPoorConnection, setIsPoorConnection] = useState<boolean>(false);

  // Attach local stream to video
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Telemetry Monitor
  useEffect(() => {
    if (!pc) return;

    const interval = setInterval(async () => {
      // If connection drops entirely, trigger Fallback Broadcaster
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.connectionState === "disconnected"
      ) {
        await supabase.functions.invoke("broadcast-failover", {
          body: { eventId, reason: "Connection dropped entirely" },
        });
        return;
      }

      try {
        const stats = await pc.getStats();
        let currentLatency = 0;
        let currentPacketLoss = 0;

        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            // currentRoundTripTime is in seconds, convert to ms
            currentLatency = (report.currentRoundTripTime || 0) * 1000;
          }
          if (report.type === "remote-inbound-rtp" && report.kind === "video") {
            // fractionLost is between 0.0 and 1.0
            currentPacketLoss = (report.fractionLost || 0) * 100;
          }
        });

        setLatency(currentLatency);
        setPacketLoss(currentPacketLoss);

        // Render flashing red warning if poor connection
        if (currentLatency > 300 || currentPacketLoss > 5) {
          setIsPoorConnection(true);
        } else {
          setIsPoorConnection(false);
        }
      } catch (err) {
        console.error("Failed to get WebRTC stats", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pc, eventId]);

  return (
    <div className="relative w-full aspect-video bg-black overflow-hidden rounded-md border-2 border-gray-800">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

      {isPoorConnection && (
        <div className="absolute inset-0 flex items-center justify-center p-6 bg-red-900/50 pointer-events-none z-50">
          <div className="bg-brand-red-ios animate-pulse text-white font-bold font-mono px-6 py-4 rounded-xl border-4 border-white shadow-[0_0_40px_rgba(255,0,0,0.8)] text-center max-w-md">
            <p className="text-2xl mb-2 font-display uppercase tracking-wider">
              ⚠ Poor Connection!
            </p>
            <p className="text-base leading-tight">
              Your video is buffering for viewers. Move closer to your router.
            </p>
            <p className="text-xs mt-3 opacity-90 tracking-widest uppercase">
              Latency: {Math.round(latency)}ms | Loss: {packetLoss.toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
