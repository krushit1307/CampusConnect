import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

export function useWebRtcTelemetryMonitor(pc: RTCPeerConnection | null, eventId: string | null) {
  const [latency, setLatency] = useState<number>(0);
  const [packetLoss, setPacketLoss] = useState<number>(0);
  const [isPoorConnection, setIsPoorConnection] = useState<boolean>(false);
  const [isDropped, setIsDropped] = useState<boolean>(false);

  useEffect(() => {
    if (!pc) return;

    const interval = setInterval(async () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "closed" ||
        pc.connectionState === "disconnected"
      ) {
        setIsDropped(true);
        if (eventId) {
          // Trigger the Fallback Broadcaster (Issue #4298)
          await supabase.functions.invoke("broadcast-failover", {
            body: { eventId, reason: "Connection dropped entirely" },
          });
        }
        return;
      }

      setIsDropped(false);

      try {
        const stats = await pc.getStats();
        let currentLatency = 0;
        let currentPacketLoss = 0;

        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            currentLatency = report.currentRoundTripTime * 1000;
          }
          if (report.type === "remote-inbound-rtp" && report.kind === "video") {
            currentPacketLoss = report.fractionLost * 100;
          }
        });

        setLatency(currentLatency);
        setPacketLoss(currentPacketLoss);

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

  return { latency, packetLoss, isPoorConnection, isDropped };
}
