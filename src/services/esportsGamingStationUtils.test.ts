/**
 * Unit Tests for Esports Gaming Station Telemetry Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateEsportsStationTelemetry } from './esportsGamingStationUtils';

describe('EsportsGamingStationUtils', () => {
  it('should calculate esports gaming station occupancy and GPU temperature telemetry', () => {
    const res = calculateEsportsStationTelemetry('RIG-ESPORTS-04', 68, 'Valorant Championship Tournament');
    expect(res.stationId).toBe('RIG-ESPORTS-04');
    expect(res.isStationOccupied).toBe(true);
    expect(res.gpuTemperatureCelsius).toBe(68);
  });
});
