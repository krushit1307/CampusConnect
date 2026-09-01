/** Issue #4722: fire-code threshold that turns a zone deep red and pages security. */
export const ZONE_RESTRICT_RATIO = 0.95;
export const LAYOUT_HEATMAP_DEEP_RED = "#7f1d1d";

export type EventLayoutZone = {
  id: string;
  event_id: string;
  name: string;
  corridor_name: string;
  max_capacity: number;
  current_occupancy: number;
  x_ft: number;
  y_ft: number;
  width_ft: number;
  height_ft: number;
  door_x_ft: number;
  door_y_ft: number;
  security_alerted_at: string | null;
};

export type EventZoneCheckin = {
  id: string;
  event_id: string;
  zone_id: string;
  ticket_payload: string | null;
  scanned_at: string;
};

export function getZoneOccupancyRatio(occupancy: number, maxCapacity: number): number {
  if (!Number.isFinite(maxCapacity) || maxCapacity <= 0) return 0;
  return Math.max(0, occupancy) / maxCapacity;
}

export function isZoneAtRestrictThreshold(occupancy: number, maxCapacity: number): boolean {
  return getZoneOccupancyRatio(occupancy, maxCapacity) >= ZONE_RESTRICT_RATIO;
}

/** D3 sequential fill: cool → warm, then deep red at 95%+ capacity. */
export function getLayoutHeatmapFill(occupancy: number, maxCapacity: number): string {
  const ratio = getZoneOccupancyRatio(occupancy, maxCapacity);
  if (ratio >= ZONE_RESTRICT_RATIO) return LAYOUT_HEATMAP_DEEP_RED;
  if (ratio < 0.5) return "#93c5fd";
  if (ratio < 0.75) return "#fde047";
  return "#fb923c";
}

export function buildCampusSecurityRestrictMessage(
  zoneName: string,
  corridorName?: string | null,
): string {
  const zone = zoneName?.trim() || "Zone A";
  const corridor = corridorName?.trim() || `${zone} corridor`;
  return `Restrict access to the ${corridor}. ${zone} has reached 95% capacity.`;
}

export function zoneCheckInAppTitle(zoneName: string): string {
  const name = zoneName?.trim() || "Zone";
  return `${name} Check-in`;
}
