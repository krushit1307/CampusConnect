import { ActiveEventMapData, HeatmapPoint } from "@/types/heatmap";
import { normalizeWeight } from "./normalizeWeight";

/**
 * Transforms an array of ActiveEventMapData into HeatmapPoint array
 * expected by leaflet.heat [[lat, lng, weight], ...]
 */
export function buildHeatmapDataset(events: ActiveEventMapData[]): HeatmapPoint[] {
  return events.map((event) => {
    return [event.lat, event.lng, normalizeWeight(event.rsvpCount)];
  });
}
