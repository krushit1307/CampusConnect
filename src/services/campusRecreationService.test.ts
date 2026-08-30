/**
 * University Campus Recreation Center & Fitness Wellness Service Unit Test Suite
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateGymEquipmentReservation,
  calculateFitnessCenterOccupancy,
  generateWellnessClassBookingReport,
  FITNESS_CLASS_TYPES,
} from './campusRecreationService';

describe('CampusRecreationService', () => {
  const sampleReservation = {
    reservationId: 'RES-GYM-991',
    studentId: 'STU-4401',
    studentName: 'Oliver Queen',
    equipmentType: 'Squat Rack & Olympic Lifter',
    requestedDurationMinutes: 45,
    startTimeISO: '2026-08-30T16:00:00Z',
  };

  it('should evaluate gym equipment reservation and confirm time slot', () => {
    const confirm = evaluateGymEquipmentReservation(sampleReservation);

    expect(confirm).toBeDefined();
    expect(confirm.isConfirmed).toBe(true);
    expect(confirm.assignedLockerNumber).toBeGreaterThan(100);
    expect(confirm.reservationStatus).toBe('SLOT_CONFIRMED');
  });

  it('should calculate recreation fitness center live occupancy and capacity percentage', () => {
    const occupancy = calculateFitnessCenterOccupancy(250, 185);

    expect(occupancy).toBeDefined();
    expect(occupancy.occupancyRatePercent).toBe(74.0);
    expect(occupancy.availableCapacityCount).toBe(65);
    expect(occupancy.occupancyLevel).toBe('MODERATE_BUSY');
  });

  it('should generate group wellness class booking report', () => {
    const report = generateWellnessClassBookingReport(
      'CLASS-YOGA-101',
      FITNESS_CLASS_TYPES.VINYASA_YOGA_FLOW,
      'Coach Amanda Waller',
      25,
      22
    );

    expect(report).toBeDefined();
    expect(report.classId).toBe('CLASS-YOGA-101');
    expect(report.isClassFull).toBe(false);
    expect(report.waitlistCount).toBe(0);
  });
});
