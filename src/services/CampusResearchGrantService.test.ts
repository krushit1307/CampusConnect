import { describe, it, expect } from 'vitest';
import { CampusResearchGrantService } from '../../backend/src/services/CampusResearchGrantService';

describe('CampusResearchGrantService', () => {
  it('should fetch active research grants', () => {
    const grants = CampusResearchGrantService.getGrants();
    expect(grants.length).toBeGreaterThan(0);
    expect(grants[0].allocatedAmountUsd).toBeGreaterThan(0);
  });

  it('should fetch lab equipment inventory', () => {
    const equipment = CampusResearchGrantService.getEquipment();
    expect(equipment.length).toBeGreaterThan(0);
    expect(equipment[0].isAvailable).toBe(true);
  });

  it('should reserve shared lab equipment time slot', () => {
    const reservation = CampusResearchGrantService.reserveEquipment(
      'EQ-SEM-101',
      'STU-999',
      'Test Researcher',
      'GRANT-NSF-801',
      '2026-08-30',
      '11:00',
      2
    );

    expect(reservation.reservationId).toContain('RES-LAB-');
    expect(reservation.durationHours).toBe(2);
    expect(reservation.safetyCertificateVerified).toBe(true);
  });

  it('should return research service metrics', () => {
    const metrics = CampusResearchGrantService.getResearchMetrics();
    expect(metrics.totalGrantsFundingUsd).toBeGreaterThan(0);
    expect(metrics.totalHoursDelivered).toBeGreaterThan(0);
  });
});
