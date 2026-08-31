/**
 * University Campus Housing & Dormitory Room Allocation Service Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateHousingRoomAllocation,
  calculateDormitoryOccupancyRate,
  generateHousingMaintenanceWorkOrderReport,
  DORMITORY_BUILDING_TYPES,
} from './campusHousingService';

describe('CampusHousingService', () => {
  const sampleRequest = {
    requestId: 'REQ-DORM-1029',
    studentId: 'STU-9901',
    studentName: 'Clara Oswald',
    academicYear: 'Freshman Year',
    preferredBuildingType: DORMITORY_BUILDING_TYPES.FRESHMAN_RESIDENCE_HALL,
    requiresAdaAccessibility: false,
    requestedRoommateId: 'STU-9902',
    submittedAt: '2026-08-30T10:00:00Z',
  };

  it('should evaluate housing room allocation and assign dormitory room', () => {
    const allocation = evaluateHousingRoomAllocation(sampleRequest);

    expect(allocation).toBeDefined();
    expect(allocation.isAllocated).toBe(true);
    expect(allocation.assignedBuildingName).toBeDefined();
    expect(allocation.assignedRoomNumber).toBeGreaterThan(100);
  });

  it('should calculate dormitory building occupancy rate and available bed capacity', () => {
    const occupancy = calculateDormitoryOccupancyRate(450, 410);

    expect(occupancy).toBeDefined();
    expect(occupancy.occupancyRatePercent).toBeCloseTo(91.1, 1);
    expect(occupancy.availableBedsCount).toBe(40);
    expect(occupancy.isOverCapacity).toBe(false);
  });

  it('should generate housing maintenance work order report for facilities management', () => {
    const report = generateHousingMaintenanceWorkOrderReport(
      'ROOM-402-B',
      'HVAC air conditioning cooling failure in summer session.',
      'HIGH_PRIORITY'
    );

    expect(report).toBeDefined();
    expect(report.workOrderId).toContain('WO-');
    expect(report.dispatchStatus).toBe('FACILITIES_DISPATCHED');
    expect(report.estimatedResolutionHours).toBe(24);
  });
});
