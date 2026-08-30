/**
 * Unit Tests for Endowment Grant Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { isStudentEligibleForGrant, ENDOWMENT_GRANT_CATALOG } from './endowmentGrantCatalog';

describe('EndowmentGrantCatalog', () => {
  it('should verify student eligibility for endowment grants', () => {
    const ok = isStudentEligibleForGrant('STEM Women in Engineering Fellowship', 3.8);
    expect(ok).toBe(true);
  });

  it('should contain catalog of university endowment grant funds', () => {
    expect(ENDOWMENT_GRANT_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
