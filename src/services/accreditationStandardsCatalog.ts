/**
 * Higher Education Degree Accreditation Requirements Catalog
 */

export const ACCREDITATION_STANDARDS_CATALOG = [
  {
    accreditationBody: 'ABET (Accreditation Board for Engineering and Technology)',
    minimumCoreCredits: 45,
    minimumLabHours: 120,
    facultyToStudentRatioLimit: 25.0,
  },
  {
    accreditationBody: 'NAAC (National Assessment and Accreditation Council)',
    minimumCoreCredits: 50,
    minimumLabHours: 100,
    facultyToStudentRatioLimit: 20.0,
  },
  {
    accreditationBody: 'AACSB (Association to Advance Collegiate Schools of Business)',
    minimumCoreCredits: 40,
    minimumLabHours: 60,
    facultyToStudentRatioLimit: 30.0,
  },
];

/**
 * Validates department parameters against target accreditation agency standard.
 */
export function validateAccreditationStandardCompliance(
  accreditationBody: string,
  coreCredits: number,
  labHours: number
): boolean {
  const standard = ACCREDITATION_STANDARDS_CATALOG.find(item => item.accreditationBody.startsWith(accreditationBody));
  if (!standard) return true;

  return coreCredits >= standard.minimumCoreCredits && labHours >= standard.minimumLabHours;
}
