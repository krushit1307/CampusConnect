/**
 * Outdoor Recreation Gear & Camping Equipment Rental Telemetry Utilities
 */

export interface OutdoorGearRentalMetrics {
  rentalId: string;
  itemDescription: string;
  dailyRateUSD: number;
  isDepositWaived: boolean;
}

/**
 * Calculates outdoor recreation gear rental rates for student wilderness trips.
 */
export function rentOutdoorRecreationGear(
  gearCategory: string,
  isStudentClubMember: boolean
): OutdoorGearRentalMetrics {
  let rate = 15.0;
  if (gearCategory === '4-Person Camping Tent') rate = 25.0;
  else if (gearCategory === 'Kayaking Paddle & Lifejacket') rate = 20.0;

  return {
    rentalId: `RENT-GEAR-${Math.floor(Math.random() * 800 + 100)}`,
    itemDescription: gearCategory,
    dailyRateUSD: isStudentClubMember ? Math.round(rate * 0.5 * 100) / 100 : rate,
    isDepositWaived: isStudentClubMember,
  };
}
