import { describe, expect, it } from "vitest";
import {
  findClosestForecast,
  formatWeatherAlertMessage,
  getIndoorBackupVenueUrl,
  getSevereWeatherAlert,
  isWithinMonitorWindow,
} from "./weatherRescheduling";

describe("weather rescheduling helpers", () => {
  it("alerts for heavy rain at or above the 60% threshold", () => {
    const alert = getSevereWeatherAlert({
      forecastTime: "2026-10-15T12:00:00Z",
      condition: "Thunderstorm",
      precipitationProbability: 0.6,
      temperatureC: 22,
    });

    expect(alert?.kind).toBe("heavy_rain");
  });

  it("alerts for snow and extreme heat, but not light rain", () => {
    expect(
      getSevereWeatherAlert({
        forecastTime: "2026-10-15T12:00:00Z",
        condition: "Snow",
        precipitationProbability: 0.8,
        temperatureC: -2,
      })?.kind,
    ).toBe("snow");
    expect(
      getSevereWeatherAlert({
        forecastTime: "2026-10-15T12:00:00Z",
        condition: "Clear",
        precipitationProbability: 0,
        temperatureC: 35,
      })?.kind,
    ).toBe("extreme_heat");
    expect(
      getSevereWeatherAlert({
        forecastTime: "2026-10-15T12:00:00Z",
        condition: "Rain",
        precipitationProbability: 0.59,
        temperatureC: 22,
      }),
    ).toBeNull();
  });

  it("selects the forecast point closest to the event time", () => {
    const closest = findClosestForecast(
      [
        { forecastTime: "2026-10-15T09:00:00Z", marker: "earlier" },
        { forecastTime: "2026-10-15T12:00:00Z", marker: "closest" },
        { forecastTime: "2026-10-15T15:00:00Z", marker: "later" },
      ],
      "2026-10-15T12:30:00Z",
    );

    expect(closest?.marker).toBe("closest");
  });

  it("limits monitoring to the next 72 hours and creates a filtered backup link", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    expect(isWithinMonitorWindow("2026-10-18T00:00:00Z", now)).toBe(true);
    expect(isWithinMonitorWindow("2026-10-18T00:00:01Z", now)).toBe(false);

    const link = getIndoorBackupVenueUrl("event-1", "2026-10-16T12:00:00Z", "2026-10-16T15:00:00Z");
    expect(link).toContain("action=find-indoor-backup");
    expect(link).toContain("outdoor=false");
    expect(link).toContain("starts_at=2026-10-16T12%3A00%3A00Z");
    expect(link).toContain("ends_at=2026-10-16T15%3A00%3A00Z");
  });

  it("includes the one-click backup action in the organizer alert copy", () => {
    const message = formatWeatherAlertMessage(
      "Campus Picnic",
      {
        kind: "heavy_rain",
        label: "heavy rain or thunderstorms",
        forecast: {
          forecastTime: "2026-10-16T12:00:00Z",
          condition: "Rain",
          precipitationProbability: 0.75,
          temperatureC: 20,
        },
      },
      "/events/event-1?action=find-indoor-backup",
    );

    expect(message).toContain("Campus Picnic");
    expect(message).toContain("75% precipitation probability");
    expect(message).toContain("find-indoor-backup");
  });
});
