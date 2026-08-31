import { LabEquipment, EquipmentReservation, UserSafetyCertification } from '@/types/labEquipment';

/**
 * Validates whether a student is eligible to reserve a piece of lab / HPC equipment.
 * Checks for safety certification prerequisites and time collisions.
 */
export function validateReservationEligibility(
  equipment: LabEquipment,
  studentCertifications: UserSafetyCertification[],
  existingReservations: EquipmentReservation[],
  proposedStart: Date,
  proposedEnd: Date
): {
  isEligible: boolean;
  reason?: string;
} {
  // 1. Check Safety Certification Gating
  if (equipment.requiredCertificationId) {
    const hasCert = studentCertifications.some(
      (c) => c.id === equipment.requiredCertificationId && new Date(c.expiresAt) > new Date()
    );
    if (!hasCert) {
      return {
        isEligible: false,
        reason: `Requires active safety certification: "${equipment.requiredCertificationName}".`,
      };
    }
  }

  // 2. Check Equipment Status
  if (equipment.status === 'maintenance' || equipment.status === 'offline') {
    return {
      isEligible: false,
      reason: `Equipment is currently ${equipment.status}.`,
    };
  }

  // 3. Check for Time Slot Collisions
  const hasCollision = existingReservations.some((res) => {
    if (res.equipmentId !== equipment.id || res.status === 'cancelled') return false;
    const resStart = new Date(res.startTime);
    const resEnd = new Date(res.endTime);
    return proposedStart < resEnd && proposedEnd > resStart;
  });

  if (hasCollision) {
    return {
      isEligible: false,
      reason: 'Time slot overlaps with an existing confirmed reservation.',
    };
  }

  return { isEligible: true };
}
