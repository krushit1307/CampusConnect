import React, { useState } from "react";
import { Video, FileText, Sparkles, CheckCircle2, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  getUserSeriesCatchup,
  trackCatchupClick,
  type EventSeriesCatchup,
} from "@/services/eventSeriesCatchupService";

export interface EventSeriesCatchUpCardProps {
  eventId: string;
  eventTitle: string;
  recordingUrl?: string | null;
  materialsUrl?: string | null;
  seriesId?: string | null;
}

export const EventSeriesCatchUpCard: React.FC<EventSeriesCatchUpCardProps> = ({
  eventId,
  eventTitle,
  recordingUrl,
  materialsUrl,
  seriesId,
}) => {
  const [vodClicked, setVodClicked] = useState(false);
  const [materialsClicked, setMaterialsClicked] = useState(false);

  const { data: catchup } = useQuery<EventSeriesCatchup | null>({
    queryKey: ["event_series_catchup", eventId],
    queryFn: () => getUserSeriesCatchup(eventId),
    enabled: !!eventId,
  });

  const effectiveRecordingUrl = recordingUrl || catchup?.recording_url;
  const effectiveMaterialsUrl = materialsUrl || catchup?.materials_url;

  if (!seriesId && !catchup) {
    return null;
  }

  if (!effectiveRecordingUrl && !effectiveMaterialsUrl) {
    return null;
  }

  const handleVodClick = async () => {
    setVodClicked(true);
    const targetId = catchup?.id || eventId;
    await trackCatchupClick(targetId, "vod");
  };

  const handleMaterialsClick = async () => {
    setMaterialsClicked(true);
    const targetId = catchup?.id || eventId;
    await trackCatchupClick(targetId, "materials");
  };

  return (
    <div className="border-2 border-black bg-purple-50 p-5 shadow-[4px_4px_0_0_#000] mt-6">
      <div className="flex items-center gap-2 border-b-2 border-black pb-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-purple-300">
          <Sparkles className="h-4 w-4 text-purple-950" />
        </div>
        <div>
          <h3 className="font-display text-lg font-black uppercase text-purple-950">
            Event Series Catch-Up Hub
          </h3>
          <p className="font-mono text-xs text-purple-900/80">
            Missed this session? Catch up with the VOD recording and slide deck before the next event!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {effectiveRecordingUrl && (
          <a
            href={effectiveRecordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleVodClick}
            className="flex items-center justify-between border-2 border-black bg-white p-4 shadow-[2px_2px_0_0_#000] transition-all hover:bg-purple-100 hover:shadow-[3px_3px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-red-100 text-red-600">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-xs font-black uppercase text-black">Watch Session VOD</p>
                <p className="font-mono text-[10px] text-black/60">
                  {vodClicked || catchup?.vod_clicked ? "✓ Recording accessed" : "Full session replay"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-black" />
          </a>
        )}

        {effectiveMaterialsUrl && (
          <a
            href={effectiveMaterialsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleMaterialsClick}
            className="flex items-center justify-between border-2 border-black bg-white p-4 shadow-[2px_2px_0_0_#000] transition-all hover:bg-purple-100 hover:shadow-[3px_3px_0_0_#000] active:translate-x-0.5 active:translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-blue-100 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-xs font-black uppercase text-black">Slide Deck & Materials</p>
                <p className="font-mono text-[10px] text-black/60">
                  {materialsClicked || catchup?.materials_clicked
                    ? "✓ Slides downloaded"
                    : "Notes, code & resources"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-black" />
          </a>
        )}
      </div>
    </div>
  );
};
