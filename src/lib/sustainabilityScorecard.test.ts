import { describe, it, expect } from "vitest";
import {
  calculateTravelEmissions,
  calculateCateringEmissions,
  calculateDiversionReduction,
  calculateMaterialEmissions,
  calculateVenueEmissions,
  gradeForPerAttendee,
  buildRecommendations,
  generateScorecard,
  summariseScorecards,
  MAX_DIVERSION_REDUCTION,
  type SustainabilityInput,
} from "./sustainabilityScorecard";

describe("Event Sustainability Scorecard (#3134)", () => {
  describe("travel emissions", () => {
    it("doubles the distance for round trips by default", () => {
      // 0.171 kg/km * 20 km * 10 attendees * 2 directions
      expect(
        calculateTravelEmissions([{ mode: "car", attendees: 10, averageDistanceKm: 20 }]),
      ).toBe(68.4);
    });

    it("counts a single direction when the leg is explicitly one way", () => {
      expect(
        calculateTravelEmissions([
          { mode: "car", attendees: 10, averageDistanceKm: 20, roundTrip: false },
        ]),
      ).toBe(34.2);
    });

    it("treats walking and cycling as zero emission", () => {
      expect(
        calculateTravelEmissions([
          { mode: "walk", attendees: 200, averageDistanceKm: 3 },
          { mode: "cycle", attendees: 50, averageDistanceKm: 8 },
        ]),
      ).toBe(0);
    });

    it("sums every declared leg", () => {
      const total = calculateTravelEmissions([
        { mode: "bus", attendees: 50, averageDistanceKm: 10 },
        { mode: "car", attendees: 10, averageDistanceKm: 20 },
      ]);
      expect(total).toBe(102 + 68.4);
    });

    it("ignores legs with missing or non-positive figures", () => {
      expect(
        calculateTravelEmissions([
          { mode: "car", attendees: 0, averageDistanceKm: 40 },
          { mode: "car", attendees: 10, averageDistanceKm: 0 },
        ]),
      ).toBe(0);
    });
  });

  describe("catering emissions", () => {
    it("prices each meal type against its own factor", () => {
      expect(calculateCateringEmissions([{ mealType: "beef", servings: 10 }])).toBe(155);
      expect(calculateCateringEmissions([{ mealType: "vegan", servings: 10 }])).toBe(7);
    });

    it("shows beef as an order of magnitude worse than vegan per serving", () => {
      const beef = calculateCateringEmissions([{ mealType: "beef", servings: 100 }]);
      const vegan = calculateCateringEmissions([{ mealType: "vegan", servings: 100 }]);
      expect(beef / vegan).toBeGreaterThan(20);
    });
  });

  describe("waste diversion", () => {
    it("returns no reduction when no waste profile is supplied", () => {
      expect(calculateDiversionReduction(undefined)).toBe(0);
    });

    it("assumes a conservative rate from the streams offered", () => {
      expect(
        calculateDiversionReduction({ recyclingProvided: true, compostProvided: false }),
      ).toBeCloseTo(0.4 * MAX_DIVERSION_REDUCTION, 5);

      expect(
        calculateDiversionReduction({ recyclingProvided: true, compostProvided: true }),
      ).toBeCloseTo(0.6 * MAX_DIVERSION_REDUCTION, 5);
    });

    it("prefers a measured diversion rate over the assumed one", () => {
      expect(
        calculateDiversionReduction({
          recyclingProvided: true,
          compostProvided: true,
          measuredDiversionRate: 0.5,
        }),
      ).toBeCloseTo(0.5 * MAX_DIVERSION_REDUCTION, 5);
    });

    it("never exceeds the ceiling even on a perfect diversion rate", () => {
      expect(
        calculateDiversionReduction({
          recyclingProvided: true,
          compostProvided: true,
          measuredDiversionRate: 1,
        }),
      ).toBe(MAX_DIVERSION_REDUCTION);
    });
  });

  describe("material emissions", () => {
    it("applies the full embodied footprint when nothing is diverted", () => {
      expect(calculateMaterialEmissions([{ materialType: "tshirt", units: 10 }])).toBe(75);
    });

    it("discounts the footprint by the diversion reduction", () => {
      const withDiversion = calculateMaterialEmissions([{ materialType: "tshirt", units: 10 }], {
        recyclingProvided: true,
        compostProvided: true,
      });
      expect(withDiversion).toBeCloseTo(75 * (1 - 0.6 * MAX_DIVERSION_REDUCTION), 3);
    });
  });

  describe("venue emissions", () => {
    it("derives grid emissions from floor area and duration", () => {
      // 200 sqm * 4 h * 0.05 kWh = 40 kWh, at 0.207 kg/kWh
      expect(calculateVenueEmissions({ floorAreaSqm: 200, durationHours: 4 })).toBe(8.28);
    });

    it("zeroes the component on a certified renewable tariff", () => {
      expect(
        calculateVenueEmissions({ floorAreaSqm: 200, durationHours: 4, renewableEnergy: true }),
      ).toBe(0);
    });

    it("returns zero when no venue is declared", () => {
      expect(calculateVenueEmissions(undefined)).toBe(0);
    });
  });

  describe("grading", () => {
    it("maps per-attendee emissions onto the A-F scale", () => {
      expect(gradeForPerAttendee(1.5)).toBe("A");
      expect(gradeForPerAttendee(2)).toBe("A");
      expect(gradeForPerAttendee(2.1)).toBe("B");
      expect(gradeForPerAttendee(9)).toBe("C");
      expect(gradeForPerAttendee(15)).toBe("D");
      expect(gradeForPerAttendee(30)).toBe("E");
      expect(gradeForPerAttendee(120)).toBe("F");
    });

    it("does not punish a large event purely for being large", () => {
      const small = generateScorecard({
        eventId: "evt_small",
        expectedAttendees: 20,
        travel: [{ mode: "car", attendees: 20, averageDistanceKm: 30 }],
        catering: [{ mealType: "beef", servings: 20 }],
        materials: [],
      });

      const large = generateScorecard({
        eventId: "evt_large",
        expectedAttendees: 1000,
        travel: [{ mode: "walk", attendees: 1000, averageDistanceKm: 2 }],
        catering: [{ mealType: "vegan", servings: 1000 }],
        materials: [],
      });

      expect(large.totalKg).toBeGreaterThan(0);
      expect(large.perAttendeeKg).toBeLessThan(small.perAttendeeKg);
      expect(large.grade).toBe("A");
    });
  });

  describe("recommendations", () => {
    const heavyEvent: SustainabilityInput = {
      eventId: "evt_gala",
      expectedAttendees: 100,
      travel: [{ mode: "car", attendees: 40, averageDistanceKm: 25 }],
      catering: [{ mealType: "beef", servings: 100 }],
      materials: [{ materialType: "tshirt", units: 100 }],
      venue: { floorAreaSqm: 400, durationHours: 5 },
    };

    it("ranks reductions by the size of the saving", () => {
      const card = generateScorecard(heavyEvent);
      const savings = card.recommendations.map((r) => r.estimatedSavingKg);
      const sorted = [...savings].sort((a, b) => b - a);
      expect(savings).toEqual(sorted);
      expect(card.recommendations.length).toBeGreaterThan(2);
    });

    it("quantifies the beef to chicken swap against this event's own numbers", () => {
      const card = generateScorecard(heavyEvent);
      const catering = card.recommendations.find((r) => r.category === "catering");
      // (15.5 - 2.9) * 100 servings
      expect(catering?.estimatedSavingKg).toBe(1260);
      expect(catering?.message).toContain("100 beef servings");
    });

    it("suggests recycling only when the organiser is not already providing it", () => {
      const withoutRecycling = buildRecommendations(
        heavyEvent,
        generateScorecard(heavyEvent).breakdown,
      );
      expect(withoutRecycling.some((r) => r.message.includes("recycling"))).toBe(true);

      const withRecycling: SustainabilityInput = {
        ...heavyEvent,
        waste: { recyclingProvided: true, compostProvided: true },
      };
      const card = generateScorecard(withRecycling);
      expect(card.recommendations.some((r) => r.message.includes("recycling"))).toBe(false);
    });
  });

  describe("full scorecard", () => {
    it("reports a breakdown whose parts sum to the total", () => {
      const card = generateScorecard({
        eventId: "evt_1",
        expectedAttendees: 100,
        travel: [{ mode: "bus", attendees: 50, averageDistanceKm: 10 }],
        catering: [{ mealType: "vegetarian", servings: 100 }],
        materials: [{ materialType: "poster", units: 20 }],
        venue: { floorAreaSqm: 200, durationHours: 4 },
      });

      const { travelKg, cateringKg, materialsKg, venueKg } = card.breakdown;
      expect(travelKg + cateringKg + materialsKg + venueKg).toBeCloseTo(card.totalKg, 3);
      expect(card.perAttendeeKg).toBeCloseTo(card.totalKg / 100, 3);
    });

    it("identifies the largest contributing category", () => {
      const card = generateScorecard({
        eventId: "evt_2",
        expectedAttendees: 50,
        travel: [{ mode: "walk", attendees: 50, averageDistanceKm: 1 }],
        catering: [{ mealType: "beef", servings: 50 }],
        materials: [{ materialType: "printedPage", units: 100 }],
      });

      expect(card.largestContributor).toBe("cateringKg");
      expect(card.contributions.cateringKg).toBeGreaterThan(0.9);
    });

    it("handles an event with no declared inputs without dividing by zero", () => {
      const card = generateScorecard({
        eventId: "evt_empty",
        expectedAttendees: 0,
        travel: [],
        catering: [],
        materials: [],
      });

      expect(card.totalKg).toBe(0);
      expect(card.perAttendeeKg).toBe(0);
      expect(card.grade).toBe("A");
      expect(Object.values(card.contributions).every((v) => v === 0)).toBe(true);
    });
  });

  describe("club rollup", () => {
    it("returns an empty summary for a club with no scored events", () => {
      expect(summariseScorecards([])).toEqual({
        eventCount: 0,
        totalKg: 0,
        averagePerAttendeeKg: 0,
        grade: "A",
      });
    });

    it("grades the rollup on the average per-attendee figure", () => {
      const clean = generateScorecard({
        eventId: "evt_a",
        expectedAttendees: 100,
        travel: [{ mode: "walk", attendees: 100, averageDistanceKm: 2 }],
        catering: [{ mealType: "vegan", servings: 100 }],
        materials: [],
      });

      const dirty = generateScorecard({
        eventId: "evt_b",
        expectedAttendees: 100,
        travel: [{ mode: "flight", attendees: 100, averageDistanceKm: 800 }],
        catering: [{ mealType: "beef", servings: 100 }],
        materials: [],
      });

      const summary = summariseScorecards([clean, dirty]);
      expect(summary.eventCount).toBe(2);
      expect(summary.totalKg).toBeCloseTo(clean.totalKg + dirty.totalKg, 2);
      expect(summary.averagePerAttendeeKg).toBeCloseTo(
        (clean.perAttendeeKg + dirty.perAttendeeKg) / 2,
        2,
      );
      expect(summary.grade).toBe("F");
    });
  });
});
