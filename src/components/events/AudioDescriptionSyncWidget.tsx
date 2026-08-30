import React, { useState } from "react";
import { useAudioDescriptionSync } from "@/hooks/useAudioDescriptionSync";
import Headphones from "lucide-react/dist/esm/icons/headphones";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";

interface AudioDescriptionSyncWidgetProps {
  eventId: string;
  audioDescriptionUrl: string | null;
  videoElement: HTMLVideoElement | null;
}

export function AudioDescriptionSyncWidget({
  eventId,
  audioDescriptionUrl,
  videoElement,
}: AudioDescriptionSyncWidgetProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  const { isSynced, ntpOffset } = useAudioDescriptionSync({
    eventId,
    enabled: isEnabled,
    videoElement,
    audioDescriptionUrl,
  });

  if (!audioDescriptionUrl) return null;

  return (
    <div
      data-testid="audio-description-widget"
      className="my-6 border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono text-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-300 border-2 border-black rounded-lg shrink-0">
            <Headphones size={20} className="text-black" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wide">Descriptive Audio Track</h4>
            <p className="text-[10px] text-gray-600 mt-1">
              For visually impaired attendees, listen to real-time synchronized descriptions of
              action scenes.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEnabled((prev) => !prev)}
          data-testid="audio-description-toggle-btn"
          className={`px-4 py-2 border-2 border-black font-bold uppercase transition-all shadow-[4px_4px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_0_#000] ${
            isEnabled ? "bg-emerald-400 text-black" : "bg-brand-gray-base-800 text-cream"
          }`}
        >
          {isEnabled ? "Disable Descriptions" : "Enable Descriptions"}
        </button>
      </div>

      {isEnabled && (
        <div className="mt-4 pt-4 border-t-2 border-dashed border-black flex flex-wrap items-center gap-4 text-[10px] text-gray-700">
          <span className="flex items-center gap-1.5">
            <CheckCircle size={14} className={isSynced ? "text-emerald-600" : "text-gray-400"} />
            NTP Clock Offset: <strong className="text-black">{ntpOffset.toFixed(1)} ms</strong>
          </span>
          <span className="flex items-center gap-1">
            Status:{" "}
            <strong
              data-testid="sync-status-indicator"
              className={isSynced ? "text-emerald-600 font-bold" : "text-yellow-600 font-bold"}
            >
              {isSynced ? "NTP Synchronized ✓" : "Syncing Drift..."}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}
