/**
 * Campus Traffic Congestion & Intersection Telemetry Utilities
 */

export interface TrafficCongestionMetrics {
  intersectionName: string;
  congestionLevel: 'LIGHT' | 'MODERATE_DELAY' | 'HEAVY_CONGESTION_GRIDLOCK';
  recommendedAlternateRoute: string;
}

/**
 * Evaluates campus intersection vehicle telemetry and traffic flow.
 */
export function evaluateCampusTrafficFlow(
  intersectionName: string,
  vehiclesPerMinute: number
): TrafficCongestionMetrics {
  let level: TrafficCongestionMetrics['congestionLevel'] = 'LIGHT';
  let alt = 'Direct Campus Drive';

  if (vehiclesPerMinute > 45) {
    level = 'HEAVY_CONGESTION_GRIDLOCK';
    alt = 'Bypass via Outer Perimeter Boulevard';
  } else if (vehiclesPerMinute > 25) {
    level = 'MODERATE_DELAY';
    alt = 'South Ring Road Cut-Through';
  }

  return {
    intersectionName,
    congestionLevel: level,
    recommendedAlternateRoute: alt,
  };
}
