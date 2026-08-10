import { describe, expect, it } from "vitest";
import { getWeatherIcon, getWeatherAccent } from "./icons";

describe("weather icon mapping (#1915)", () => {
  it("maps every condition code to a known icon", () => {
    const codes = [
      "clear",
      "clouds",
      "rain",
      "drizzle",
      "thunderstorm",
      "snow",
      "mist",
      "unknown",
    ] as const;
    for (const code of codes) {
      const icon = getWeatherIcon(code);
      expect(icon).toBeTruthy();
      expect(typeof icon).toBe("string");
    }
  });

  it("returns CloudOff for the unknown bucket (fail-open)", () => {
    expect(getWeatherIcon("unknown")).toBe("CloudOff");
  });

  it("returns an accent class for every condition", () => {
    const codes = [
      "clear",
      "clouds",
      "rain",
      "drizzle",
      "thunderstorm",
      "snow",
      "mist",
      "unknown",
    ] as const;
    for (const code of codes) {
      expect(getWeatherAccent(code)).toMatch(/^text-/);
    }
  });
});
