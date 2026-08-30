/**
 * Dormitory Resident Advisor (RA) Peer Counseling & On-Call Rotation Utilities
 */

export interface RaOnCallRotationMetrics {
  assignedBuilding: string;
  onCallHoursThisWeek: number;
  incidentEscalationsRecorded: number;
  dutyStatus: 'ACTIVE_ON_CALL' | 'OFF_DUTY' | 'EMERGENCY_BACKUP';
}

/**
 * Calculates Resident Advisor (RA) weekly on-call load.
 */
export function calculateRaOnCallSchedule(
  buildingName: string,
  onCallHours: number,
  incidents: number
): RaOnCallRotationMetrics {
  let status: RaOnCallRotationMetrics['dutyStatus'] = 'OFF_DUTY';
  if (onCallHours > 0) status = 'ACTIVE_ON_CALL';
  if (incidents >= 3) status = 'EMERGENCY_BACKUP';

  return {
    assignedBuilding: buildingName,
    onCallHoursThisWeek: onCallHours,
    incidentEscalationsRecorded: incidents,
    dutyStatus: status,
  };
}
