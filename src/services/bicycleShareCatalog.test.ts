/**
 * Unit Tests for Bicycle Share Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { getAvailableBikesAtHub, BICYCLE_SHARE_HUB_CATALOG } from './bicycleShareCatalog';

describe('BicycleShareCatalog', () => {
  it('should get available bikes inventory count at designated campus hub', () => {
    const count = getAvailableBikesAtHub('HUB-NORTH-LIBRARY');
    expect(count).toBe(18);
  });

  it('should contain catalog of campus e-bike share hubs', () => {
    expect(BICYCLE_SHARE_HUB_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
