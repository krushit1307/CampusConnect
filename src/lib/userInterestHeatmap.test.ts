import { describe, it, expect } from "vitest";
import {
  calculateInterestDistribution,
  getInterestHeatmapTagCloudScale,
  getInterestBadgeColor,
} from "./userInterestHeatmap";

describe("User Profile Interest Heatmap Utility (#3546)", () => {
  const sampleAttendedTags = [
    "Tech",
    "Tech",
    "Tech",
    "Tech", // 4 / 10 = 40%
    "Art",
    "Art",
    "Art", // 3 / 10 = 30%
    "Sports",
    "Sports",
    "Sports", // 3 / 10 = 30%
  ];

  it("calculates frequency distribution percentages from attended tags", () => {
    const result = calculateInterestDistribution(sampleAttendedTags, false, 5);

    expect(result.isPrivate).toBe(false);
    expect(result.totalAttendedEvents).toBe(5);
    expect(result.distribution).toHaveLength(3);

    const tech = result.distribution.find((d) => d.tag === "Tech");
    const art = result.distribution.find((d) => d.tag === "Art");
    const sports = result.distribution.find((d) => d.tag === "Sports");

    expect(tech?.percentage).toBe(40);
    expect(art?.percentage).toBe(30);
    expect(sports?.percentage).toBe(30);
  });

  it("scales tag cloud font size based on percentage frequency", () => {
    expect(getInterestHeatmapTagCloudScale(40)).toContain("text-xl");
    expect(getInterestHeatmapTagCloudScale(25)).toContain("text-base");
    expect(getInterestHeatmapTagCloudScale(15)).toContain("text-xs");
    expect(getInterestHeatmapTagCloudScale(5)).toContain("text-[11px]");
  });

  it("respects privacy setting by returning empty distribution when isPrivate is true", () => {
    const privateResult = calculateInterestDistribution(sampleAttendedTags, true, 5);

    expect(privateResult.isPrivate).toBe(true);
    expect(privateResult.distribution).toHaveLength(0);
  });

  it("assigns appropriate categorical colors to interest tags", () => {
    const techColor = getInterestBadgeColor("React & AI");
    const artColor = getInterestBadgeColor("Music Concert");
    const sportColor = getInterestBadgeColor("Sports Tournament");

    expect(techColor.bgClass).toContain("indigo");
    expect(artColor.bgClass).toContain("fuchsia");
    expect(sportColor.bgClass).toContain("emerald");
  });
});
