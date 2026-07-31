import { useMemo } from "react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

const DAY_START_HOUR = 8; // 8 AM
const DAY_END_HOUR = 22; // 10 PM
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const LANE_HEIGHT_PX = 64;

export interface TimelineEvent {
  id: string;
  title: string;
  location: string | null;
  start: Date;
  end: Date;
}

interface LaneEvent extends TimelineEvent {
  lane: number;
}

// Clamp a time into the 8am-10pm window so events don't render off-axis.
function minutesFromDayStart(date: Date) {
  const hour = Math.min(Math.max(date.getHours(), DAY_START_HOUR), DAY_END_HOUR);
  const minutesSinceStart = (hour - DAY_START_HOUR) * 60 + date.getMinutes();
  return Math.min(Math.max(minutesSinceStart, 0), TOTAL_MINUTES);
}

// Assign each event to the first free "lane" so overlapping events stack
// instead of covering each other.
function assignLanes(events: TimelineEvent[]): LaneEvent[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const laneEndTimes: number[] = [];

  return sorted.map((event) => {
    let lane = laneEndTimes.findIndex((endTime) => endTime <= event.start.getTime());
    if (lane === -1) {
      lane = laneEndTimes.length;
    }
    laneEndTimes[lane] = event.end.getTime();
    return { ...event, lane };
  });
}

export function CampusTimeline({ events }: { events: TimelineEvent[] }) {
  const isMobile = useIsMobile();
  const laneEvents = useMemo(() => assignLanes(events), [events]);
  const laneCount = Math.max(...laneEvents.map((e) => e.lane + 1), 1);

  if (events.length === 0) {
    return (
      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
        No events scheduled this week.
      </p>
    );
  }

  if (isMobile) {
    return (
      <ol className="space-y-2">
        {[...events]
          .sort((a, b) => a.start.getTime() - b.start.getTime())
          .map((event) => (
            <li key={event.id} className="neu-border bg-white p-3 dark:bg-[#1a1a1a]">
              <p className="font-mono text-xs text-gray-500">
                {format(event.start, "EEE p")} – {format(event.end, "p")}
              </p>
              <p className="font-mono text-sm font-bold">{event.title}</p>
              {event.location && (
                <p className="font-mono text-xs text-gray-500">{event.location}</p>
              )}
            </li>
          ))}
      </ol>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="relative min-w-[720px] border-l border-gray-300 dark:border-gray-700"
        style={{ height: laneCount * LANE_HEIGHT_PX + 24 }}
      >
        {laneEvents.map((event) => {
          const startMinutes = minutesFromDayStart(event.start);
          const endMinutes = Math.max(minutesFromDayStart(event.end), startMinutes + 15);
          const left = (startMinutes / TOTAL_MINUTES) * 100;
          const width = ((endMinutes - startMinutes) / TOTAL_MINUTES) * 100;

          return (
            <div
              key={event.id}
              className="neu-border absolute overflow-hidden bg-primary p-2 text-white"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: event.lane * LANE_HEIGHT_PX,
                height: LANE_HEIGHT_PX - 8,
              }}
              title={`${event.title} (${format(event.start, "p")} - ${format(event.end, "p")})`}
            >
              <p className="truncate font-mono text-xs font-bold">{event.title}</p>
              <p className="truncate font-mono text-[10px]">{format(event.start, "p")}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
