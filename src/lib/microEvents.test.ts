import { describe, expect, it } from "vitest";
import {
  formatMicroEventTimeRemaining,
  isValidMicroEventCapacity,
  isValidMicroEventCourseCode,
  isValidMicroEventLocation,
  normalizeCourseCode,
} from "./microEvents";

describe("micro-event helpers", () => {
  it("normalizes course codes for matching", () => {
    expect(normalizeCourseCode("  calc   101 ")).toBe("CALC 101");
  });

  it("accepts only intimate session capacities", () => {
    expect(isValidMicroEventCapacity(2)).toBe(true);
    expect(isValidMicroEventCapacity(6)).toBe(true);
    expect(isValidMicroEventCapacity(1)).toBe(false);
    expect(isValidMicroEventCapacity(7)).toBe(false);
    expect(isValidMicroEventCapacity(3.5)).toBe(false);
  });

  it("validates compact course and location inputs", () => {
    expect(isValidMicroEventCourseCode("BIO 201")).toBe(true);
    expect(isValidMicroEventCourseCode("A")).toBe(false);
    expect(isValidMicroEventLocation("Library Room 4")).toBe(true);
    expect(isValidMicroEventLocation(" ")).toBe(false);
  });

  it("shows an expiry countdown and expired state", () => {
    const now = Date.parse("2026-08-17T12:00:00.000Z");
    expect(formatMicroEventTimeRemaining("2026-08-17T16:30:00.000Z", now)).toBe("4h 30m left");
    expect(formatMicroEventTimeRemaining("2026-08-17T11:59:00.000Z", now)).toBe("Expired");
  });
});
