/**
 * Unit Tests for Meditation Pod Utilities
 */

import { describe, it, expect } from 'vitest';
import { calculateMeditationPodMetrics } from './meditationPodUtils';

describe('MeditationPodUtils', () => {
  it('should calculate stress reduction index percentage from meditation pod sessions', () => {
    const res = calculateMeditationPodMetrics(85, 68);
    expect(res.podId).toContain('POD-ZEN-');
    expect(res.stressReductionIndexPercent).toBe(20.0);
  });
});
