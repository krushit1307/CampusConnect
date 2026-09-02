// src/lib/dietaryForecast.test.ts
// -----------------------------------------------------------------------------
// Unit tests for src/lib/dietaryForecast.ts (Issue #3931).
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  getForecastForTag,
  totalForecastedMeals,
  isHighConfidence,
  confidenceLabel,
  confidenceColor,
  sortByForecastMeals,
  topTags,
  type DietaryForecast,
} from "./dietaryForecast";

function makeForecast(overrides: Partial<DietaryForecast> = {}): DietaryForecast {
  return {
    ok: true,
    event_id: "event-1",
    event_title: "Hackathon Banquet",
    venue_capacity: 500,
    total_rsvps: 100,
    current_weight: 1.0,
    historical_weight: 0.0,
    current_breakdown: [],
    historical_breakdown: [],
    blended_forecast: [
      { tag: "vegan", current_percentage: 15, historical_percentage: 18, blended_percentage: 15, current_count: 15, historical_event_count: 5, forecast_meals: 75 },
      { tag: "vegetarian", current_percentage: 20, historical_percentage: 22, blended_percentage: 20, current_count: 20, historical_event_count: 5, forecast_meals: 100 },
      { tag: "none", current_percentage: 60, historical_percentage: 55, blended_percentage: 60, current_count: 60, historical_event_count: 5, forecast_meals: 300 },
    ],
    summary: "Based on current trends, expect to need 300 none meals, 100 vegetarian meals, 75 vegan meals. Give this number to your caterer.",
    ...overrides,
  };
}

describe("getForecastForTag", () => {
  it("returns the entry for a tag that exists", () => {
    const entry = getForecastForTag(makeForecast(), "vegan");
    expect(entry).not.toBeNull();
    expect(entry!.forecast_meals).toBe(75);
  });

  it("returns null for a tag that doesn't exist", () => {
    expect(getForecastForTag(makeForecast(), "gluten-free")).toBeNull();
  });
});

describe("totalForecastedMeals", () => {
  it("sums all forecast_meals entries", () => {
    expect(totalForecastedMeals(makeForecast())).toBe(75 + 100 + 300);
  });

  it("returns 0 for an empty forecast", () => {
    expect(totalForecastedMeals(makeForecast({ blended_forecast: [] }))).toBe(0);
  });
});

describe("isHighConfidence", () => {
  it("returns true when current_weight >= 0.6", () => {
    expect(isHighConfidence(makeForecast({ current_weight: 0.6 }))).toBe(true);
    expect(isHighConfidence(makeForecast({ current_weight: 0.8 }))).toBe(true);
    expect(isHighConfidence(makeForecast({ current_weight: 1.0 }))).toBe(true);
  });

  it("returns false when current_weight < 0.6", () => {
    expect(isHighConfidence(makeForecast({ current_weight: 0.5 }))).toBe(false);
    expect(isHighConfidence(makeForecast({ current_weight: 0.0 }))).toBe(false);
  });
});

describe("confidenceLabel", () => {
  it("returns 'High' for current_weight >= 0.8", () => {
    expect(confidenceLabel(makeForecast({ current_weight: 0.8 }))).toBe("High");
    expect(confidenceLabel(makeForecast({ current_weight: 1.0 }))).toBe("High");
  });

  it("returns 'Medium' for 0.4 <= current_weight < 0.8", () => {
    expect(confidenceLabel(makeForecast({ current_weight: 0.4 }))).toBe("Medium");
    expect(confidenceLabel(makeForecast({ current_weight: 0.6 }))).toBe("Medium");
    expect(confidenceLabel(makeForecast({ current_weight: 0.79 }))).toBe("Medium");
  });

  it("returns 'Low' for current_weight < 0.4", () => {
    expect(confidenceLabel(makeForecast({ current_weight: 0.0 }))).toBe("Low");
    expect(confidenceLabel(makeForecast({ current_weight: 0.3 }))).toBe("Low");
    expect(confidenceLabel(makeForecast({ current_weight: 0.39 }))).toBe("Low");
  });
});

describe("confidenceColor", () => {
  it("returns a green class for High confidence", () => {
    expect(confidenceColor(makeForecast({ current_weight: 0.9 }))).toContain("green");
  });

  it("returns an amber class for Medium confidence", () => {
    expect(confidenceColor(makeForecast({ current_weight: 0.5 }))).toContain("amber");
  });

  it("returns a red class for Low confidence", () => {
    expect(confidenceColor(makeForecast({ current_weight: 0.1 }))).toContain("red");
  });
});

describe("sortByForecastMeals", () => {
  it("sorts descending by forecast_meals", () => {
    const entries = makeForecast().blended_forecast;
    const sorted = sortByForecastMeals(entries);
    expect(sorted[0].forecast_meals).toBeGreaterThanOrEqual(sorted[1].forecast_meals);
    expect(sorted[1].forecast_meals).toBeGreaterThanOrEqual(sorted[2].forecast_meals);
  });

  it("does not mutate the original array", () => {
    const entries = makeForecast().blended_forecast;
    const originalFirst = entries[0];
    sortByForecastMeals(entries);
    expect(entries[0]).toBe(originalFirst);
  });
});

describe("topTags", () => {
  it("excludes the 'none' tag", () => {
    const tags = topTags(makeForecast(), 10);
    expect(tags.find((e) => e.tag === "none")).toBeUndefined();
  });

  it("returns at most topN entries", () => {
    expect(topTags(makeForecast(), 1)).toHaveLength(1);
  });

  it("returns entries sorted by forecast_meals descending", () => {
    const tags = topTags(makeForecast(), 10);
    expect(tags[0].forecast_meals).toBeGreaterThanOrEqual(tags[1].forecast_meals);
  });

  it("returns an empty array when blended_forecast is empty", () => {
    expect(topTags(makeForecast({ blended_forecast: [] }), 5)).toEqual([]);
  });
});
