import { describe, it, expect } from "vitest";
import { formatDate, formatEventDateRange } from "./utils";

describe("formatDate", () => {
  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });

  it("returns original string for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("formats a past date correctly", () => {
    const result = formatDate("2020-06-15T10:30:00");
    expect(result).toMatch(/June 15, 2020 at/);
    expect(result).toMatch(/10:30 AM/);
  });

  it("formats a future date correctly", () => {
    const result = formatDate("2030-12-25T15:00:00");
    expect(result).toMatch(/December 25, 2030 at/);
    expect(result).toMatch(/3:00 PM/);
  });

  it("formats midnight correctly", () => {
    const result = formatDate("2024-01-01T00:00:00");
    expect(result).toMatch(/January 1, 2024 at/);
    expect(result).toMatch(/12:00 AM/);
  });
});

describe("formatEventDateRange", () => {
  it("shows a same-day start and end time", () => {
    const result = formatEventDateRange({
      event_date: "2026-07-11T09:00:00Z",
      start_date: "2026-07-11T09:00:00Z",
      end_date: "2026-07-11T11:00:00Z",
    });

    expect(result).toMatch(/^July 11, 2026 at .+ – .+$/);
  });

  it("falls back to the legacy event date when no end date exists", () => {
    const result = formatEventDateRange({
      event_date: "2026-07-11T09:00:00Z",
      start_date: null,
      end_date: null,
    });

    expect(result).toMatch(/^July 11, 2026 at .+$/);
  });

  it("returns a fallback label when there is no usable date", () => {
    expect(
      formatEventDateRange({
        event_date: null,
        start_date: null,
        end_date: null,
      }),
    ).toBe("TBA");
  });
});
