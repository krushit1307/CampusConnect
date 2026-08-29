import { describe, expect, it } from "vitest";
import {
  isSearchableLocationQuery,
  isValidLocationCoordinates,
  normalizeLocationQuery,
} from "./locationAutocomplete";

describe("location autocomplete helpers", () => {
  it("normalizes whitespace and limits query length", () => {
    expect(normalizeLocationQuery("  Student   Union  ")).toBe("Student Union");
    expect(normalizeLocationQuery("x".repeat(250))).toHaveLength(200);
  });

  it("requires a useful query and excludes virtual events", () => {
    expect(isSearchableLocationQuery("Stu")).toBe(true);
    expect(isSearchableLocationQuery("  ")).toBe(false);
    expect(isSearchableLocationQuery("Online")).toBe(false);
  });

  it("accepts only valid latitude and longitude ranges", () => {
    expect(isValidLocationCoordinates(0, 0)).toBe(true);
    expect(isValidLocationCoordinates(90, 180)).toBe(true);
    expect(isValidLocationCoordinates(-90, -180)).toBe(true);
    expect(isValidLocationCoordinates(91, 0)).toBe(false);
    expect(isValidLocationCoordinates(0, 181)).toBe(false);
    expect(isValidLocationCoordinates(Number.NaN, 0)).toBe(false);
  });
});
