import { describe, expect, it } from "vitest";
import { maxTrafficCount, trafficCellKey, trafficIntensity } from "./eventTraffic";

describe("event traffic helpers", () => {
  it("creates stable category and hour lookup keys", () => {
    expect(trafficCellKey("Tech", 14)).toBe("Tech-14");
  });

  it("finds the highest traffic count", () => {
    expect(
      maxTrafficCount([
        { category_name: "Tech", hour_of_day: 10, traffic_count: 3, unique_viewers: 2 },
        { category_name: "Arts", hour_of_day: 15, traffic_count: 11, unique_viewers: 8 },
      ]),
    ).toBe(11);
    expect(maxTrafficCount([])).toBe(0);
  });

  it("normalizes traffic intensity between zero and one", () => {
    expect(trafficIntensity(0, 10)).toBe(0);
    expect(trafficIntensity(5, 10)).toBe(0.5);
    expect(trafficIntensity(20, 10)).toBe(1);
    expect(trafficIntensity(5, 0)).toBe(0);
  });
});
