import React, { useState } from "react";
import { Copy, Calendar, ArrowRight, CheckCircle2, Clock, FileText, Sparkles } from "lucide-react";
import {
  SeriesEventTemplate,
  generateShiftedSeriesPreview,
} from "@/lib/eventSeriesCloner";
import { cn } from "@/lib/utils";

export interface CloneEventSeriesDialogProps {
  seriesId?: string;
  seriesTitle?: string;
  events?: SeriesEventTemplate[];
  isOpen?: boolean;
  onClose?: () => void;
  onCloneSuccess?: (newSeriesId: string, count: number) => void;
  className?: string;
}

export const MOCK_SERIES_EVENTS: SeriesEventTemplate[] = [
  {
    id: "evt-101",
    series_id: "series-fall-2025",
    title: "Fall Workshop #1: Intro to AI & LLMs",
    event_date: "2025-09-01T18:00:00.000Z",
    capacity: 100,
  },
  {
    id: "evt-102",
    series_id: "series-fall-2025",
    title: "Fall Workshop #2: Prompt Engineering",
    event_date: "2025-09-08T18:00:00.000Z", // 7 days later
    capacity: 100,
  },
  {
    id: "evt-103",
    series_id: "series-fall-2025",
    title: "Fall Workshop #3: RAG & Vector DBs",
    event_date: "2025-09-15T18:00:00.000Z", // 7 days later
    capacity: 100,
  },
  {
    id: "evt-104",
    series_id: "series-fall-2025",
    title: "Fall Workshop #4: Agentic Frameworks",
    event_date: "2025-09-22T18:00:00.000Z", // 7 days later
    capacity: 100,
  },
];

export const CloneEventSeriesDialog: React.FC<CloneEventSeriesDialogProps> = ({
  seriesId = "series-fall-2025",
  seriesTitle = "Fall Workshop Series",
  events = MOCK_SERIES_EVENTS,
  isOpen = true,
  onClose,
  onCloneSuccess,
  className,
}) => {
  const [newStartDate, setNewStartDate] = useState<string>("2026-01-15T18:00");
  const [isCloning, setIsCloning] = useState<boolean>(false);
  const [cloneComplete, setCloneComplete] = useState<boolean>(false);

  const isoStartDate = newStartDate ? new Date(newStartDate).toISOString() : new Date().toISOString();
  const shiftedPreviews = generateShiftedSeriesPreview(events, isoStartDate);

  const handleCloneExecute = async () => {
    setIsCloning(true);
    // Simulate Supabase RPC clone_event_series_shifted execution
    await new Promise((res) => setTimeout(res, 600));

    const newSeriesId = `series-spring-${Date.now()}`;
    setIsCloning(false);
    setCloneComplete(true);

    if (onCloneSuccess) {
      onCloneSuccess(newSeriesId, events.length);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={cn(
          "bg-white border-2 border-black rounded-xl max-w-3xl w-full p-6 space-y-5 font-mono shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-[90vh] overflow-auto",
          className
        )}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base uppercase text-black">
              Clone & Shift Event Series — {seriesTitle}
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 border border-black bg-gray-100 hover:bg-gray-200 rounded font-bold text-xs"
            >
              Close
            </button>
          )}
        </div>

        {/* Start Date Selector Form (#3538) */}
        <div className="p-4 bg-purple-50 border-2 border-black rounded-lg space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <label htmlFor="target-start-date" className="text-xs font-bold uppercase block text-purple-950">
                Target Spring/New Start Date & Time *
              </label>
              <p className="text-xs font-sans text-gray-700">
                Mathematical shift automatically calculates delta and preserves exact weekly intervals.
              </p>
            </div>

            <input
              id="target-start-date"
              type="datetime-local"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="px-3 py-2 border-2 border-black bg-white font-sans text-xs font-bold rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>
        </div>

        {/* Live Preview Table (#3538) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-purple-600" />
              Shifted Series Live Preview ({events.length} Events)
            </h4>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-400 px-2.5 py-0.5 rounded-full">
              Status: Draft Review
            </span>
          </div>

          <div className="border-2 border-black rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-black font-bold uppercase text-gray-800">
                  <th className="p-2.5 border-r border-black">#</th>
                  <th className="p-2.5 border-r border-black">Original Title</th>
                  <th className="p-2.5 border-r border-black">Original Date</th>
                  <th className="p-2.5 border-r border-black">Shifted Date</th>
                  <th className="p-2.5">Interval</th>
                </tr>
              </thead>
              <tbody className="divide-y border-black font-sans">
                {shiftedPreviews.map((item, idx) => (
                  <tr key={item.originalEventId} className="hover:bg-purple-50/50">
                    <td className="p-2.5 font-bold font-mono border-r border-black">{idx + 1}</td>
                    <td className="p-2.5 font-bold text-black border-r border-black">{item.title}</td>
                    <td className="p-2.5 text-gray-600 border-r border-black">
                      {new Date(item.originalDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-2.5 font-bold text-purple-900 border-r border-black bg-purple-50/60">
                      {new Date(item.shiftedDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-2.5 font-mono text-[11px] font-bold text-gray-700">
                      {idx === 0 ? "Series Start" : `+${item.intervalDaysFromPrevious} days`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t-2 border-black/10">
          <span className="text-xs font-sans text-gray-600 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-purple-600" />
            Cloned events remain safely in <strong>Draft</strong> for review.
          </span>

          {cloneComplete ? (
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs bg-emerald-100 border border-emerald-400 px-3 py-1.5 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
              Series Cloned to Draft Successfully!
            </div>
          ) : (
            <button
              type="button"
              disabled={isCloning || events.length === 0}
              onClick={handleCloneExecute}
              className="px-5 py-2.5 border-2 border-black bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs uppercase rounded-md shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              <Sparkles className="w-4 h-4" />
              {isCloning ? "Cloning Series..." : `Clone Series (${events.length} Events)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
