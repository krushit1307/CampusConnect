/**
 * University Campus Recreation Center & Fitness Wellness Service
 * Manages student gym equipment time slot reservations, group workout class bookings,
 * recreation center live occupancy telemetry, and intramural sports league standings.
 */

export const FITNESS_CLASS_TYPES = {
  HIIT_CARDIO_BLAST: 'High-Intensity Interval Training (HIIT)',
  VINYASA_YOGA_FLOW: 'Mindful Vinyasa Yoga & Meditation',
  SPIN_CYCLES_EXPRESS: 'Indoor Power Spin Cycling',
  OLYMPIC_POWERLIFTING: 'Advanced Barbell Powerlifting Workshop',
};

export interface EquipmentReservationRequest {
  reservationId: string;
  studentId: string;
  studentName: string;
  equipmentType: string;
  requestedDurationMinutes: number;
  startTimeISO: string;
}

export interface EquipmentReservationConfirmation {
  isConfirmed: boolean;
  assignedLockerNumber: number;
  reservationStatus: 'SLOT_CONFIRMED' | 'EQUIPMENT_MAINTENANCE' | 'TIME_CONFLICT';
}

export interface RecreationCenterOccupancyMetrics {
  totalCapacity: number;
  currentCount: number;
  availableCapacityCount: number;
  occupancyRatePercent: number;
  occupancyLevel: 'QUIET_ATMOSPHERE' | 'MODERATE_BUSY' | 'PEAK_HOURS_CROWDED';
}

export interface WellnessClassBookingReport {
  classId: string;
  className: string;
  instructorName: string;
  maxAttendeesCount: number;
  bookedAttendeesCount: number;
  isClassFull: boolean;
  waitlistCount: number;
}

/**
 * Evaluates student gym equipment reservation request.
 */
export function evaluateGymEquipmentReservation(request: EquipmentReservationRequest): EquipmentReservationConfirmation {
  const lockerNum = Math.floor(Math.random() * 200) + 101;

  return {
    isConfirmed: true,
    assignedLockerNumber: lockerNum,
    reservationStatus: 'SLOT_CONFIRMED',
  };
}

/**
 * Calculates recreation fitness center live occupancy rate and crowd level.
 */
export function calculateFitnessCenterOccupancy(
  maxCapacity: number,
  currentCount: number
): RecreationCenterOccupancyMetrics {
  const available = Math.max(0, maxCapacity - currentCount);
  const rate = maxCapacity > 0 ? Math.round((currentCount / maxCapacity) * 100.0 * 10) / 10 : 0;

  let level: RecreationCenterOccupancyMetrics['occupancyLevel'] = 'QUIET_ATMOSPHERE';
  if (rate >= 80.0) level = 'PEAK_HOURS_CROWDED';
  else if (rate >= 45.0) level = 'MODERATE_BUSY';

  return {
    totalCapacity: maxCapacity,
    currentCount,
    availableCapacityCount: available,
    occupancyRatePercent: rate,
    occupancyLevel: level,
  };
}

/**
 * Generates group wellness class booking and waitlist telemetry report.
 */
export function generateWellnessClassBookingReport(
  classId: string,
  className: string,
  instructorName: string,
  maxCapacity: number,
  currentBooked: number
): WellnessClassBookingReport {
  const isFull = currentBooked >= maxCapacity;
  const waitlist = isFull ? Math.max(0, currentBooked - maxCapacity + 5) : 0;

  return {
    classId,
    className,
    instructorName,
    maxAttendeesCount: maxCapacity,
    bookedAttendeesCount: currentBooked,
    isClassFull: isFull,
    waitlistCount: waitlist,
  };
}
