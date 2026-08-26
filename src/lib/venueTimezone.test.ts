// src/lib/venueTimezone.test.ts
import { describe, it, expect } from "vitest";
import {
  inferTimezoneFromCoords,
  resolveVenueTimezone,
  shouldShowDualClock,
  venueTimezoneLabel,
  venueTzAbbreviation,
  type TimezoneAwareEvent,
} from "./venueTimezone";

describe("inferTimezoneFromCoords", () => {
  it("returns Europe/London for the London campus coords", () => {
    expect(inferTimezoneFromCoords(51.5074, -0.1278)).toBe("Europe/London");
  });

  it("returns America/New_York for the NYC campus coords", () => {
    expect(inferTimezoneFromCoords(40.7128, -74.006)).toBe("America/New_York");
  });

  it("matches within the 50 km tolerance (Brooklyn → New York)", () => {
    expect(inferTimezoneFromCoords(40.6782, -73.9442)).toBe("America/New_York");
  });

  it("returns null when no known campus is within 50 km", () => {
    expect(inferTimezoneFromCoords(0, -160)).toBeNull();
  });

  it("returns null for null / undefined inputs", () => {
    expect(inferTimezoneFromCoords(null, null)).toBeNull();
    expect(inferTimezoneFromCoords(undefined, undefined)).toBeNull();
  });

  it("returns null for NaN inputs", () => {
    expect(inferTimezoneFromCoords(Number.NaN, 0)).toBeNull();
    expect(inferTimezoneFromCoords(0, Number.NaN)).toBeNull();
  });
});

describe("resolveVenueTimezone", () => {
  it("prefers event.venue_timezone when present", () => {
    const event: TimezoneAwareEvent = {
      venue_timezone: "Asia/Tokyo",
      latitude: 51.5074,
      longitude: -0.1278,
      venues: { timezone: "Europe/London" },
    };
    expect(resolveVenueTimezone(event)).toBe("Asia/Tokyo");
  });

  it("falls back to venues[0].timezone when joined as an array", () => {
    const event: TimezoneAwareEvent = {
      latitude: 51.5074,
      longitude: -0.1278,
      venues: [{ timezone: "Europe/London" }],
    };
    expect(resolveVenueTimezone(event)).toBe("Europe/London");
  });

  it("falls back to venues.timezone when joined as a single object", () => {
    const event: TimezoneAwareEvent = {
      latitude: 51.5074,
      longitude: -0.1278,
      venues: { timezone: "Europe/London" },
    };
    expect(resolveVenueTimezone(event)).toBe("Europe/London");
  });

  it("falls back to GPS inference when no explicit tz", () => {
    const event: TimezoneAwareEvent = {
      latitude: 40.7128,
      longitude: -74.006,
    };
    expect(resolveVenueTimezone(event)).toBe("America/New_York");
  });

  it("returns UTC when nothing resolves", () => {
    const event: TimezoneAwareEvent = {};
    expect(resolveVenueTimezone(event)).toBe("UTC");
  });

  it("returns UTC when coords are far from any known campus", () => {
    const event: TimezoneAwareEvent = { latitude: 0, longitude: -160 };
    expect(resolveVenueTimezone(event)).toBe("UTC");
  });
});

describe("venueTimezoneLabel", () => {
  it("returns the last segment of the IANA id with spaces", () => {
    expect(venueTimezoneLabel("Europe/London")).toBe("London");
    expect(venueTimezoneLabel("America/New_York")).toBe("New York");
    expect(venueTimezoneLabel("Asia/Kolkata")).toBe("Kolkata");
  });

  it("returns the input unchanged if no slash is present", () => {
    expect(venueTimezoneLabel("UTC")).toBe("UTC");
  });

  it("returns 'UTC' for empty input", () => {
    expect(venueTimezoneLabel("")).toBe("UTC");
  });
});

describe("shouldShowDualClock", () => {
  const londonEvent: TimezoneAwareEvent = {
    start_date: "2026-08-15T17:00:00.000Z",
    venue_timezone: "Europe/London",
  };

  it("returns true when venue tz ≠ user tz at the start instant", () => {
    expect(shouldShowDualClock(londonEvent, "America/New_York")).toBe(true);
  });

  it("returns false when venue tz = user tz", () => {
    expect(shouldShowDualClock(londonEvent, "Europe/London")).toBe(false);
  });

  it("returns false when the event has no start date", () => {
    expect(shouldShowDualClock({}, "America/New_York")).toBe(false);
  });
});

describe("venueTzAbbreviation", () => {
  it("returns a non-empty abbreviation for known zones", () => {
    const event: TimezoneAwareEvent = {
      start_date: "2026-08-15T17:00:00.000Z",
      venue_timezone: "Europe/London",
    };
    const abbrev = venueTzAbbreviation(event, "2026-08-15T17:00:00.000Z");
    expect(typeof abbrev).toBe("string");
    expect(abbrev.length).toBeGreaterThan(0);
  });

  it("returns 'UTC' when the event has no venue tz and no coords", () => {
    const event: TimezoneAwareEvent = {};
    expect(venueTzAbbreviation(event, new Date())).toBe("UTC");
  });
});
