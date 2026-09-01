import { describe, it, expect, beforeEach } from 'vitest';
import { NoiseSoundTriangulationService } from './noiseSoundTriangulationService';

describe('NoiseSoundTriangulationService', () => {
  let service: NoiseSoundTriangulationService;

  beforeEach(() => {
    service = new NoiseSoundTriangulationService();
  });

  it('should convert dBFS to calibrated SPL dBA correctly', () => {
    expect(service.convertDbfsToSpl(-15)).toBe(105);
    expect(service.convertDbfsToSpl(-38)).toBe(82);
    expect(service.convertDbfsToSpl(0)).toBe(120);
  });

  it('should verify noise violation when average decibels exceed 100 dB', async () => {
    const incidents = service.getIncidents();
    const targetIncident = incidents[0];

    const updated = await service.executeMobileSoundTriangulation(targetIncident.id, 'extreme_loud');

    expect(updated.status).toBe('VERIFIED_VIOLATION');
    expect(updated.triangulatedAverageDb).toBeGreaterThan(100);
    expect(updated.crowdsourcedReadings.length).toBe(5);
    expect(updated.policeDispatchTicket).toBeDefined();
    expect(updated.policeDispatchTicket?.dispatchPriority).toBe('HIGH_DISCIPLINARY');
    expect(updated.policeDispatchTicket?.empiricalDataSummary).toContain('Verified: Room volume is currently');
  });

  it('should dismiss noise complaint when room volume is within legal limits', async () => {
    const incidents = service.getIncidents();
    const targetIncident = incidents[0];

    const updated = await service.executeMobileSoundTriangulation(targetIncident.id, 'moderate_ambient');

    expect(updated.status).toBe('UNVERIFIED_DISMISSED');
    expect(updated.triangulatedAverageDb).toBeLessThanOrEqual(100);
    expect(updated.policeDispatchTicket?.dispatchPriority).toBe('LOGGED_ONLY');
    expect(updated.policeDispatchTicket?.empiricalDataSummary).toContain('Unverified: Room volume is currently');
  });
});
