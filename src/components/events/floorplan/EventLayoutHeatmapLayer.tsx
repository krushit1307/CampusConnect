import { FT_TO_PX } from "@/lib/floorplan/types";
import {
  getLayoutHeatmapFill,
  isZoneAtRestrictThreshold,
  zoneCheckInAppTitle,
  type EventLayoutZone,
} from "@/lib/eventLayoutHeatmap";

interface EventLayoutHeatmapLayerProps {
  zones: EventLayoutZone[];
  onDoorClick?: (zone: EventLayoutZone) => void;
}

/** D3-colored occupancy overlay + door kiosk markers on the floorplan SVG (#4722). */
export function EventLayoutHeatmapLayer({ zones, onDoorClick }: EventLayoutHeatmapLayerProps) {
  if (zones.length === 0) return null;

  return (
    <g data-testid="event-layout-heatmap" pointerEvents="none">
      {zones.map((zone) => {
        const restricted = isZoneAtRestrictThreshold(zone.current_occupancy, zone.max_capacity);
        const fill = getLayoutHeatmapFill(zone.current_occupancy, zone.max_capacity);
        const pct = Math.round((zone.current_occupancy / zone.max_capacity) * 100);
        return (
          <g key={zone.id}>
            <rect
              x={Number(zone.x_ft) * FT_TO_PX}
              y={Number(zone.y_ft) * FT_TO_PX}
              width={Number(zone.width_ft) * FT_TO_PX}
              height={Number(zone.height_ft) * FT_TO_PX}
              fill={fill}
              fillOpacity={restricted ? 0.72 : 0.38}
              stroke={restricted ? "#7f1d1d" : "#334155"}
              strokeWidth={restricted ? 4 : 1.5}
            />
            <text
              x={(Number(zone.x_ft) + Number(zone.width_ft) / 2) * FT_TO_PX}
              y={(Number(zone.y_ft) + Number(zone.height_ft) / 2) * FT_TO_PX}
              textAnchor="middle"
              className="pointer-events-none"
              fill={restricted ? "#fff" : "#111827"}
              fontSize={14}
              fontWeight={800}
            >
              {zone.name} {pct}%
            </text>
            <g
              pointerEvents="all"
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onDoorClick?.(zone);
              }}
              data-testid={`zone-door-${zone.name.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <rect
                x={Number(zone.door_x_ft) * FT_TO_PX - 54}
                y={Number(zone.door_y_ft) * FT_TO_PX - 14}
                width={108}
                height={28}
                rx={4}
                fill="#111827"
                stroke="#facc15"
                strokeWidth={2}
              />
              <text
                x={Number(zone.door_x_ft) * FT_TO_PX}
                y={Number(zone.door_y_ft) * FT_TO_PX + 4}
                textAnchor="middle"
                fill="#facc15"
                fontSize={10}
                fontWeight={700}
              >
                {zoneCheckInAppTitle(zone.name)}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
