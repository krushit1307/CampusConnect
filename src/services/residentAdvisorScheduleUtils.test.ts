/**
 * Unit Tests for Resident Advisor Schedule Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateRaOnCallSchedule } from './residentAdvisorScheduleUtils';

describe('ResidentAdvisorScheduleUtils', () => {
  it('should calculate RA active on-call status and incident escalations', () => {
    const res = calculateRaOnCallSchedule('North Quad', 24, 1);
    expect(res.dutyStatus).toBe('ACTIVE_ON_CALL');
    expect(res.onCallHoursThisWeek).toBe(24);
  });
});
