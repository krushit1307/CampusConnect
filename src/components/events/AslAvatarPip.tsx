import React, { useState, useEffect, useRef } from "react";
import { useAslAvatarStream } from "@/hooks/useAslAvatarStream";
import Radio from "lucide-react/dist/esm/icons/radio";
import VolumeX from "lucide-react/dist/esm/icons/volume-x";
import Minimize2 from "lucide-react/dist/esm/icons/minimize-2";
import Maximize2 from "lucide-react/dist/esm/icons/maximize-2";

interface AslAvatarPipProps {
  eventId: string;
}

export function AslAvatarPip({ eventId }: AslAvatarPipProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { isPlaying, currentText, status, getAslVideoTrack } = useAslAvatarStream({
    eventId,
    enabled: isEnabled,
  });

  // Assign track to local canvas/video when enabled
  useEffect(() => {
    if (!isEnabled || !videoRef.current) return;

    const interval = setInterval(() => {
      const track = getAslVideoTrack();
      if (track && videoRef.current && !videoRef.current.srcObject) {
        const stream = new MediaStream([track]);
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        clearInterval(interval);
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isEnabled, getAslVideoTrack]);

  return (
    <div className="fixed bottom-24 left-6 z-[100] font-mono">
      {/* Enable Toggle Button */}
      <button
        onClick={() => setIsEnabled((prev) => !prev)}
        data-testid="asl-pip-toggle-btn"
        className={`flex items-center gap-2 border-2 border-black px-4 py-2 text-xs font-bold uppercase shadow-[4px_4px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] transition-all ${
          isEnabled ? "bg-emerald-400 text-black" : "bg-brand-gray-base-800 text-cream"
        }`}
      >
        <Radio className={isEnabled ? "animate-pulse text-red-600" : ""} size={16} />
        {isEnabled ? "Disable ASL Avatar" : "Enable ASL Avatar (PIP)"}
      </button>

      {/* Dragable/Floating PIP overlay window */}
      {isEnabled && (
        <div
          data-testid="asl-avatar-pip-container"
          className={`mt-4 border-4 border-black bg-white shadow-[8px_8px_0_0_#000] transition-all ${
            isMinimized ? "w-64" : "w-80"
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b-4 border-black bg-yellow-300 p-2.5">
            <span className="text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
              Signapse AI Avatar
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized((prev) => !prev)}
                className="border-2 border-black p-0.5 hover:bg-yellow-400"
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
            </div>
          </div>

          {/* Video Container */}
          <div
            className={`relative bg-black flex items-center justify-center ${isMinimized ? "h-36" : "h-48"}`}
          >
            <video
              ref={videoRef}
              data-testid="asl-avatar-pip-video"
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            {status === "generating" && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 text-white">
                <span className="text-[10px] font-bold animate-pulse text-yellow-300">
                  Translating to ASL...
                </span>
              </div>
            )}
            {status === "idle" && !isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white/80 p-4 text-center">
                <VolumeX size={20} className="mb-1 text-slate-400" />
                <span className="text-[9px] font-bold">Waiting for speaker audio...</span>
              </div>
            )}
          </div>

          {/* Subtitle / Text sync area */}
          {!isMinimized && (
            <div className="border-t-4 border-black p-3 bg-slate-50 min-h-[60px] flex items-center">
              <p className="text-[10px] font-bold text-slate-800 leading-normal">
                {currentText || (
                  <span className="italic text-slate-400">Captions will appear here...</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
