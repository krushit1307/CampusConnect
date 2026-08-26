import { describe, expect, it } from "vitest";
import { formatEstimatedCount } from "./numberFormatter";

describe("numberFormatter.ts (#2448)", () => {
  it("formats counts below 1000 without estimation prefix if false", () => {
    expect(formatEstimatedCount(950, false)).toBe("950");
    expect(formatEstimatedCount(950, true)).toBe("~950");
  });

  it("formats thousands with K suffix", () => {
    expect(formatEstimatedCount(15400, true)).toBe("~15.4K");
    expect(formatEstimatedCount(15000, true)).toBe("~15K");
    expect(formatEstimatedCount(1000, false)).toBe("1K");
  });

  it("formats millions with M suffix", () => {
    expect(formatEstimatedCount(50100000, true)).toBe("~50.1M");
    expect(formatEstimatedCount(50000000, true)).toBe("~50M");
    expect(formatEstimatedCount(1000000, false)).toBe("1M");
  });
});
