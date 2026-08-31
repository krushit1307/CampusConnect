/**
 * University Philanthropic Endowment Grant Catalog
 */

export const ENDOWMENT_GRANT_CATALOG = [
  { grantName: 'STEM Women in Engineering Fellowship', availableFundUSD: 500000, targetMinGpa: 3.5 },
  { grantName: 'First-Generation College Student Opportunity Grant', availableFundUSD: 750000, targetMinGpa: 3.0 },
  { grantName: 'Undergraduate Research Innovation Fund', availableFundUSD: 300000, targetMinGpa: 3.7 },
];

/**
 * Validates student eligibility for specific endowment grant.
 */
export function isStudentEligibleForGrant(grantName: string, studentGpa: number): boolean {
  const match = ENDOWMENT_GRANT_CATALOG.find(g => g.grantName === grantName);
  return match ? studentGpa >= match.targetMinGpa : false;
}
