export const QUIET_SPACE_NODE_TYPE = "Quiet_Space";

export const SENSORY_DB_THRESHOLD = 90;
export const SENSORY_SUSTAINED_MS = 5 * 60 * 1000;

export const SENSORY_ALERT_TITLE = "Sensory Alert";
export const SENSORY_ALERT_MESSAGE =
  "The Main Hall is very loud right now. Click here for routing to the Quiet Room.";

export type MapPoint = { x: number; y: number };

export function quietRoomRoutePath(eventId: string): string {
  return `/events/${eventId}?quietRoute=1`;
}

export function updateSustainedLoudWindow(
  loudSinceMs: number | null,
  sampleDb: number,
  nowMs: number,
  thresholdDb = SENSORY_DB_THRESHOLD,
): number | null {
  if (sampleDb <= thresholdDb) return null;
  return loudSinceMs ?? nowMs;
}

export function shouldTriggerSensoryAlert(
  loudSinceMs: number | null,
  nowMs: number,
  durationMs = SENSORY_SUSTAINED_MS,
): boolean {
  return loudSinceMs != null && nowMs - loudSinceMs >= durationMs;
}

export function isQuietSpaceNode(node: {
  type?: string | null;
  entity_name?: string | null;
}): boolean {
  const type = (node.type || "").trim();
  const name = (node.entity_name || "").trim();
  return type === QUIET_SPACE_NODE_TYPE || name === QUIET_SPACE_NODE_TYPE;
}

export function nodeCenter(node: {
  x_coord: number;
  y_coord: number;
  width: number;
  height: number;
}): MapPoint {
  return {
    x: Number(node.x_coord) + Number(node.width) / 2,
    y: Number(node.y_coord) + Number(node.height) / 2,
  };
}

export function zoneCenterPercent(
  zone: { x_ft: number; y_ft: number; width_ft: number; height_ft: number },
  venueWidthFt = 100,
  venueHeightFt = 60,
): MapPoint {
  const width = venueWidthFt || 100;
  const height = venueHeightFt || 60;
  return {
    x: ((Number(zone.x_ft) + Number(zone.width_ft) / 2) / width) * 100,
    y: ((Number(zone.y_ft) + Number(zone.height_ft) / 2) / height) * 100,
  };
}

/** Straight spatial polyline from the estimated zone to the Quiet_Space node. */
export function buildQuietRoomPolyline(from: MapPoint, to: MapPoint): string {
  return `${from.x},${from.y} ${to.x},${to.y}`;
}

export function estimateZonePoint(
  zones: Array<{
    id: string;
    name: string;
    x_ft: number;
    y_ft: number;
    width_ft: number;
    height_ft: number;
  }>,
  checkedInZoneId?: string | null,
): MapPoint {
  if (!zones.length) return { x: 50, y: 50 };
  const byCheckin = checkedInZoneId ? zones.find((z) => z.id === checkedInZoneId) : undefined;
  const mainHall = zones.find((z) => /main hall/i.test(z.name));
  return zoneCenterPercent(byCheckin || mainHall || zones[0]);
}
