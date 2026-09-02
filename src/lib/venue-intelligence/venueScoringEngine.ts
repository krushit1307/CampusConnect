/**
 * Venue Intelligence Scoring Engine
 *
 * Computes composite scores for venue suitability based on multiple weighted
 * factors: capacity fit, amenity match, utilization efficiency, historical
 * satisfaction, cost efficiency, and schedule availability.
 */

import type {
  Venue,
  VenueUtilization,
  VenueRecommendation,
  VenueType,
} from "@/hooks/useVenueAnalytics";

// ─── Weights ──────────────────────────────────────────────────────────

export const SCORING_WEIGHTS = {
  capacityFit: 0.25,
  amenityMatch: 0.2,
  utilizationEfficiency: 0.15,
  satisfaction: 0.15,
  costEfficiency: 0.1,
  scheduleAvailability: 0.1,
  trendBonus: 0.05,
} as const;

export type WeightKey = keyof typeof SCORING_WEIGHTS;

// ─── Input Types ──────────────────────────────────────────────────────

export interface VenueScoreInput {
  venue: Venue;
  utilization?: VenueUtilization;
  requiredCapacity: number;
  preferredAmenities: string[];
  budget?: number;
  preferredType?: VenueType;
  date?: string;
}

export interface VenueScoreBreakdown {
  capacityFit: number;
  amenityMatch: number;
  utilizationEfficiency: number;
  satisfaction: number;
  costEfficiency: number;
  scheduleAvailability: number;
  trendBonus: number;
  total: number;
}

export interface VenueComparisonResult {
  venueId: string;
  venueName: string;
  breakdown: VenueScoreBreakdown;
  recommendation: VenueRecommendation;
}

// ─── Scoring Functions ────────────────────────────────────────────────

/**
 * Score how well a venue's capacity fits the required attendee count.
 * Perfect fit = 100, under-capacity = scaled down, over-capacity = slight penalty.
 */
export function scoreCapacityFit(capacity: number, required: number): number {
  if (capacity <= 0 || required <= 0) return 0;
  const ratio = required / capacity;
  if (ratio <= 0.5) return 40 + ratio * 60; // under-utilized
  if (ratio <= 0.85) return 80 + (ratio - 0.5) * 133; // sweet spot
  if (ratio <= 1.0) return 95 + (1 - ratio) * 33; // nearly perfect
  // Over-capacity: slight penalty
  return Math.max(30, 95 - (ratio - 1.0) * 100);
}

/**
 * Score amenity overlap between what's required and what's available.
 */
export function scoreAmenityMatch(available: string[], required: string[]): number {
  if (required.length === 0) return 100;
  const availableSet = new Set(available.map((a) => a.toLowerCase()));
  const matched = required.filter((r) => availableSet.has(r.toLowerCase()));
  return Math.round((matched.length / required.length) * 100);
}

/**
 * Score utilization efficiency — venues that aren't over-utilized get higher
 * scores since they're more likely to be available and well-maintained.
 */
export function scoreUtilizationEfficiency(avgUtilization: number): number {
  if (avgUtilization < 30) return 60; // under-used, might have issues
  if (avgUtilization < 60) return 85; // healthy
  if (avgUtilization < 80) return 95; // optimal
  if (avgUtilization < 95) return 75; // heavily used, availability risk
  return 50; // almost always booked
}

/**
 * Score based on user satisfaction rating (1–5 scale).
 */
export function scoreSatisfaction(rating: number): number {
  return Math.min(100, Math.round((rating / 5.0) * 100));
}

/**
 * Score cost efficiency — lower rate = higher score. Free venues get 100.
 */
export function scoreCostEfficiency(hourlyRate: number, budget?: number): number {
  if (hourlyRate === 0) return 100;
  if (budget === undefined || budget <= 0) return Math.max(20, 100 - hourlyRate * 0.3);
  if (hourlyRate > budget) return 10;
  return Math.round(100 - (hourlyRate / budget) * 60);
}

/**
 * Score schedule availability based on booking density.
 * More bookings = lower availability score.
 */
export function scoreScheduleAvailability(totalBookings: number): number {
  if (totalBookings < 20) return 95;
  if (totalBookings < 40) return 85;
  if (totalBookings < 60) return 70;
  if (totalBookings < 80) return 55;
  return 40;
}

/**
 * Score trend bonus — venues trending upward get a small boost.
 */
export function scoreTrendBonus(trend: "up" | "down" | "stable"): number {
  switch (trend) {
    case "up":
      return 100;
    case "stable":
      return 60;
    case "down":
      return 20;
  }
}

/**
 * Compute the full score breakdown for a single venue.
 */
export function computeVenueScore(input: VenueScoreInput): VenueScoreBreakdown {
  const util = input.utilization;
  const capacityFit = scoreCapacityFit(input.venue.capacity, input.requiredCapacity);
  const amenityMatch = scoreAmenityMatch(input.venue.amenities, input.preferredAmenities);
  const utilizationEfficiency = util ? scoreUtilizationEfficiency(util.avgUtilization) : 50;
  const satisfaction = scoreSatisfaction(input.venue.rating);
  const costEfficiency = scoreCostEfficiency(input.venue.hourlyRate, input.budget);
  const scheduleAvailability = scoreScheduleAvailability(input.venue.totalBookings);
  const trendBonus = util ? scoreTrendBonus(util.trend) : 50;

  const total = Math.round(
    capacityFit * SCORING_WEIGHTS.capacityFit +
      amenityMatch * SCORING_WEIGHTS.amenityMatch +
      utilizationEfficiency * SCORING_WEIGHTS.utilizationEfficiency +
      satisfaction * SCORING_WEIGHTS.satisfaction +
      costEfficiency * SCORING_WEIGHTS.costEfficiency +
      scheduleAvailability * SCORING_WEIGHTS.scheduleAvailability +
      trendBonus * SCORING_WEIGHTS.trendBonus,
  );

  return {
    capacityFit,
    amenityMatch,
    utilizationEfficiency,
    satisfaction,
    costEfficiency,
    scheduleAvailability,
    trendBonus,
    total: Math.min(100, Math.max(0, total)),
  };
}

// ─── Recommendation Generation ────────────────────────────────────────

function generateRecommendationReasons(
  input: VenueScoreInput,
  breakdown: VenueScoreBreakdown,
): string[] {
  const reasons: string[] = [];

  if (breakdown.capacityFit >= 90) {
    reasons.push(`Excellent capacity fit for ${input.requiredCapacity} attendees`);
  } else if (breakdown.capacityFit >= 70) {
    reasons.push(`Good capacity (${input.venue.capacity} seats) for your event size`);
  }

  if (breakdown.amenityMatch >= 80) {
    reasons.push("Has all your required amenities");
  } else if (breakdown.amenityMatch >= 50) {
    reasons.push("Matches some of your amenity requirements");
  }

  if (input.venue.hourlyRate === 0) {
    reasons.push("Free venue — no rental cost");
  } else if (breakdown.costEfficiency >= 80) {
    reasons.push("Cost-effective option within budget");
  }

  if (input.utilization) {
    if (input.utilization.trend === "up") {
      reasons.push("Popularity trending upward — well-regarded venue");
    }
    if (input.utilization.satisfaction >= 4.5) {
      reasons.push(`High satisfaction rating (${input.utilization.satisfaction}/5)`);
    }
  }

  if (breakdown.satisfaction >= 90) {
    reasons.push(`Top-rated venue (${input.venue.rating}/5 stars)`);
  }

  if (reasons.length === 0) {
    reasons.push("Meets basic requirements for your event");
  }

  return reasons;
}

/**
 * Score a list of venues and return sorted recommendations.
 */
export function generateVenueRecommendations(
  venues: Venue[],
  utilization: VenueUtilization[],
  params: {
    requiredCapacity: number;
    preferredAmenities: string[];
    budget?: number;
    preferredType?: VenueType;
    limit?: number;
  },
): VenueComparisonResult[] {
  const utilMap = new Map(utilization.map((u) => [u.venueId, u]));

  const scored = venues
    .filter((v) => v.status === "available" || v.status === "reserved")
    .map((venue) => {
      const input: VenueScoreInput = {
        venue,
        utilization: utilMap.get(venue.id),
        requiredCapacity: params.requiredCapacity,
        preferredAmenities: params.preferredAmenities,
        budget: params.budget,
        preferredType: params.preferredType,
      };

      const breakdown = computeVenueScore(input);
      const rec: VenueRecommendation = {
        venueId: venue.id,
        venueName: venue.name,
        matchScore: breakdown.total,
        reasons: generateRecommendationReasons(input, breakdown),
        estimatedCost: venue.hourlyRate * 3, // assume 3-hour event
        estimatedCapacity: venue.capacity,
      };

      return { venueId: venue.id, venueName: venue.name, breakdown, recommendation: rec };
    });

  scored.sort((a, b) => b.breakdown.total - a.breakdown.total);

  return scored.slice(0, params.limit ?? scored.length);
}

// ─── Utilization Trend Analysis ───────────────────────────────────────

export interface TrendAnalysis {
  direction: "improving" | "declining" | "stable";
  weeklyChange: number;
  projectedNextWeek: number;
  insight: string;
}

/**
 * Analyze weekly utilization data and project the next period.
 */
export function analyzeUtilizationTrend(weeklyData: number[]): TrendAnalysis {
  if (weeklyData.length < 2) {
    return {
      direction: "stable",
      weeklyChange: 0,
      projectedNextWeek: weeklyData[0] ?? 50,
      insight: "Insufficient data for trend analysis",
    };
  }

  const recent = weeklyData.slice(-3);
  const older = weeklyData.slice(0, Math.max(1, weeklyData.length - 3));

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const weeklyChange = Math.round(recentAvg - olderAvg);

  const trendSlope =
    weeklyData.length >= 3
      ? (weeklyData[weeklyData.length - 1] - weeklyData[weeklyData.length - 3]) / 2
      : weeklyChange;

  const projectedNextWeek = Math.min(100, Math.max(0, Math.round(recentAvg + trendSlope)));

  let direction: TrendAnalysis["direction"];
  let insight: string;

  if (weeklyChange > 5) {
    direction = "improving";
    insight = `Venue utilization is climbing (+${weeklyChange}% recent). Consider extending available hours.`;
  } else if (weeklyChange < -5) {
    direction = "declining";
    insight = `Utilization is dropping (${weeklyChange}% recent). Consider promotional pricing or targeted outreach.`;
  } else {
    direction = "stable";
    insight = "Utilization is holding steady. No immediate action needed.";
  }

  return { direction, weeklyChange, projectedNextWeek, insight };
}

// ─── Conflict Detection ───────────────────────────────────────────────

export interface BookingSlot {
  id: string;
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  eventName: string;
}

export interface DetectedConflict {
  booking1: BookingSlot;
  booking2: BookingSlot;
  overlapMinutes: number;
  severity: "high" | "medium" | "low";
}

/**
 * Detect time conflicts between bookings for the same venue on the same day.
 */
export function detectBookingConflicts(bookings: BookingSlot[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const byVenueAndDate = new Map<string, BookingSlot[]>();

  for (const b of bookings) {
    const key = `${b.venueId}|${b.date}`;
    const existing = byVenueAndDate.get(key) || [];
    existing.push(b);
    byVenueAndDate.set(key, existing);
  }

  for (const [, slots] of byVenueAndDate) {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];

        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);

        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        const overlapMinutes = Math.max(0, overlapEnd - overlapStart);

        if (overlapMinutes > 0) {
          let severity: DetectedConflict["severity"];
          if (overlapMinutes >= 120) severity = "high";
          else if (overlapMinutes >= 30) severity = "medium";
          else severity = "low";

          conflicts.push({
            booking1: a,
            booking2: b,
            overlapMinutes,
            severity,
          });
        }
      }
    }
  }

  conflicts.sort((a, b) => b.overlapMinutes - a.overlapMinutes);
  return conflicts;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// ─── Cost Estimation ──────────────────────────────────────────────────

export interface CostEstimate {
  venueId: string;
  venueName: string;
  hourlyRate: number;
  estimatedHours: number;
  subtotal: number;
  notes: string[];
}

/**
 * Estimate total cost for booking a venue for a given duration.
 */
export function estimateVenueCost(venue: Venue, estimatedHours: number): CostEstimate {
  const notes: string[] = [];
  let subtotal = venue.hourlyRate * estimatedHours;

  if (venue.hourlyRate === 0) {
    notes.push("Free venue — no rental fees apply");
  } else {
    notes.push(`Base rate: $${venue.hourlyRate}/hour × ${estimatedHours}h = $${subtotal}`);
    if (estimatedHours >= 4) {
      const discount = Math.round(subtotal * 0.1);
      subtotal -= discount;
      notes.push(`Long-duration discount (10%): -$${discount}`);
    }
  }

  return {
    venueId: venue.id,
    venueName: venue.name,
    hourlyRate: venue.hourlyRate,
    estimatedHours,
    subtotal,
    notes,
  };
}
