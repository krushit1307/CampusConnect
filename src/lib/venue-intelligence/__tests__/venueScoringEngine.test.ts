import { describe, it, expect } from "vitest";
import {
  scoreCapacityFit,
  scoreAmenityMatch,
  scoreUtilizationEfficiency,
  scoreSatisfaction,
  scoreCostEfficiency,
  scoreScheduleAvailability,
  scoreTrendBonus,
  computeVenueScore,
  generateVenueRecommendations,
  analyzeUtilizationTrend,
  detectBookingConflicts,
  estimateVenueCost,
  type VenueScoreInput,
  type BookingSlot,
} from "../venueScoringEngine";
import type { Venue, VenueUtilization } from "@/hooks/useVenueAnalytics";

// ─── Mock Data ────────────────────────────────────────────────────────

const MOCK_VENUE: Venue = {
  id: "V1",
  name: "Main Auditorium",
  building: "Admin Block",
  type: "auditorium",
  capacity: 800,
  status: "available",
  amenities: ["projector", "sound_system", "recording", "live_stream", "wheelchair_access"],
  hourlyRate: 0,
  rating: 4.7,
  totalBookings: 48,
  totalHours: 192,
  imageUrl: "",
};

const MOCK_UTILIZATION: VenueUtilization = {
  venueId: "V1",
  venueName: "Main Auditorium",
  type: "auditorium",
  capacity: 800,
  avgUtilization: 78,
  peakHour: "18:00",
  peakDay: "Fri",
  totalBookings: 48,
  avgAttendees: 624,
  revenue: 0,
  satisfaction: 4.7,
  trend: "up",
  weeklyData: [65, 72, 80, 85, 90, 95, 60],
  monthlyData: [
    { month: "May", hours: 40, revenue: 0 },
    { month: "Jun", hours: 36, revenue: 0 },
    { month: "Jul", hours: 20, revenue: 0 },
    { month: "Aug", hours: 48, revenue: 0 },
    { month: "Sep", hours: 52, revenue: 0 },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────

describe("scoreCapacityFit", () => {
  it("returns high score for perfect fit", () => {
    const score = scoreCapacityFit(100, 85);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("returns lower score for significantly under-utilized", () => {
    const score = scoreCapacityFit(1000, 50);
    expect(score).toBeLessThan(60);
  });

  it("penalizes over-capacity venues", () => {
    const score = scoreCapacityFit(50, 200);
    expect(score).toBeLessThan(70);
  });

  it("returns 0 for invalid inputs", () => {
    expect(scoreCapacityFit(0, 100)).toBe(0);
    expect(scoreCapacityFit(100, 0)).toBe(0);
  });
});

describe("scoreAmenityMatch", () => {
  it("returns 100 when no amenities required", () => {
    expect(scoreAmenityMatch(["projector"], [])).toBe(100);
  });

  it("returns 100 when all amenities matched", () => {
    expect(scoreAmenityMatch(["a", "b", "c"], ["a", "b", "c"])).toBe(100);
  });

  it("returns partial score for partial match", () => {
    expect(scoreAmenityMatch(["a", "b"], ["a", "b", "c"])).toBeCloseTo(66.7, 0);
  });

  it("returns 0 when no amenities match", () => {
    expect(scoreAmenityMatch(["x", "y"], ["a", "b"])).toBe(0);
  });
});

describe("scoreUtilizationEfficiency", () => {
  it("returns optimal score for healthy utilization (60-80%)", () => {
    expect(scoreUtilizationEfficiency(70)).toBe(95);
  });

  it("returns lower score for over-utilized venues", () => {
    expect(scoreUtilizationEfficiency(98)).toBe(50);
  });
});

describe("scoreSatisfaction", () => {
  it("returns 100 for perfect rating", () => {
    expect(scoreSatisfaction(5.0)).toBe(100);
  });

  it("returns 0 for zero rating", () => {
    expect(scoreSatisfaction(0)).toBe(0);
  });

  it("scales linearly", () => {
    expect(scoreSatisfaction(2.5)).toBe(50);
  });
});

describe("scoreCostEfficiency", () => {
  it("returns 100 for free venue", () => {
    expect(scoreCostEfficiency(0)).toBe(100);
    expect(scoreCostEfficiency(0, 100)).toBe(100);
  });

  it("returns 10 when over budget", () => {
    expect(scoreCostEfficiency(200, 100)).toBe(10);
  });
});

describe("scoreScheduleAvailability", () => {
  it("returns high score for low bookings", () => {
    expect(scoreScheduleAvailability(10)).toBe(95);
  });

  it("returns lower score for high bookings", () => {
    expect(scoreScheduleAvailability(90)).toBe(40);
  });
});

describe("scoreTrendBonus", () => {
  it("returns 100 for upward trend", () => {
    expect(scoreTrendBonus("up")).toBe(100);
  });

  it("returns 60 for stable trend", () => {
    expect(scoreTrendBonus("stable")).toBe(60);
  });

  it("returns 20 for downward trend", () => {
    expect(scoreTrendBonus("down")).toBe(20);
  });
});

describe("computeVenueScore", () => {
  it("computes a valid total score", () => {
    const input: VenueScoreInput = {
      venue: MOCK_VENUE,
      utilization: MOCK_UTILIZATION,
      requiredCapacity: 500,
      preferredAmenities: ["projector", "sound_system"],
      budget: 0,
    };
    const result = computeVenueScore(input);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.capacityFit).toBeGreaterThanOrEqual(0);
    expect(result.amenityMatch).toBeGreaterThanOrEqual(0);
  });
});

describe("generateVenueRecommendations", () => {
  it("returns sorted recommendations by match score", () => {
    const recs = generateVenueRecommendations([MOCK_VENUE], [MOCK_UTILIZATION], {
      requiredCapacity: 500,
      preferredAmenities: ["projector"],
    });
    expect(recs.length).toBe(1);
    expect(recs[0].breakdown.total).toBeGreaterThanOrEqual(0);
    expect(recs[0].recommendation.reasons.length).toBeGreaterThan(0);
  });

  it("excludes unavailable venues", () => {
    const unavailableVenue: Venue = { ...MOCK_VENUE, id: "V2", status: "maintenance" };
    const recs = generateVenueRecommendations([unavailableVenue], [], {
      requiredCapacity: 500,
      preferredAmenities: [],
    });
    expect(recs.length).toBe(0);
  });
});

describe("analyzeUtilizationTrend", () => {
  it("detects improving trend", () => {
    const trend = analyzeUtilizationTrend([40, 50, 60, 70, 80]);
    expect(trend.direction).toBe("improving");
    expect(trend.weeklyChange).toBeGreaterThan(0);
  });

  it("detects declining trend", () => {
    const trend = analyzeUtilizationTrend([90, 80, 70, 60, 50]);
    expect(trend.direction).toBe("declining");
    expect(trend.weeklyChange).toBeLessThan(0);
  });

  it("handles single data point", () => {
    const trend = analyzeUtilizationTrend([50]);
    expect(trend.direction).toBe("stable");
  });
});

describe("detectBookingConflicts", () => {
  it("detects overlapping bookings", () => {
    const bookings: BookingSlot[] = [
      {
        id: "1",
        venueId: "V1",
        date: "2026-09-01",
        startTime: "10:00",
        endTime: "14:00",
        eventName: "Event A",
      },
      {
        id: "2",
        venueId: "V1",
        date: "2026-09-01",
        startTime: "12:00",
        endTime: "16:00",
        eventName: "Event B",
      },
    ];
    const conflicts = detectBookingConflicts(bookings);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].overlapMinutes).toBe(120);
    expect(conflicts[0].severity).toBe("high");
  });

  it("returns empty for non-overlapping bookings", () => {
    const bookings: BookingSlot[] = [
      {
        id: "1",
        venueId: "V1",
        date: "2026-09-01",
        startTime: "10:00",
        endTime: "12:00",
        eventName: "Event A",
      },
      {
        id: "2",
        venueId: "V1",
        date: "2026-09-01",
        startTime: "12:00",
        endTime: "14:00",
        eventName: "Event B",
      },
    ];
    expect(detectBookingConflicts(bookings).length).toBe(0);
  });
});

describe("estimateVenueCost", () => {
  it("returns 0 for free venues", () => {
    const result = estimateVenueCost(MOCK_VENUE, 3);
    expect(result.subtotal).toBe(0);
    expect(result.notes.some((n) => n.includes("Free"))).toBe(true);
  });

  it("applies long-duration discount", () => {
    const paidVenue: Venue = { ...MOCK_VENUE, hourlyRate: 100 };
    const result = estimateVenueCost(paidVenue, 4);
    expect(result.subtotal).toBe(360); // 400 - 10% = 360
  });
});
