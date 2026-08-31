import { ExternalLink } from "lucide-react";
import type { EventPerformance } from "@/hooks/useClubAnalytics";

interface Props {
  events: EventPerformance[];
}

function AttendanceBadge({ rate }: { rate: number }) {
  const bg = rate >= 70 ? "bg-lime" : rate >= 40 ? "bg-yellow-200" : "bg-red-200";
  return (
    <span
      className={`inline-flex items-center gap-1 neu-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${bg}`}
    >
      {rate}%
    </span>
  );
}

export function EventPerformanceTable({ events }: Props) {
  if (events.length === 0)
    return (
      <div className="flex items-center justify-center h-32 font-mono text-sm text-gray-400">
        No events to display.
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black">
            {["Event", "Date", "RSVPs", "Check-ins", "Attendance"].map((h) => (
              <th
                key={h}
                className={`p-2 font-mono text-[10px] font-bold uppercase tracking-wider text-gray-600 ${h === "Event" || h === "Date" ? "text-left" : "text-center"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr
              key={e.event_id}
              className="border-b border-gray-200 hover:bg-cream/50 transition-colors"
            >
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm truncate max-w-[180px]">
                    {e.title}
                  </span>
                  <a
                    href={`/events/${e.event_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black/40 hover:text-black transition-colors shrink-0"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </td>
              <td className="p-2 font-mono text-xs text-gray-600">
                {e.event_date
                  ? new Date(e.event_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "TBA"}
              </td>
              <td className="p-2 text-center font-mono text-sm font-bold">{e.rsvp_count}</td>
              <td className="p-2 text-center font-mono text-sm font-bold">{e.check_in_count}</td>
              <td className="p-2 text-center">
                <AttendanceBadge rate={e.attendance_rate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
