/**
 * Dormitory Building Energy Efficiency & Sustainability Catalog
 */

export const DORMITORY_SUSTAINABILITY_CATALOG = [
  { buildingName: 'North Quad Residence Hall', leedCertificationLevel: 'PLATINUM', kwhPerStudentMonthly: 120.0 },
  { buildingName: 'South Campus Eco Suites', leedCertificationLevel: 'GOLD', kwhPerStudentMonthly: 145.0 },
  { buildingName: 'West Legacy Residence Quad', leedCertificationLevel: 'SILVER', kwhPerStudentMonthly: 180.0 },
];

/**
 * Calculates energy consumption efficiency rating.
 */
export function calculateDormitoryEnergyRating(kwhMonthly: number): string {
  if (kwhMonthly < 130.0) return 'ECO_EXCELLENCE';
  if (kwhMonthly < 160.0) return 'EFFICIENT_MODERATE';
  return 'HIGH_ENERGY_ALERT';
}
