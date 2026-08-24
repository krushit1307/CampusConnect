import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarEvent } from "@/types/events";

interface ScheduleVisualizerProps {
  events: any[]; // replace with actual event type
  onCancelRsvp: (eventId: string) => void;
}

export const ScheduleVisualizer: React.FC<ScheduleVisualizerProps> = ({ events, onCancelRsvp }) => {
  // Group events by day to render day views, or just render today's events if it's a daily view.
  // For simplicity, let's group by YYYY-MM-DD.
  const groupedEvents = useMemo(() => {
    const groups: Record<string, any[]> = {};
    events.forEach((e) => {
      // we need start_time and end_time. If they don't exist, we skip or mock.
      const date = e.event_date ? e.event_date.split("T")[0] : "Unknown";
      if (!groups[date]) groups[date] = [];
      groups[date].push(e);
    });
    return groups;
  }, [events]);

  return (
    <div className="space-y-8">
      {Object.entries(groupedEvents).map(([date, dayEvents]) => (
        <DaySchedule key={date} date={date} events={dayEvents} onCancelRsvp={onCancelRsvp} />
      ))}
    </div>
  );
};

const DaySchedule: React.FC<{
  date: string;
  events: any[];
  onCancelRsvp: (id: string) => void;
}> = ({ date, events, onCancelRsvp }) => {
  // 1 hour = 60px height. 24 hours = 1440px

  // Calculate overlaps for width and positioning
  const processedEvents = useMemo(() => {
    // Basic overlap detection
    // e needs start_time and end_time.
    return events.map((e) => {
      const start = new Date(e.event_date || Date.now());
      const end = e.end_time ? new Date(e.end_time) : new Date(start.getTime() + 60 * 60 * 1000); // default 1hr

      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();

      const top = startMinutes; // 1px per minute
      const height = Math.max(endMinutes - startMinutes, 30); // min 30px

      return { ...e, top, height, start, end, isConflict: false, width: "100%", left: "0%" };
    });
  }, [events]);

  // Mark conflicts and adjust width
  useMemo(() => {
    for (let i = 0; i < processedEvents.length; i++) {
      for (let j = i + 1; j < processedEvents.length; j++) {
        const e1 = processedEvents[i];
        const e2 = processedEvents[j];

        // Check Y-axis overlap
        if (!(e1.top + e1.height <= e2.top || e2.top + e2.height <= e1.top)) {
          e1.isConflict = true;
          e2.isConflict = true;
          e1.width = "50%";
          e1.left = "0%";
          e2.width = "50%";
          e2.left = "50%";
        }
      }
    }
  }, [processedEvents]);

  if (processedEvents.length === 0) return null;

  return (
    <div className="border-2 border-black rounded-lg bg-cream overflow-hidden">
      <div className="bg-black text-white p-2 font-mono font-bold">{date}</div>
      <div className="relative h-[1440px] bg-white bg-[linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:100%_60px]">
        {/* Time markers */}
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="absolute left-0 w-16 text-xs text-gray-500 font-mono text-right pr-2"
            style={{ top: i * 60 - 8 }}
          >
            {i}:00
          </div>
        ))}

        {/* Event blocks */}
        <div className="absolute left-16 right-0 top-0 bottom-0 border-l border-gray-300">
          {processedEvents.map((e) => (
            <div
              key={e.id}
              className={`absolute p-2 border-2 border-black overflow-hidden shadow-sm transition-all ${e.isConflict ? "bg-red-100" : "bg-lime"}`}
              style={{ top: e.top, height: e.height, width: e.width, left: e.left }}
            >
              <div className="flex justify-between items-start h-full">
                <div>
                  {e.isConflict && (
                    <span className="bg-red-600 text-white text-[10px] font-bold px-1 py-0.5 uppercase mb-1 inline-block">
                      Conflict!
                    </span>
                  )}
                  <p className="font-bold text-xs truncate leading-tight">{e.title}</p>
                  <p className="text-[10px] text-gray-700 truncate">
                    {e.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {e.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {e.isConflict && (
                  <button
                    onClick={() => onCancelRsvp(e.id)}
                    className="bg-black text-white text-[10px] px-2 py-1 hover:bg-gray-800 uppercase font-bold"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
