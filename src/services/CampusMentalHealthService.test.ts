import { describe, it, expect } from 'vitest';
import { CampusMentalHealthService } from '../../backend/src/services/CampusMentalHealthService';

describe('CampusMentalHealthService', () => {
  it('should fetch peer support groups', () => {
    const groups = CampusMentalHealthService.getSupportGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].isAnonymousAllowed).toBe(true);
  });

  it('should log student mood and generate AI sentiment summary', () => {
    const log = CampusMentalHealthService.logStudentMood(
      'STU-999',
      3,
      'ANXIOUS',
      'Feeling overwhelmed with finals'
    );

    expect(log.logId).toContain('MOOD-');
    expect(log.aiSentimentSummary).toContain('counseling crisis helpline');
  });

  it('should return service metrics', () => {
    const metrics = CampusMentalHealthService.getWellnessMetrics();
    expect(metrics.totalLogs).toBeGreaterThan(0);
    expect(metrics.crisisHelplineStatus).toBe('24/7 OPERATIONAL');
  });
});
