/**
 * Unit Tests for Safe Walking Escort Utilities
 */

import { describe, it, expect } from 'vitest';
import { dispatchSafeWalkingEscort } from './safeEscortUtils';

describe('SafeEscortUtils', () => {
  it('should dispatch safety walking escort officer with estimated wait time', () => {
    const res = dispatchSafeWalkingEscort('Science Library', 'North Quad Residence Hall');
    expect(res.escortRequestId).toContain('ESCORT-');
    expect(res.escortStatus).toBe('OFFICER_DISPATCHED');
    expect(res.estimatedWaitMinutes).toBe(4);
  });
});
