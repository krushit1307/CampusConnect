/**
 * Unit Tests for Laundry Machine Telemetry Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateLaundryMachineAvailability } from './laundryMachineTelemetryUtils';

describe('LaundryMachineTelemetryUtils', () => {
  it('should calculate available laundry washers and dryers count', () => {
    const res = calculateLaundryMachineAvailability(10, 6, 10, 4);
    expect(res.availableWashersCount).toBe(4);
    expect(res.availableDryersCount).toBe(6);
  });
});
