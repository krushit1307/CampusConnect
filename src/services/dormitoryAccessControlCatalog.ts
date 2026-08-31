/**
 * Campus Security Dormitory Electronic Keycard Door Access Catalog
 */

export const DORMITORY_ACCESS_CONTROL_CATALOG = [
  { doorId: 'DOOR-NORTH-101', buildingName: 'North Quad', isRfidActive: true, lastAccessLogISO: '2026-08-30T09:45:00Z' },
  { doorId: 'DOOR-SOUTH-302', buildingName: 'South Campus', isRfidActive: true, lastAccessLogISO: '2026-08-30T09:50:00Z' },
  { doorId: 'DOOR-WEST-504', buildingName: 'West Legacy Quad', isRfidActive: false, lastAccessLogISO: '2026-08-30T08:00:00Z' },
];

/**
 * Validates electronic RFID keycard access permission for dormitory door entry.
 */
export function validateDoorAccessPermission(doorId: string): boolean {
  const match = DORMITORY_ACCESS_CONTROL_CATALOG.find(d => d.doorId === doorId);
  return match ? match.isRfidActive : false;
}
