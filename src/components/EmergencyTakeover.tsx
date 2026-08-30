import React, { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface EmergencyTakeoverProps {
  isInDanger: boolean;
}

export const EmergencyTakeover: React.FC<EmergencyTakeoverProps> = ({ isInDanger }) => {
  useEffect(() => {
    if (isInDanger) {
      // Create a high-pitched looping beep using the browser's built-in Web Audio API
      // This bypasses the need for an MP3 file!
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // High pitch

      // Make it beep on and off
      setInterval(() => {
        gainNode.gain.value = gainNode.gain.value === 0 ? 1 : 0;
      }, 500);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();

      return () => {
        oscillator.stop();
        audioCtx.close();
      };
    }
  }, [isInDanger]);

  // If the student is safe, don't render anything
  if (!isInDanger) return null;

  // If in danger, render the full-screen takeover
  return (
    <div className="fixed inset-0 z-[9999] bg-red-700 flex flex-col items-center justify-center p-6 text-white animate-pulse">
      <AlertTriangle className="w-32 h-32 mb-8" />
      <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4 text-center leading-tight">
        Turn Around <br /> Immediately
      </h1>
      <p className="text-2xl md:text-4xl font-bold text-center max-w-4xl bg-black/30 p-6 rounded-xl mt-4">
        ACTIVE THREAT AHEAD. YOU HAVE ENTERED A RESTRICTED DANGER ZONE.
      </p>
    </div>
  );
};
