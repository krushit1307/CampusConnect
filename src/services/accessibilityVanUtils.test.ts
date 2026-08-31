/**
 * Unit Tests for Accessibility Mobility Van Utilities
 */

import { describe, it, expect } from 'vitest';
import { dispatchAccessibilityMobilityVan } from './accessibilityVanUtils';

describe('AccessibilityVanUtils', () => {
  it('should dispatch ADA accessibility van with wheelchair lift deployed', () => {
    const res = dispatchAccessibilityMobilityVan('STU-1002', 'Science Hall');
    expect(res.vanId).toContain('VAN-ADA-');
    expect(res.isWheelchairLiftDeployed).toBe(true);
    expect(res.dispatchEtaMinutes).toBe(5);
  });
});
