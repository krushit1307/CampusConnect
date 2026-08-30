/**
 * Unit Tests for Dormitory Access Control Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { validateDoorAccessPermission, DORMITORY_ACCESS_CONTROL_CATALOG } from './dormitoryAccessControlCatalog';

describe('DormitoryAccessControlCatalog', () => {
  it('should validate RFID door access permission correctly', () => {
    const ok = validateDoorAccessPermission('DOOR-NORTH-101');
    expect(ok).toBe(true);
  });

  it('should contain catalog of dormitory door access control endpoints', () => {
    expect(DORMITORY_ACCESS_CONTROL_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
