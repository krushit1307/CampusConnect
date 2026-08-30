/**
 * Student Esports Arena Gaming Station Telemetry Utilities
 */

export interface EsportsGamingStationMetrics {
  stationId: string;
  isStationOccupied: boolean;
  gpuTemperatureCelsius: number;
  activeGameTitle: string;
}

/**
 * Evaluates student esports gaming station telemetry.
 */
export function calculateEsportsStationTelemetry(
  stationId: string,
  gpuTemp: number,
  gameTitle: string
): EsportsGamingStationMetrics {
  return {
    stationId,
    isStationOccupied: gameTitle !== 'IDLE_DESKTOP',
    gpuTemperatureCelsius: gpuTemp,
    activeGameTitle: gameTitle,
  };
}
