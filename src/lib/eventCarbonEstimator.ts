export type CateringType = "vegan" | "vegetarian" | "standard" | "zero_waste" | "none";

export interface CarbonCalculationParams {
  venueSqft: number;
  durationHours: number;
  attendeeCount: number;
  commuterRatio?: number; // 0.0 to 1.0 (default 0.35)
  cateringType: CateringType;
  mitigations: string[];
}

export interface CarbonFootprintResult {
  venueCo2Kg: number;
  transitCo2Kg: number;
  cateringCo2Kg: number;
  mitigationSavingsKg: number;
  totalCo2Kg: number;
  totalCo2Tons: number;
  co2PerAttendeeKg: number;
  isGreenCertified: boolean;
  sustainabilityScore: number; // 0 to 100 (higher is more sustainable)
}

export const AVAILABLE_SUSTAINABLE_MITIGATIONS: { id: string; label: string; description: string; reductionPercent: number }[] = [
  {
    id: "zero_waste_packaging",
    label: "Zero Waste Compostable Packaging",
    description: "100% biodegradable plates and compost collection bins",
    reductionPercent: 15,
  },
  {
    id: "public_transit_shuttle",
    label: "Public Transit & Campus Shuttles",
    description: "Incentivize walking, biking, and electric campus shuttles",
    reductionPercent: 15,
  },
  {
    id: "digital_collateral",
    label: "100% Digital Collateral (No Flyers)",
    description: "Digital QR agendas and virtual badges instead of paper",
    reductionPercent: 10,
  },
  {
    id: "plant_based_menu",
    label: "100% Plant-Based Menu Sourcing",
    description: "Locally sourced organic vegan/vegetarian catering",
    reductionPercent: 15,
  },
  {
    id: "renewable_venue_power",
    label: "Renewable Power / Daylight Venue",
    description: "Host in outdoor/naturally lit LEED-certified spaces",
    reductionPercent: 10,
  },
];

/**
 * Calculates dynamic event carbon footprint based on venue, transit, and catering (#3590).
 */
export function calculateEventCarbonFootprint(
  params: CarbonCalculationParams
): CarbonFootprintResult {
  const attendees = Math.max(1, params.attendeeCount || 1);
  const duration = Math.max(0.5, params.durationHours || 1);
  const sqft = Math.max(100, params.venueSqft || 1000);
  const commuterRatio = typeof params.commuterRatio === "number" ? Math.min(1, Math.max(0, params.commuterRatio)) : 0.35;

  // 1. Venue HVAC & Lighting (0.12 kg CO2 / sqft-hour)
  const venueCo2Kg = Number((sqft * duration * 0.12).toFixed(2));

  // 2. Attendee Transit (commuters ~ 2.4kg, dorm walk/bike ~ 0.2kg)
  const avgTransitPerPerson = commuterRatio * 2.4 + (1 - commuterRatio) * 0.2;
  const transitCo2Kg = Number((attendees * avgTransitPerPerson).toFixed(2));

  // 3. Catering Factor
  let cateringPerPerson = 3.5; // Standard Meat/Dairy
  switch (params.cateringType) {
    case "vegan":
      cateringPerPerson = 0.5;
      break;
    case "vegetarian":
      cateringPerPerson = 1.2;
      break;
    case "zero_waste":
      cateringPerPerson = 1.0;
      break;
    case "none":
      cateringPerPerson = 0.0;
      break;
    default:
      cateringPerPerson = 3.5;
  }
  const cateringCo2Kg = Number((attendees * cateringPerPerson).toFixed(2));

  const rawTotal = venueCo2Kg + transitCo2Kg + cateringCo2Kg;

  // 4. Mitigations Discount (max 60% reduction)
  const activeMitigations = params.mitigations || [];
  let totalDiscountPercent = 0;
  activeMitigations.forEach((mId) => {
    const match = AVAILABLE_SUSTAINABLE_MITIGATIONS.find((m) => m.id === mId || m.label === mId);
    totalDiscountPercent += match ? match.reductionPercent : 15;
  });

  const clampedDiscount = Math.min(60, totalDiscountPercent) / 100;
  const mitigationSavingsKg = Number((rawTotal * clampedDiscount).toFixed(2));
  const totalCo2Kg = Number((rawTotal - mitigationSavingsKg).toFixed(2));
  const totalCo2Tons = Number((totalCo2Kg / 1000).toFixed(3));
  const co2PerAttendeeKg = Number((totalCo2Kg / attendees).toFixed(2));

  // Award Green Certified badge if emissions per attendee are <= 1.5 kg CO2e
  const isGreenCertified = co2PerAttendeeKg <= 1.5;

  // Sustainability score from 0 (poor) to 100 (excellent)
  // 1.0 kg/person or less -> 90-100, 5.0 kg/person -> 20
  const baseScore = Math.max(10, Math.min(100, Math.round(100 - (co2PerAttendeeKg / 4.0) * 80 + clampedDiscount * 30)));
  const sustainabilityScore = isGreenCertified ? Math.max(85, baseScore) : Math.min(84, baseScore);

  return {
    venueCo2Kg,
    transitCo2Kg,
    cateringCo2Kg,
    mitigationSavingsKg,
    totalCo2Kg,
    totalCo2Tons,
    co2PerAttendeeKg,
    isGreenCertified,
    sustainabilityScore,
  };
}

/**
 * Returns public badge metadata for green certified events (#3590).
 */
export function getGreenBadgeStatus(co2PerAttendeeKg: number): {
  isGreen: boolean;
  label: string;
  badgeClass: string;
} {
  if (co2PerAttendeeKg <= 1.5) {
    return {
      isGreen: true,
      label: "🌱 Certified Green Event",
      badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-400 font-bold",
    };
  }
  return {
    isGreen: false,
    label: "Standard Impact Event",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-300",
  };
}
