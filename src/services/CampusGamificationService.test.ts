import { describe, it, expect } from 'vitest';
import { CampusGamificationService } from '../../backend/src/services/CampusGamificationService';

describe('CampusGamificationService', () => {
  it('should fetch student profile', () => {
    const profile = CampusGamificationService.getProfile('STU-999');
    expect(profile.studentId).toBe('STU-999');
    expect(profile.level).toBeGreaterThan(0);
  });

  it('should award ECSoC26 badges successfully', () => {
    const profile = CampusGamificationService.awardBadge('STU-999', 'BADGE-ECS-L2');
    expect(profile.earnedBadges.some((b) => b.badgeId === 'BADGE-ECS-L2')).toBe(true);
  });

  it('should return service metrics', () => {
    const metrics = CampusGamificationService.getMetrics();
    expect(metrics.totalUsers).toBeGreaterThan(0);
  });
});
