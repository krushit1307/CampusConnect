/**
 * Unit Tests for Delivery Robot Telemetry Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateDeliveryRobotStatus } from './deliveryRobotTelemetryUtils';

describe('DeliveryRobotTelemetryUtils', () => {
  it('should calculate autonomous delivery robot status and battery telemetry', () => {
    const res = calculateDeliveryRobotStatus('ROBOT-BOT-12', 85, true);
    expect(res.robotId).toBe('ROBOT-BOT-12');
    expect(res.deliveryStatus).toBe('ARRIVED_AWAITING_PIN');
  });
});
