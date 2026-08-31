/**
 * Unit Tests for Personal Trainer Booking Utilities
 */

import { describe, it, expect } from 'vitest';
import { bookPersonalTrainingSession } from './personalTrainerUtils';

describe('PersonalTrainerUtils', () => {
  it('should book personal training session with certified coach', () => {
    const res = bookPersonalTrainingSession('STU-1102', 'Hypertrophy & Strength Training');
    expect(res.trainerId).toContain('COACH-');
    expect(res.isSessionConfirmed).toBe(true);
    expect(res.sessionDurationMinutes).toBe(60);
  });
});
