/**
 * University Campus Housing & Dormitory Room Allocation Service
 * Manages student housing requests, roommate matching compatibility, ADA accessibility accommodations,
 * dormitory building occupancy telemetry, and facility maintenance dispatch systems.
 */

export const DORMITORY_BUILDING_TYPES = {
  FRESHMAN_RESIDENCE_HALL: 'Freshman Dedicated Residence Quad',
  UPPERCLASSMAN_SUITES: 'Upperclassman Apartment Suites',
  GRADUATE_HOUSING: 'Graduate & Family Housing Complex',
  GREEK_ORGANIZATION_HOUSE: 'Greek Life Honors House',
};

export interface StudentHousingRequest {
  requestId: string;
  studentId: string;
  studentName: string;
  academicYear: string;
  preferredBuildingType: string;
  requiresAdaAccessibility: boolean;
  requestedRoommateId?: string;
  submittedAt: string;
}

export interface HousingAllocationResult {
  isAllocated: boolean;
  assignedBuildingName: string;
  assignedRoomNumber: number;
  bedLetter: 'A' | 'B' | 'C' | 'D';
  allocationStatus: 'ROOM_ASSIGNED' | 'WAITLISTED' | 'ADA_ACCOMMODATION_PENDING';
}

export interface DormitoryOccupancyMetrics {
  totalBedCapacity: number;
  occupiedBedsCount: number;
  availableBedsCount: number;
  occupancyRatePercent: number;
  isOverCapacity: boolean;
}

export interface MaintenanceWorkOrderReport {
  workOrderId: string;
  roomIdentifier: string;
  issueDescription: string;
  priorityLevel: 'LOW' | 'MEDIUM' | 'HIGH_PRIORITY' | 'EMERGENCY';
  dispatchStatus: 'FACILITIES_DISPATCHED' | 'WORK_IN_PROGRESS' | 'COMPLETED';
  estimatedResolutionHours: number;
}

/**
 * Evaluates student housing request and assigns available dormitory room.
 */
export function evaluateHousingRoomAllocation(request: StudentHousingRequest): HousingAllocationResult {
  const buildingName = request.preferredBuildingType || DORMITORY_BUILDING_TYPES.FRESHMAN_RESIDENCE_HALL;
  const roomNum = Math.floor(Math.random() * 300) + 101;
  const beds: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  const assignedBed = beds[Math.floor(Math.random() * beds.length)];

  let status: HousingAllocationResult['allocationStatus'] = 'ROOM_ASSIGNED';
  if (request.requiresAdaAccessibility) {
    status = 'ADA_ACCOMMODATION_PENDING';
  }

  return {
    isAllocated: true,
    assignedBuildingName: buildingName,
    assignedRoomNumber: roomNum,
    bedLetter: assignedBed,
    allocationStatus: status,
  };
}

/**
 * Calculates building occupancy telemetry and available housing capacity.
 */
export function calculateDormitoryOccupancyRate(
  totalBeds: number,
  occupiedBeds: number
): DormitoryOccupancyMetrics {
  const available = Math.max(0, totalBeds - occupiedBeds);
  const rate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100.0 * 10) / 10 : 0;
  const over = occupiedBeds > totalBeds;

  return {
    totalBedCapacity: totalBeds,
    occupiedBedsCount: occupiedBeds,
    availableBedsCount: available,
    occupancyRatePercent: rate,
    isOverCapacity: over,
  };
}

/**
 * Generates facility maintenance work order report for dormitory repairs.
 */
export function generateHousingMaintenanceWorkOrderReport(
  roomIdentifier: string,
  issueDescription: string,
  priorityLevel: MaintenanceWorkOrderReport['priorityLevel']
): MaintenanceWorkOrderReport {
  let hours = 48;
  if (priorityLevel === 'EMERGENCY') hours = 4;
  else if (priorityLevel === 'HIGH_PRIORITY') hours = 24;
  else if (priorityLevel === 'MEDIUM') hours = 36;

  return {
    workOrderId: `WO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    roomIdentifier,
    issueDescription,
    priorityLevel,
    dispatchStatus: 'FACILITIES_DISPATCHED',
    estimatedResolutionHours: hours,
  };
}
