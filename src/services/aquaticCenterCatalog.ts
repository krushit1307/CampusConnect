/**
 * Campus Recreation Swimming Pool & Aquatic Center Water Quality Telemetry Catalog
 */

export const AQUATIC_CENTER_WATER_QUALITY_CATALOG = [
  { poolName: 'Olympic Competition Pool', waterPhLevel: 7.4, chlorinePpm: 2.5, isTemperatureCompliant: true },
  { poolName: 'Hydrotherapy Spa Pool', waterPhLevel: 7.5, chlorinePpm: 3.0, isTemperatureCompliant: true },
  { poolName: 'Outdoor Recreational Pool', waterPhLevel: 7.2, chlorinePpm: 2.0, isTemperatureCompliant: true },
];

/**
 * Validates swimming pool water quality pH safety standards.
 */
export function validatePoolWaterPhSafety(poolName: string): boolean {
  const match = AQUATIC_CENTER_WATER_QUALITY_CATALOG.find(p => p.poolName === poolName);
  return match ? match.waterPhLevel >= 7.2 && match.waterPhLevel <= 7.8 : false;
}
