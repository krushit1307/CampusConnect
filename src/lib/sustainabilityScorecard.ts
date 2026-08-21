/**
 * Event Sustainability Scorecard (#3134).
 *
 * Estimates the CO2e footprint of an event from travel, catering, materials and
 * venue energy, then grades it on a per-attendee basis so that a 1,000-person
 * festival is not automatically penalised against a 20-person committee meeting.
 *
 * Emission factors are taken from the UK DEFRA 2024 greenhouse gas conversion
 * factor set and are kept in one place so an annual refresh is a single
 * reviewable diff. The module is deliberately free of React and Supabase
 * imports so it can be unit tested in isolation.
 */

export type TravelMode = "walk" | "cycle" | "bus" | "train" | "car" | "carpool" | "flight";

export type MealType = "vegan" | "vegetarian" | "chicken" | "fish" | "beef" | "mixed";

export type MaterialType =
  "printedPage" | "poster" | "lanyard" | "tshirt" | "toteBag" | "plasticBottle" | "disposableCup";

export type SustainabilityGrade = "A" | "B" | "C" | "D" | "E" | "F";

/** kg CO2e emitted per passenger-kilometre. */
export const TRAVEL_FACTORS_KG_PER_KM: Record<TravelMode, number> = {
  walk: 0,
  cycle: 0,
  bus: 0.102,
  train: 0.035,
  car: 0.171,
  carpool: 0.057,
  flight: 0.246,
};

/** kg CO2e per single serving, covering production through to plate. */
export const CATERING_FACTORS_KG_PER_SERVING: Record<MealType, number> = {
  vegan: 0.7,
  vegetarian: 1.2,
  chicken: 2.9,
  fish: 3.6,
  beef: 15.5,
  mixed: 4.0,
};

/** kg CO2e per physical unit produced. */
export const MATERIAL_FACTORS_KG_PER_UNIT: Record<MaterialType, number> = {
  printedPage: 0.005,
  poster: 0.35,
  lanyard: 0.29,
  tshirt: 7.5,
  toteBag: 1.4,
  plasticBottle: 0.08,
  disposableCup: 0.05,
};

/** Electricity drawn per square metre of floor area per hour of occupancy. */
export const VENUE_KWH_PER_SQM_HOUR = 0.05;

/** Grid intensity for UK electricity, kg CO2e per kWh. */
export const GRID_INTENSITY_KG_PER_KWH = 0.207;

/**
 * Ceiling on how much a perfect waste diversion programme can reduce the
 * materials component. Recycling avoids disposal and some virgin production,
 * but never the whole embodied footprint of the item.
 */
export const MAX_DIVERSION_REDUCTION = 0.35;

/** Upper bound of kg CO2e per attendee for each grade. */
export const GRADE_THRESHOLDS_KG_PER_ATTENDEE: ReadonlyArray<{
  grade: SustainabilityGrade;
  maxPerAttendee: number;
}> = [
  { grade: "A", maxPerAttendee: 2 },
  { grade: "B", maxPerAttendee: 5 },
  { grade: "C", maxPerAttendee: 10 },
  { grade: "D", maxPerAttendee: 20 },
  { grade: "E", maxPerAttendee: 40 },
  { grade: "F", maxPerAttendee: Number.POSITIVE_INFINITY },
];

export interface TravelLeg {
  mode: TravelMode;
  /** Number of attendees travelling this way. */
  attendees: number;
  /** One-way distance in kilometres. */
  averageDistanceKm: number;
  /** Whether attendees make the journey in both directions. Defaults to true. */
  roundTrip?: boolean;
}

export interface CateringLine {
  mealType: MealType;
  servings: number;
}

export interface MaterialLine {
  materialType: MaterialType;
  units: number;
}

export interface VenueProfile {
  floorAreaSqm: number;
  durationHours: number;
  /** Set when the venue runs on a certified renewable tariff. */
  renewableEnergy?: boolean;
}

export interface WasteProfile {
  recyclingProvided: boolean;
  compostProvided: boolean;
  /** Share of waste actually diverted from landfill, 0 to 1. */
  measuredDiversionRate?: number;
}

export interface SustainabilityInput {
  eventId: string;
  expectedAttendees: number;
  travel: TravelLeg[];
  catering: CateringLine[];
  materials: MaterialLine[];
  venue?: VenueProfile;
  waste?: WasteProfile;
}

export interface EmissionBreakdown {
  travelKg: number;
  cateringKg: number;
  materialsKg: number;
  venueKg: number;
}

export interface Recommendation {
  category: "travel" | "catering" | "materials" | "venue";
  message: string;
  /** Estimated kg CO2e saved if the recommendation is adopted. */
  estimatedSavingKg: number;
}

export interface SustainabilityScorecard {
  eventId: string;
  totalKg: number;
  perAttendeeKg: number;
  grade: SustainabilityGrade;
  breakdown: EmissionBreakdown;
  /** Share of the total contributed by each category, summing to 1. */
  contributions: Record<keyof EmissionBreakdown, number>;
  largestContributor: keyof EmissionBreakdown;
  recommendations: Recommendation[];
}

/** Rounds to three decimal places to keep floating point noise out of stored results. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function isPositive(value: number | undefined): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * Total travel emissions across every declared leg. Legs default to round trip
 * because the overwhelming majority of attendees go home afterwards.
 */
export function calculateTravelEmissions(legs: TravelLeg[]): number {
  let total = 0;

  for (const leg of legs) {
    if (!isPositive(leg.attendees) || !isPositive(leg.averageDistanceKm)) continue;

    const factor = TRAVEL_FACTORS_KG_PER_KM[leg.mode];
    if (factor === undefined) continue;

    const multiplier = leg.roundTrip === false ? 1 : 2;
    total += factor * leg.averageDistanceKm * leg.attendees * multiplier;
  }

  return round(total);
}

/** Total catering emissions across every meal line. */
export function calculateCateringEmissions(lines: CateringLine[]): number {
  let total = 0;

  for (const line of lines) {
    if (!isPositive(line.servings)) continue;

    const factor = CATERING_FACTORS_KG_PER_SERVING[line.mealType];
    if (factor === undefined) continue;

    total += factor * line.servings;
  }

  return round(total);
}

/**
 * Effective reduction applied to the materials component, driven by the waste
 * streams offered and, when the organiser has measured it, the real diversion
 * rate. Offering bins without measuring anything earns a conservative default.
 */
export function calculateDiversionReduction(waste?: WasteProfile): number {
  if (!waste) return 0;

  if (isPositive(waste.measuredDiversionRate)) {
    const clamped = Math.min(waste.measuredDiversionRate!, 1);
    return round(clamped * MAX_DIVERSION_REDUCTION);
  }

  let assumedRate = 0;
  if (waste.recyclingProvided) assumedRate += 0.4;
  if (waste.compostProvided) assumedRate += 0.2;

  return round(Math.min(assumedRate, 1) * MAX_DIVERSION_REDUCTION);
}

/** Materials emissions after the waste diversion reduction has been applied. */
export function calculateMaterialEmissions(lines: MaterialLine[], waste?: WasteProfile): number {
  let gross = 0;

  for (const line of lines) {
    if (!isPositive(line.units)) continue;

    const factor = MATERIAL_FACTORS_KG_PER_UNIT[line.materialType];
    if (factor === undefined) continue;

    gross += factor * line.units;
  }

  const reduction = calculateDiversionReduction(waste);
  return round(gross * (1 - reduction));
}

/**
 * Venue energy emissions. A certified renewable tariff zeroes the grid
 * component rather than merely discounting it.
 */
export function calculateVenueEmissions(venue?: VenueProfile): number {
  if (!venue) return 0;
  if (venue.renewableEnergy) return 0;
  if (!isPositive(venue.floorAreaSqm) || !isPositive(venue.durationHours)) return 0;

  const kwh = venue.floorAreaSqm * venue.durationHours * VENUE_KWH_PER_SQM_HOUR;
  return round(kwh * GRID_INTENSITY_KG_PER_KWH);
}

/** Maps a per-attendee figure onto the A-F scale. */
export function gradeForPerAttendee(perAttendeeKg: number): SustainabilityGrade {
  for (const threshold of GRADE_THRESHOLDS_KG_PER_ATTENDEE) {
    if (perAttendeeKg <= threshold.maxPerAttendee) return threshold.grade;
  }
  return "F";
}

/**
 * Builds the ranked reduction list. Every entry quantifies a saving against
 * this specific event so the scorecard drives a decision rather than just
 * reporting a number.
 */
export function buildRecommendations(
  input: SustainabilityInput,
  breakdown: EmissionBreakdown,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Catering: swapping the highest-impact protein is almost always the single
  // biggest lever available to an organiser.
  const beefLine = input.catering.find((line) => line.mealType === "beef" && line.servings > 0);
  if (beefLine) {
    const saving =
      (CATERING_FACTORS_KG_PER_SERVING.beef - CATERING_FACTORS_KG_PER_SERVING.chicken) *
      beefLine.servings;
    recommendations.push({
      category: "catering",
      message: `Switch the ${beefLine.servings} beef servings to chicken to save roughly ${round(saving)} kg CO2e.`,
      estimatedSavingKg: round(saving),
    });
  }

  // Travel: shifting solo car journeys into shared cars.
  const carLeg = input.travel.find((leg) => leg.mode === "car" && leg.attendees > 0);
  if (carLeg) {
    const multiplier = carLeg.roundTrip === false ? 1 : 2;
    const saving =
      (TRAVEL_FACTORS_KG_PER_KM.car - TRAVEL_FACTORS_KG_PER_KM.carpool) *
      carLeg.averageDistanceKm *
      carLeg.attendees *
      multiplier;
    recommendations.push({
      category: "travel",
      message: `Promote carpooling for the ${carLeg.attendees} attendees driving in to save roughly ${round(saving)} kg CO2e.`,
      estimatedSavingKg: round(saving),
    });
  }

  // Materials: single-use giveaways are pure avoidable footprint.
  const giveaway = input.materials.find(
    (line) => (line.materialType === "tshirt" || line.materialType === "toteBag") && line.units > 0,
  );
  if (giveaway) {
    const saving =
      MATERIAL_FACTORS_KG_PER_UNIT[giveaway.materialType] *
      giveaway.units *
      (1 - calculateDiversionReduction(input.waste));
    recommendations.push({
      category: "materials",
      message: `Make the ${giveaway.units} ${giveaway.materialType} giveaways opt-in rather than automatic to save up to ${round(saving)} kg CO2e.`,
      estimatedSavingKg: round(saving),
    });
  }

  // Waste: offering the streams at all is the cheapest available win.
  if (breakdown.materialsKg > 0 && !input.waste?.recyclingProvided) {
    const saving = breakdown.materialsKg * 0.4 * MAX_DIVERSION_REDUCTION;
    recommendations.push({
      category: "materials",
      message: `Provide clearly signed recycling points to save roughly ${round(saving)} kg CO2e.`,
      estimatedSavingKg: round(saving),
    });
  }

  // Venue: a renewable tariff removes the energy component outright.
  if (breakdown.venueKg > 0) {
    recommendations.push({
      category: "venue",
      message: `Book a venue on a certified renewable tariff to remove ${round(breakdown.venueKg)} kg CO2e.`,
      estimatedSavingKg: round(breakdown.venueKg),
    });
  }

  return recommendations.sort((a, b) => b.estimatedSavingKg - a.estimatedSavingKg);
}

/**
 * Produces the full scorecard for an event. Grading is done on emissions per
 * attendee; the absolute total is reported alongside for union-level reporting.
 */
export function generateScorecard(input: SustainabilityInput): SustainabilityScorecard {
  const breakdown: EmissionBreakdown = {
    travelKg: calculateTravelEmissions(input.travel ?? []),
    cateringKg: calculateCateringEmissions(input.catering ?? []),
    materialsKg: calculateMaterialEmissions(input.materials ?? [], input.waste),
    venueKg: calculateVenueEmissions(input.venue),
  };

  const totalKg = round(
    breakdown.travelKg + breakdown.cateringKg + breakdown.materialsKg + breakdown.venueKg,
  );

  const attendees = isPositive(input.expectedAttendees) ? input.expectedAttendees : 1;
  const perAttendeeKg = round(totalKg / attendees);

  const contributions = {
    travelKg: totalKg > 0 ? round(breakdown.travelKg / totalKg) : 0,
    cateringKg: totalKg > 0 ? round(breakdown.cateringKg / totalKg) : 0,
    materialsKg: totalKg > 0 ? round(breakdown.materialsKg / totalKg) : 0,
    venueKg: totalKg > 0 ? round(breakdown.venueKg / totalKg) : 0,
  } as Record<keyof EmissionBreakdown, number>;

  const largestContributor = (Object.keys(breakdown) as Array<keyof EmissionBreakdown>).reduce(
    (best, key) => (breakdown[key] > breakdown[best] ? key : best),
    "travelKg" as keyof EmissionBreakdown,
  );

  return {
    eventId: input.eventId,
    totalKg,
    perAttendeeKg,
    grade: gradeForPerAttendee(perAttendeeKg),
    breakdown,
    contributions,
    largestContributor,
    recommendations: buildRecommendations(input, breakdown),
  };
}

/**
 * Aggregates several scorecards into a club-level rollup for end-of-semester
 * reporting. Grading the rollup uses the same per-attendee scale so a club
 * cannot improve its grade simply by running fewer, larger events.
 */
export function summariseScorecards(scorecards: SustainabilityScorecard[]): {
  eventCount: number;
  totalKg: number;
  averagePerAttendeeKg: number;
  grade: SustainabilityGrade;
} {
  if (scorecards.length === 0) {
    return { eventCount: 0, totalKg: 0, averagePerAttendeeKg: 0, grade: "A" };
  }

  const totalKg = round(scorecards.reduce((sum, card) => sum + card.totalKg, 0));
  const averagePerAttendeeKg = round(
    scorecards.reduce((sum, card) => sum + card.perAttendeeKg, 0) / scorecards.length,
  );

  return {
    eventCount: scorecards.length,
    totalKg,
    averagePerAttendeeKg,
    grade: gradeForPerAttendee(averagePerAttendeeKg),
  };
}
