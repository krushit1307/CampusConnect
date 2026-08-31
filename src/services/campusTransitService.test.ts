/**
 * University Campus Transit Shuttle & Fleet Telemetry Service Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateShuttleRouteDispatch,
  calculateShuttleFleetOccupancy,
  generateShuttleMaintenanceAlertReport,
  CAMPUS_SHUTTLE_ROUTES,
} from './campusTransitService';

describe('CampusTransitService', () => {
  const sampleShuttle = {
    shuttleId: 'SHUTTLE-BUS-104',
    driverName: 'Captain Marcus Vance',
    routeId: 'ROUTE-RED-LINE',
    routeName: CAMPUS_SHUTTLE_ROUTES.RED_LINE_CIRCULATOR,
    maxPassengerCapacity: 40,
    currentPassengerCount: 32,
    currentLatitude: 37.7749,
    currentLongitude: -122.4194,
    batteryPercent: 88,
    lastMaintenanceISO: '2026-08-15T00:00:00Z',
  };

  it('should evaluate shuttle route dispatch status and estimated arrival time', () => {
    const dispatch = evaluateShuttleRouteDispatch(sampleShuttle, 3.5);

    expect(dispatch).toBeDefined();
    expect(dispatch.isDispatchActive).toBe(true);
    expect(dispatch.estimatedEtaMinutes).toBe(7);
    expect(dispatch.routeStatus).toBe('ON_SCHEDULE');
  });

  it('should calculate shuttle fleet passenger occupancy and crowding status', () => {
    const occupancy = calculateShuttleFleetOccupancy(sampleShuttle.maxPassengerCapacity, sampleShuttle.currentPassengerCount);

    expect(occupancy).toBeDefined();
    expect(occupancy.occupancyRatePercent).toBe(80.0);
    expect(occupancy.isCapacityExceeded).toBe(false);
    expect(occupancy.crowdingStatus).toBe('BUSY_NEAR_CAPACITY');
  });

  it('should generate shuttle fleet preventive maintenance alert report', () => {
    const report = generateShuttleMaintenanceAlertReport(sampleShuttle.shuttleId, 12500, 15);

    expect(report).toBeDefined();
    expect(report.shuttleId).toBe('SHUTTLE-BUS-104');
    expect(report.isMaintenanceRequired).toBe(true);
    expect(report.maintenanceAlertLevel).toBe('ROUTINE_SERVICE_DUE');
  });
});
