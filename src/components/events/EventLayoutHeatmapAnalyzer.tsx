import { Link } from "react-router-dom";
import { EventLayoutHeatmapLayer } from "@/components/events/floorplan/EventLayoutHeatmapLayer";
import { useEventLayoutHeatmap } from "@/hooks/useEventLayoutHeatmap";
import { DEFAULT_VENUE, FT_TO_PX } from "@/lib/floorplan/types";
import { isZoneAtRestrictThreshold, zoneCheckInAppTitle } from "@/lib/eventLayoutHeatmap";

interface EventLayoutHeatmapAnalyzerProps {
  eventId: string;
  venue?: { width_ft: number; height_ft: number };
}

export function EventLayoutHeatmapAnalyzer({ eventId, venue }: EventLayoutHeatmapAnalyzerProps) {
  const bounds = venue ?? DEFAULT_VENUE;
  const { zones, checkins, securityMessage, isLoading } = useEventLayoutHeatmap(eventId, bounds);
  const viewW = bounds.width_ft * FT_TO_PX;
  const viewH = bounds.height_ft * FT_TO_PX;
  const restricted = zones.filter((z) => isZoneAtRestrictThreshold(z.current_occupancy, z.max_capacity));

  return (
    <div
      className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000]"
      data-testid="event-layout-heatmap-analyzer"
    >
      <h2 className="font-display text-xl font-black uppercase">Event Layout Heatmap</h2>
      <p className="mt-1 font-mono text-xs text-black/60">
        Live zone occupancy from door QR scans. Deep red at 95% capacity dispatches Campus Security.
      </p>

      {(securityMessage || restricted.length > 0) && (
        <div
          className="mt-4 border-2 border-red-900 bg-[#7f1d1d] p-4 text-white"
          data-testid="campus-security-alert"
          role="alert"
        >
          <p className="font-display text-sm font-black uppercase">Campus Security Alert</p>
          <p className="mt-1 font-mono text-xs">
            {securityMessage ||
              `Restrict access to the ${restricted[0].corridor_name}. ${restricted[0].name} has reached 95% capacity.`}
          </p>
        </div>
      )}

      <div className="mt-4 overflow-auto bg-gray-100 p-3">
        {isLoading && zones.length === 0 ? (
          <p className="font-mono text-xs text-gray-500">Loading layout heatmap…</p>
        ) : (
          <svg
            viewBox={`0 0 ${viewW} ${viewH}`}
            className="w-full bg-white"
            aria-label="Event layout occupancy heatmap"
          >
            <rect width={viewW} height={viewH} fill="#f8fafc" />
            <EventLayoutHeatmapLayer zones={zones} />
          </svg>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {zones.map((zone) => (
          <Link
            key={zone.id}
            to={`/events/${eventId}/zones/${zone.id}/check-in`}
            className="neu-border neu-press bg-black px-3 py-2 font-mono text-[11px] font-bold uppercase text-yellow-300 shadow-[2px_2px_0_0_#000]"
          >
            Open {zoneCheckInAppTitle(zone.name)}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <p className="font-mono text-[10px] font-bold uppercase text-black/50">Live check-in stream</p>
        {checkins.length === 0 ? (
          <p className="mt-1 font-mono text-xs text-black/40">No zone scans yet.</p>
        ) : (
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-[11px]">
            {checkins.map((row) => {
              const zone = zones.find((z) => z.id === row.zone_id);
              return (
                <li key={row.id}>
                  {new Date(row.scanned_at).toLocaleTimeString()} — {zone?.name ?? "Zone"} door
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
