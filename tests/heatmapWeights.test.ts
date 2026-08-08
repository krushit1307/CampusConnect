import { describe, it, expect } from "vitest";
import { normalizeWeight } from "../src/utils/normalizeWeight";

describe("normalizeWeight", () => {
  it("returns 0.0 for 0 or negative RSVPs", () => {
    expect(normalizeWeight(0)).toBe(0);
    expect(normalizeWeight(-5)).toBe(0);
  });

  it("returns 0.1 for exactly 10 RSVPs", () => {
    expect(normalizeWeight(10)).toBe(0.1);
  });

  it("returns linearly interpolated values below 10 RSVPs", () => {
    expect(normalizeWeight(5)).toBe(0.05);
  });

  it("returns 0.3 for 50 RSVPs", () => {
    expect(normalizeWeight(50)).toBe(0.3);
  });

  it("returns 0.5 for 100 RSVPs", () => {
    expect(normalizeWeight(100)).toBe(0.5);
  });

  it("returns 0.8 for 250 RSVPs", () => {
    expect(normalizeWeight(250)).toBe(0.8);
  });

  it("caps at 1.0 for 500+ RSVPs", () => {
    expect(normalizeWeight(500)).toBe(1.0);
    expect(normalizeWeight(1000)).toBe(1.0);
  });
});
