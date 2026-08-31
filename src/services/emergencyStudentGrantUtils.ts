/**
 * Emergency Student Housing & Meal Voucher Grant Relief Utilities
 */

export interface EmergencyGrantMetrics {
  approvedGrantAmountUSD: number;
  isImmediateDisbursementApproved: boolean;
  reliefType: 'HOUSING_RENT_RELIEF' | 'CAMPUS_MEAL_VOUCHER' | 'EMERGENCY_MEDICAL_GRANT';
}

/**
 * Calculates emergency relief grant amount for students facing financial hardship.
 */
export function calculateEmergencyStudentGrant(
  hardshipType: 'HOUSING' | 'FOOD_INSECURITY' | 'MEDICAL',
  requestedAmountUSD: number
): EmergencyGrantMetrics {
  const maxGrant = hardshipType === 'HOUSING' ? 1500 : hardshipType === 'MEDICAL' ? 2000 : 500;
  const approved = Math.min(requestedAmountUSD, maxGrant);

  let type: EmergencyGrantMetrics['reliefType'] = 'CAMPUS_MEAL_VOUCHER';
  if (hardshipType === 'HOUSING') type = 'HOUSING_RENT_RELIEF';
  else if (hardshipType === 'MEDICAL') type = 'EMERGENCY_MEDICAL_GRANT';

  return {
    approvedGrantAmountUSD: approved,
    isImmediateDisbursementApproved: approved <= 1000,
    reliefType: type,
  };
}
