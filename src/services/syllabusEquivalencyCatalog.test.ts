/**
 * Unit Tests for Syllabus Equivalency Catalog Utilities
 */

import { describe, it, expect } from 'vitest';
import { mapLegacyCourseEquivalency, SYLLABUS_EQUIVALENCY_CATALOG } from './syllabusEquivalencyCatalog';

describe('SyllabusEquivalencyCatalog', () => {
  it('should map legacy course code to revised syllabus equivalent', () => {
    const mapped = mapLegacyCourseEquivalency('CS101');
    expect(mapped).toBe('CS101A');
  });

  it('should contain catalog of syllabus equivalency mappings', () => {
    expect(SYLLABUS_EQUIVALENCY_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
});
