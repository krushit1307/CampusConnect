/**
 * Campus Recreation Rock Climbing Wall Safety Certification Catalog
 */

export const ROCK_CLIMBING_WALL_BELAY_CATALOG = [
  { studentId: 'STU-4401', belayCertificationStatus: 'TOP_ROPE_CERTIFIED', expirationDateISO: '2027-01-15T00:00:00Z' },
  { studentId: 'STU-9941', belayCertificationStatus: 'LEAD_CLIMB_ADVANCED', expirationDateISO: '2027-06-30T00:00:00Z' },
  { studentId: 'STU-1102', belayCertificationStatus: 'UNCERTIFIED_NOVICE', expirationDateISO: '2026-08-30T00:00:00Z' },
];

/**
 * Validates student belay safety certification for climbing wall access.
 */
export function validateBelayCertification(studentId: string): boolean {
  const match = ROCK_CLIMBING_WALL_BELAY_CATALOG.find(c => c.studentId === studentId);
  return match ? match.belayCertificationStatus !== 'UNCERTIFIED_NOVICE' : false;
}
