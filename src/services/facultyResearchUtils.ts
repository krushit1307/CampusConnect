/**
 * Faculty Research Productivity & Grant Allocation Telemetry Utilities
 */

export interface FacultyResearchProductivityMetrics {
  publicationsPerFaculty: number;
  grantFundingPerFacultyUSD: number;
  researchExcellenceScore: number;
}

/**
 * Calculates academic department faculty research metrics.
 */
export function calculateFacultyResearchProductivity(
  totalPublications: number,
  totalGrantsUSD: number,
  facultyCount: number
): FacultyResearchProductivityMetrics {
  if (facultyCount === 0) {
    return { publicationsPerFaculty: 0, grantFundingPerFacultyUSD: 0, researchExcellenceScore: 0 };
  }

  const pubs = Math.round((totalPublications / facultyCount) * 10) / 10;
  const grants = Math.round(totalGrantsUSD / facultyCount);
  const score = Math.min(100, Math.round(pubs * 20 + (grants / 10000) * 10));

  return {
    publicationsPerFaculty: pubs,
    grantFundingPerFacultyUSD: grants,
    researchExcellenceScore: score,
  };
}
