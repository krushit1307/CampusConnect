/**
 * Unit Tests for Traffic Congestion Utilities
 */

import { describe, it, expect } from 'vitest';
import { evaluateCampusTrafficFlow } from './trafficCongestionUtils';

describe('TrafficCongestionUtils', () => {
  it('should flag heavy gridlock traffic congestion and recommend alternate route', () => {
    const res = evaluateCampusTrafficFlow('North Main Gate Intersection', 52);
    expect(res.congestionLevel).toBe('HEAVY_CONGESTION_GRIDLOCK');
    expect(res.recommendedAlternateRoute).toContain('Perimeter Boulevard');
  });
});
