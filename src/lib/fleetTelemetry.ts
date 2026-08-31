export interface RawShuttleTelemetry {
  shuttleCode: string;
  batteryPercent: number;
  currentSpeedMph: number;
  occupancyCount: number;
  maxCapacity: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  timestampIso?: string;
}

export type ShuttleMarkerColor = "red" | "yellow" | "green";

export interface LeafletMapBlipProps {
  shuttleCode: string;
  batteryPercent: number;
  currentSpeedMph: number;
  occupancyRatio: string;
  coordinates: [number, number]; // [lat, lng] for Leaflet.js
  markerColor: ShuttleMarkerColor;
  isLowBattery: boolean;
  dispatchCommand: string | null;
  popupHtml: string;
}

export const CRITICAL_BATTERY_THRESHOLD = 10.0;
export const WARNING_BATTERY_THRESHOLD = 25.0;

/**
 * Evaluates shuttle state, computes Leaflet.js map blip styling, and triggers automated depot dispatches.
 */
export function processShuttleTelemetryBlip(telemetry: RawShuttleTelemetry): LeafletMapBlipProps {
  const isLowBattery = telemetry.batteryPercent < CRITICAL_BATTERY_THRESHOLD;

  let markerColor: ShuttleMarkerColor = "green";
  let dispatchCommand: string | null = null;

  if (isLowBattery) {
    markerColor = "red";
    dispatchCommand = "ROUTE_TO_CHARGING_DEPOT";
  } else if (telemetry.batteryPercent < WARNING_BATTERY_THRESHOLD) {
    markerColor = "yellow";
  }

  const occupancyRatio = `${telemetry.occupancyCount}/${telemetry.maxCapacity}`;

  const popupHtml = `
    <div class="shuttle-popup p-2">
      <h3 class="font-bold text-base">${telemetry.shuttleCode}</h3>
      <p class="text-sm">Battery: <span style="color: ${markerColor}">${telemetry.batteryPercent.toFixed(1)}%</span></p>
      <p class="text-sm">Speed: ${telemetry.currentSpeedMph.toFixed(1)} mph</p>
      <p class="text-sm">Occupancy: ${occupancyRatio}</p>
      ${dispatchCommand ? `<p class="mt-2 text-xs font-bold text-red-600">🚨 DISPATCH: ${dispatchCommand}</p>` : ""}
    </div>
  `.trim();

  return {
    shuttleCode: telemetry.shuttleCode,
    batteryPercent: Number(telemetry.batteryPercent.toFixed(1)),
    currentSpeedMph: Number(telemetry.currentSpeedMph.toFixed(1)),
    occupancyRatio,
    coordinates: [telemetry.coordinates.lat, telemetry.coordinates.lng],
    markerColor,
    isLowBattery,
    dispatchCommand,
    popupHtml,
  };
}

/**
 * Aggregates multiple shuttle telemetry streams for the Admin Leaflet.js Dashboard overlay.
 */
export function aggregateFleetTelemetryDashboard(shuttles: RawShuttleTelemetry[]): {
  totalActiveFleet: number;
  chargingRequiredCount: number;
  blips: LeafletMapBlipProps[];
} {
  const blips = shuttles.map(processShuttleTelemetryBlip);
  const chargingRequiredCount = blips.filter((b) => b.isLowBattery).length;

  return {
    totalActiveFleet: shuttles.length,
    chargingRequiredCount,
    blips,
  };
}
