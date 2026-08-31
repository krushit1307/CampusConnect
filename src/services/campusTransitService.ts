/**
 * University Campus Transit Shuttle & Fleet Telemetry Service
 * Manages live GPS shuttle location tracking, passenger occupancy rates, route arrival ETAs,
 * electric bus fleet battery charge telemetry, and preventive vehicle maintenance schedules.
 */

export const CAMPUS_SHUTTLE_ROUTES = {
  RED_LINE_CIRCULATOR: 'Red Line Main Campus Loop',
  BLUE_LINE_EXPRESS: 'Blue Line Research Park Express',
  GREEN_LINE_HOUSING: 'Green Line Dormitory & Dining Shuttle',
  NIGHT_OWL_SAFETY: 'Night Owl Escort Service',
};

export interface ShuttleVehicleTelemetry {
  shuttleId: string;
  driverName: string;
  routeId: string;
  routeName: string;
  maxPassengerCapacity: number;
  currentPassengerCount: number;
  currentLatitude: number;
  currentLongitude: number;
  batteryPercent: number;
  lastMaintenanceISO: string;
}

export interface ShuttleDispatchResult {
  isDispatchActive: boolean;
  estimatedEtaMinutes: number;
  routeStatus: 'ON_SCHEDULE' | 'MINOR_DELAY' | 'HEAVY_TRAFFIC_ALERT' | 'OUT_OF_SERVICE';
}

export interface ShuttleOccupancyMetrics {
  occupancyRatePercent: number;
  availableSeatsCount: number;
  isCapacityExceeded: boolean;
  crowdingStatus: 'LIGHT_PASSENGERS' | 'MODERATE' | 'BUSY_NEAR_CAPACITY' | 'FULL_STANDBY_ONLY';
}

export interface ShuttleMaintenanceAlertReport {
  shuttleId: string;
  odometerMiles: number;
  batteryHealthPercent: number;
  isMaintenanceRequired: boolean;
  maintenanceAlertLevel: 'VEHICLE_HEALTHY' | 'ROUTINE_SERVICE_DUE' | 'CRITICAL_BATTERY_LOW';
}

/**
 * Evaluates live shuttle route dispatch status and stop arrival ETA.
 */
export function evaluateShuttleRouteDispatch(
  shuttle: ShuttleVehicleTelemetry,
  distanceToNextStopMiles: number
): ShuttleDispatchResult {
  const avgSpeedMph = 30.0;
  const etaMinutes = Math.max(1, Math.round((distanceToNextStopMiles / avgSpeedMph) * 60.0));

  let status: ShuttleDispatchResult['routeStatus'] = 'ON_SCHEDULE';
  if (shuttle.batteryPercent < 15) {
    status = 'OUT_OF_SERVICE';
  } else if (etaMinutes > 15) {
    status = 'HEAVY_TRAFFIC_ALERT';
  } else if (etaMinutes > 8) {
    status = 'MINOR_DELAY';
  }

  return {
    isDispatchActive: shuttle.batteryPercent >= 15,
    estimatedEtaMinutes: etaMinutes,
    routeStatus: status,
  };
}

/**
 * Calculates shuttle passenger occupancy rate and crowding level.
 */
export function calculateShuttleFleetOccupancy(
  maxCapacity: number,
  currentCount: number
): ShuttleOccupancyMetrics {
  const available = Math.max(0, maxCapacity - currentCount);
  const rate = maxCapacity > 0 ? Math.round((currentCount / maxCapacity) * 100.0 * 10) / 10 : 0;
  const exceeded = currentCount > maxCapacity;

  let crowding: ShuttleOccupancyMetrics['crowdingStatus'] = 'LIGHT_PASSENGERS';
  if (rate >= 100.0) crowding = 'FULL_STANDBY_ONLY';
  else if (rate >= 75.0) crowding = 'BUSY_NEAR_CAPACITY';
  else if (rate >= 40.0) crowding = 'MODERATE';

  return {
    occupancyRatePercent: rate,
    availableSeatsCount: available,
    isCapacityExceeded: exceeded,
    crowdingStatus: crowding,
  };
}

/**
 * Generates preventive vehicle maintenance alert report for campus fleet operations.
 */
export function generateShuttleMaintenanceAlertReport(
  shuttleId: string,
  odometerMiles: number,
  batteryHealthPercent: number
): ShuttleMaintenanceAlertReport {
  const isServiceDue = odometerMiles > 10000 || batteryHealthPercent < 20;

  let alert: ShuttleMaintenanceAlertReport['maintenanceAlertLevel'] = 'VEHICLE_HEALTHY';
  if (batteryHealthPercent < 20) alert = 'CRITICAL_BATTERY_LOW';
  else if (odometerMiles > 10000) alert = 'ROUTINE_SERVICE_DUE';

  return {
    shuttleId,
    odometerMiles,
    batteryHealthPercent,
    isMaintenanceRequired: isServiceDue,
    maintenanceAlertLevel: alert,
  };
}
