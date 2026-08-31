/**
 * Academic Degree Program Syllabus Revision & Course Equivalency Mapping Catalog
 */

export const SYLLABUS_EQUIVALENCY_CATALOG = [
  { legacyCourseCode: 'CS101', newEquivalencyCode: 'CS101A', equivalenceMatchPercent: 95.0 },
  { legacyCourseCode: 'EE201', newEquivalencyCode: 'ECE201', equivalenceMatchPercent: 90.0 },
  { legacyCourseCode: 'MATH150', newEquivalencyCode: 'MATH151', equivalenceMatchPercent: 100.0 },
];

/**
 * Maps legacy course credits to newly revised syllabus equivalents.
 */
export function mapLegacyCourseEquivalency(legacyCode: string): string {
  const match = SYLLABUS_EQUIVALENCY_CATALOG.find(item => item.legacyCourseCode === legacyCode);
  return match ? match.newEquivalencyCode : legacyCode;
}
