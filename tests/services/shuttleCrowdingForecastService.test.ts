/**
 * Test suite: Campus Shuttle Crowding Forecast & Surge Dispatch (#4386)
 * File: tests/services/shuttleCrowdingForecastService.test.ts
 *
 * Every assertion pins an explicit evaluation time. The service never reads the
 * wall clock, so these cases are stable regardless of when CI happens to run.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  ShuttleCrowdingForecastService,
  BUCKET_MINUTES,
  OBSERVED_SATURATION_SAMPLES,
  type ShuttleStop,
  type EventLetOut,
} from "../../src/services/shuttleCrowdingForecastService";

const VENUE_AUDITORIUM = "venue-auditorium";
const VENUE_QUAD = "venue-quad";

/** Fixed reference point so bucket boundaries are predictable. */
const LET_OUT = new Date("2026-09-18T21:00:00.000Z");

function attendees(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

function northGate(overrides: Partial<ShuttleStop> = {}): ShuttleStop {
  return {
    stopCode: "STOP-NORTH-GATE",
    name: "North Gate",
    walkMinutesByVenue: { [VENUE_AUDITORIUM]: 5, [VENUE_QUAD]: 12 },
    scheduledHeadwayMinutes: 20,
    seatsPerVehicle: 40,
    ...overrides,
  };
}

function festLetOut(overrides: Partial<EventLetOut> = {}): EventLetOut {
  return {
    eventId: "event-fest",
    venueId: VENUE_AUDITORIUM,
    endsAt: LET_OUT,
    confirmedAttendeeIds: attendees("student", 600),
    shuttleModeShare: 0.5,
    ...overrides,
  };
}

describe("ShuttleCrowdingForecastService (#4386)", () => {
  let service: ShuttleCrowdingForecastService;

  beforeEach(() => {
    service = new ShuttleCrowdingForecastService();
  });

  describe("stop registration", () => {
    test("registers and reads back a stop", () => {
      service.registerStop(northGate());
      expect(service.getStop("STOP-NORTH-GATE")?.name).toBe("North Gate");
      expect(service.listStops()).toHaveLength(1);
    });

    test("rejects a stop with a non-positive headway", () => {
      expect(() => service.registerStop(northGate({ scheduledHeadwayMinutes: 0 }))).toThrow(
        /positive scheduled headway/i,
      );
    });

    test("rejects a stop that seats nobody", () => {
      expect(() => service.registerStop(northGate({ seatsPerVehicle: 0 }))).toThrow(
        /at least one rider/i,
      );
    });

    test("rejects a blank stop code", () => {
      expect(() => service.registerStop(northGate({ stopCode: "   " }))).toThrow(
        /non-empty stop code/i,
      );
    });

    test("stores a defensive copy of the venue walk map", () => {
      const stop = northGate();
      service.registerStop(stop);
      stop.walkMinutesByVenue[VENUE_AUDITORIUM] = 99;
      expect(service.getStop("STOP-NORTH-GATE")?.walkMinutesByVenue[VENUE_AUDITORIUM]).toBe(5);
    });
  });

  describe("let-out registration", () => {
    test("rejects a mode share outside 0..1", () => {
      expect(() => service.registerLetOut(festLetOut({ shuttleModeShare: 1.4 }))).toThrow(
        /between 0 and 1/i,
      );
    });

    test("rejects a let-out with no event id", () => {
      expect(() => service.registerLetOut(festLetOut({ eventId: "" }))).toThrow(/event id/i);
    });
  });

  describe("seat supply", () => {
    test("scales the vehicle capacity down to one bucket", () => {
      // 40 seats every 20 minutes is 20 seats per 10-minute bucket.
      const stop = northGate();
      expect(service.seatSupplyPerBucket(stop)).toBe(20);
    });

    test("a tighter headway supplies more seats per bucket", () => {
      const frequent = northGate({ scheduledHeadwayMinutes: 5 });
      expect(service.seatSupplyPerBucket(frequent)).toBe(80);
    });
  });

  describe("arrival curve", () => {
    test("distributes the full rider count across buckets", () => {
      const stop = northGate();
      const curve = service.buildArrivalCurve(festLetOut(), stop, 300);
      const total = Array.from(curve.values()).reduce((sum, value) => sum + value, 0);
      expect(total).toBeCloseTo(300, 5);
    });

    test("a distant stop peaks later than a nearby one", () => {
      const stop = northGate();
      const nearCurve = service.buildArrivalCurve(
        festLetOut({ venueId: VENUE_AUDITORIUM }),
        stop,
        300,
      );
      const farCurve = service.buildArrivalCurve(
        festLetOut({ eventId: "event-quad", venueId: VENUE_QUAD }),
        stop,
        300,
      );

      // Compare the mass centroid rather than the single busiest bucket: a
      // seven-minute walk difference can leave both peaks inside the same
      // 10-minute bucket while the curve as a whole has clearly moved later.
      const centroidOf = (curve: Map<number, number>): number => {
        const entries = Array.from(curve.entries());
        const mass = entries.reduce((sum, [, value]) => sum + value, 0);
        return entries.reduce((sum, [key, value]) => sum + key * value, 0) / mass;
      };

      expect(centroidOf(farCurve)).toBeGreaterThan(centroidOf(nearCurve));
    });

    test("returns an empty curve when the stop does not serve the venue", () => {
      const stop = northGate({ walkMinutesByVenue: { [VENUE_QUAD]: 12 } });
      const curve = service.buildArrivalCurve(festLetOut(), stop, 300);
      expect(curve.size).toBe(0);
    });

    test("returns an empty curve for a let-out with no riders", () => {
      const curve = service.buildArrivalCurve(festLetOut(), northGate(), 0);
      expect(curve.size).toBe(0);
    });

    test("a wider dispersal window flattens the peak", () => {
      const stop = northGate();
      const tight = service.buildArrivalCurve(festLetOut({ dispersalMinutes: 10 }), stop, 300);
      const wide = service.buildArrivalCurve(festLetOut({ dispersalMinutes: 40 }), stop, 300);

      const peakValue = (curve: Map<number, number>): number => Math.max(...curve.values());
      expect(peakValue(wide)).toBeLessThan(peakValue(tight));
    });
  });

  describe("attendee de-duplication", () => {
    test("counts a student who confirmed two concurrent events only once", () => {
      const stop = northGate();
      service.registerStop(stop);

      const shared = attendees("shared", 100);
      service.registerLetOut(
        festLetOut({ eventId: "event-a", confirmedAttendeeIds: shared, shuttleModeShare: 1 }),
      );
      service.registerLetOut(
        festLetOut({
          eventId: "event-b",
          endsAt: new Date(LET_OUT.getTime() + 60_000),
          confirmedAttendeeIds: shared,
          shuttleModeShare: 1,
        }),
      );

      const riders = service.resolveRidersByLetOut(stop);
      expect(riders.get("event-a")).toBe(100);
      // Every attendee was already claimed by the earlier-ending event.
      expect(riders.get("event-b")).toBe(0);
    });

    test("the earlier-ending event claims a shared attendee", () => {
      const stop = northGate();
      service.registerStop(stop);

      service.registerLetOut(
        festLetOut({
          eventId: "event-late",
          endsAt: new Date(LET_OUT.getTime() + 30 * 60_000),
          confirmedAttendeeIds: ["s1", "s2"],
          shuttleModeShare: 1,
        }),
      );
      service.registerLetOut(
        festLetOut({
          eventId: "event-early",
          endsAt: LET_OUT,
          confirmedAttendeeIds: ["s1"],
          shuttleModeShare: 1,
        }),
      );

      const riders = service.resolveRidersByLetOut(stop);
      expect(riders.get("event-early")).toBe(1);
      expect(riders.get("event-late")).toBe(1);
    });

    test("ignores let-outs at venues the stop does not serve", () => {
      const stop = northGate({ walkMinutesByVenue: { [VENUE_AUDITORIUM]: 5 } });
      service.registerStop(stop);
      service.registerLetOut(festLetOut({ eventId: "event-quad", venueId: VENUE_QUAD }));

      expect(service.resolveRidersByLetOut(stop).has("event-quad")).toBe(false);
    });

    test("applies the campus default mode share when a let-out omits one", () => {
      const withDefault = new ShuttleCrowdingForecastService({ defaultShuttleModeShare: 0.25 });
      const stop = northGate();
      withDefault.registerStop(stop);
      withDefault.registerLetOut({
        eventId: "event-default",
        venueId: VENUE_AUDITORIUM,
        endsAt: LET_OUT,
        confirmedAttendeeIds: attendees("d", 80),
      });

      expect(withDefault.resolveRidersByLetOut(stop).get("event-default")).toBe(20);
    });
  });

  describe("boarding telemetry", () => {
    beforeEach(() => {
      service.registerStop(northGate());
    });

    test("rejects a snapshot for an unknown stop", () => {
      expect(() =>
        service.recordBoardingSnapshot({
          stopCode: "STOP-GHOST",
          observedAt: LET_OUT,
          observedBoardings: 5,
          observedQueueLength: 0,
        }),
      ).toThrow(/unknown stop/i);
    });

    test("rejects negative counts", () => {
      expect(() =>
        service.recordBoardingSnapshot({
          stopCode: "STOP-NORTH-GATE",
          observedAt: LET_OUT,
          observedBoardings: -1,
          observedQueueLength: 0,
        }),
      ).toThrow(/negative counts/i);
    });

    test("keeps snapshots ordered by observation time", () => {
      service.recordBoardingSnapshot({
        stopCode: "STOP-NORTH-GATE",
        observedAt: new Date(LET_OUT.getTime() + 10 * 60_000),
        observedBoardings: 8,
        observedQueueLength: 2,
      });
      service.recordBoardingSnapshot({
        stopCode: "STOP-NORTH-GATE",
        observedAt: LET_OUT,
        observedBoardings: 3,
        observedQueueLength: 0,
      });

      const stored = service.getSnapshots("STOP-NORTH-GATE");
      expect(stored[0].observedBoardings).toBe(3);
      expect(stored[1].observedBoardings).toBe(8);
    });
  });

  describe("prior versus observed blending", () => {
    beforeEach(() => {
      service.registerStop(northGate());
    });

    test("weight is zero before any telemetry arrives", () => {
      expect(service.observedWeight("STOP-NORTH-GATE", LET_OUT)).toBe(0);
      expect(service.observedArrivalsPerBucket("STOP-NORTH-GATE", LET_OUT)).toBeNull();
    });

    test("weight climbs with the snapshot count and saturates at one", () => {
      for (let index = 0; index < OBSERVED_SATURATION_SAMPLES + 2; index += 1) {
        service.recordBoardingSnapshot({
          stopCode: "STOP-NORTH-GATE",
          observedAt: new Date(LET_OUT.getTime() + index * 2 * 60_000),
          observedBoardings: 10,
          observedQueueLength: 4,
        });

        const weight = service.observedWeight(
          "STOP-NORTH-GATE",
          new Date(LET_OUT.getTime() + index * 2 * 60_000),
        );
        expect(weight).toBeGreaterThan(0);
        expect(weight).toBeLessThanOrEqual(1);
      }

      const finalWeight = service.observedWeight(
        "STOP-NORTH-GATE",
        new Date(LET_OUT.getTime() + 60 * 60_000),
      );
      expect(finalWeight).toBe(1);
    });

    test("ignores snapshots recorded after the evaluation time", () => {
      service.recordBoardingSnapshot({
        stopCode: "STOP-NORTH-GATE",
        observedAt: new Date(LET_OUT.getTime() + 30 * 60_000),
        observedBoardings: 40,
        observedQueueLength: 10,
      });

      expect(service.observedWeight("STOP-NORTH-GATE", LET_OUT)).toBe(0);
    });

    test("a single reading is treated as one bucket of demand", () => {
      service.recordBoardingSnapshot({
        stopCode: "STOP-NORTH-GATE",
        observedAt: LET_OUT,
        observedBoardings: 12,
        observedQueueLength: 7,
      });

      expect(service.observedArrivalsPerBucket("STOP-NORTH-GATE", LET_OUT)).toBe(19);
    });

    test("converts a multi-snapshot boarding rate into a per-bucket figure", () => {
      // 20 boardings over 10 minutes, with 5 still queueing.
      service.recordBoardingSnapshot({
        stopCode: "STOP-NORTH-GATE",
        observedAt: LET_OUT,
        observedBoardings: 0,
        observedQueueLength: 0,
      });
      service.recordBoardingSnapshot({
        stopCode: "STOP-NORTH-GATE",
        observedAt: new Date(LET_OUT.getTime() + 5 * 60_000),
        observedBoardings: 10,
        observedQueueLength: 3,
      });
      service.recordBoardingSnapshot({
        stopCode: "STOP-NORTH-GATE",
        observedAt: new Date(LET_OUT.getTime() + 10 * 60_000),
        observedBoardings: 10,
        observedQueueLength: 5,
      });

      const perBucket = service.observedArrivalsPerBucket(
        "STOP-NORTH-GATE",
        new Date(LET_OUT.getTime() + 10 * 60_000),
      );
      // 20 boardings / 10 minutes = 2 per minute => 20 per bucket, plus a queue of 5.
      expect(perBucket).toBe(25);
    });
  });

  describe("classification", () => {
    test.each([
      [0.2, "NOMINAL"],
      [0.74, "NOMINAL"],
      [0.75, "ELEVATED"],
      [0.99, "ELEVATED"],
      [1.0, "SATURATED"],
      [1.49, "SATURATED"],
      [1.5, "OVERFLOW"],
      [3.2, "OVERFLOW"],
    ])("a saturation of %s classifies as %s", (ratio, expected) => {
      expect(service.classify(ratio as number)).toBe(expected);
    });
  });

  describe("stop forecast", () => {
    beforeEach(() => {
      service.registerStop(northGate());
    });

    test("throws for an unknown stop", () => {
      expect(() => service.forecastStop("STOP-GHOST", LET_OUT)).toThrow(/unknown shuttle stop/i);
    });

    test("a large fest overwhelms a 20-minute headway", () => {
      service.registerLetOut(festLetOut());
      const forecast = service.forecastStop("STOP-NORTH-GATE", LET_OUT);

      expect(forecast.buckets.length).toBeGreaterThan(0);
      expect(forecast.peakBucket).not.toBeNull();
      expect(forecast.peakBucket?.classification).toBe("OVERFLOW");
      expect(forecast.recommendation).not.toBeNull();
      expect(forecast.recommendation?.extraVehiclesRequired).toBeGreaterThan(0);
    });

    test("a small workshop stays nominal and raises nothing", () => {
      service.registerLetOut(
        festLetOut({ confirmedAttendeeIds: attendees("small", 12), shuttleModeShare: 0.5 }),
      );
      const forecast = service.forecastStop("STOP-NORTH-GATE", LET_OUT);

      expect(forecast.peakBucket?.classification).toBe("NOMINAL");
      expect(forecast.recommendation).toBeNull();
      expect(forecast.suppressedByCooldown).toBe(false);
    });

    test("bucket boundaries are exactly one bucket apart", () => {
      service.registerLetOut(festLetOut());
      const [first] = service.forecastStop("STOP-NORTH-GATE", LET_OUT).buckets;

      expect(first.bucketEnd.getTime() - first.bucketStart.getTime()).toBe(BUCKET_MINUTES * 60_000);
    });

    test("unseated riders are the overflow above seat supply", () => {
      service.registerLetOut(festLetOut());
      const forecast = service.forecastStop("STOP-NORTH-GATE", LET_OUT);

      for (const bucket of forecast.buckets) {
        expect(bucket.unseatedRiders).toBe(
          Math.max(0, bucket.predictedArrivals - bucket.seatSupply),
        );
      }
    });

    test("telemetry showing an early exodus pulls the forecast up", () => {
      service.registerLetOut(
        festLetOut({ confirmedAttendeeIds: attendees("mid", 60), shuttleModeShare: 0.5 }),
      );
      const priorOnly = service.forecastStop("STOP-NORTH-GATE", LET_OUT);

      for (let index = 0; index < OBSERVED_SATURATION_SAMPLES; index += 1) {
        service.recordBoardingSnapshot({
          stopCode: "STOP-NORTH-GATE",
          observedAt: new Date(LET_OUT.getTime() + index * 5 * 60_000),
          observedBoardings: 60,
          observedQueueLength: 30,
        });
      }

      const blended = service.forecastStop(
        "STOP-NORTH-GATE",
        new Date(LET_OUT.getTime() + 10 * 60_000),
      );

      expect(blended.observedWeight).toBe(1);
      const priorPeak = priorOnly.peakBucket?.predictedArrivals ?? 0;
      const blendedPeak = blended.peakBucket?.predictedArrivals ?? 0;
      expect(blendedPeak).toBeGreaterThan(priorPeak);
    });

    test("forecastAllStops orders the worst stop first", () => {
      service.registerStop(
        northGate({
          stopCode: "STOP-SOUTH-LOT",
          name: "South Lot",
          scheduledHeadwayMinutes: 5,
          seatsPerVehicle: 60,
        }),
      );
      service.registerLetOut(festLetOut());

      const all = service.forecastAllStops(LET_OUT);
      expect(all).toHaveLength(2);
      expect(all[0].stopCode).toBe("STOP-NORTH-GATE");
    });
  });

  describe("surge recommendation cooldown", () => {
    beforeEach(() => {
      service.registerStop(northGate());
      service.registerLetOut(festLetOut());
    });

    test("a repeat evaluation inside the cooldown is suppressed", () => {
      const first = service.forecastStop("STOP-NORTH-GATE", LET_OUT);
      expect(first.recommendation).not.toBeNull();

      const second = service.forecastStop(
        "STOP-NORTH-GATE",
        new Date(LET_OUT.getTime() + 5 * 60_000),
      );
      expect(second.recommendation).toBeNull();
      expect(second.suppressedByCooldown).toBe(true);
    });

    test("a recommendation is raised again once the cooldown lapses", () => {
      service.forecastStop("STOP-NORTH-GATE", LET_OUT);

      const later = service.forecastStop(
        "STOP-NORTH-GATE",
        new Date(LET_OUT.getTime() + 25 * 60_000),
      );
      expect(later.recommendation).not.toBeNull();
      expect(later.suppressedByCooldown).toBe(false);
    });

    test("acknowledging a stop clears its cooldown immediately", () => {
      service.forecastStop("STOP-NORTH-GATE", LET_OUT);
      service.acknowledgeRecommendation("STOP-NORTH-GATE");

      const next = service.forecastStop("STOP-NORTH-GATE", new Date(LET_OUT.getTime() + 60_000));
      expect(next.recommendation).not.toBeNull();
    });

    test("the message names the stop, the peak and the vehicle count", () => {
      const forecast = service.forecastStop("STOP-NORTH-GATE", LET_OUT);
      const message = forecast.recommendation?.message ?? "";

      expect(message).toContain("North Gate");
      expect(message).toMatch(/\d+% of scheduled seat supply/);
      expect(message).toMatch(/dispatch \d+ additional vehicle\(s\)/);
    });

    test("a configurable cooldown is honoured", () => {
      const brief = new ShuttleCrowdingForecastService({ cooldownMinutes: 2 });
      brief.registerStop(northGate());
      brief.registerLetOut(festLetOut());

      brief.forecastStop("STOP-NORTH-GATE", LET_OUT);
      const soon = brief.forecastStop("STOP-NORTH-GATE", new Date(LET_OUT.getTime() + 3 * 60_000));
      expect(soon.recommendation).not.toBeNull();
    });
  });
});
