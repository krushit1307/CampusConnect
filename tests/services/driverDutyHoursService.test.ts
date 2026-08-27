/**
 * Test suite: Minibus Driver Duty Hours (#4705)
 * File: tests/services/driverDutyHoursService.test.ts
 *
 * The case the whole module exists for is the one where a trip is lawful in
 * isolation and unlawful because of the trip before it, so almost every case
 * below builds a history first and then proposes against it. The split-break
 * pair is deliberately identical in total minutes and differs only in order.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  DriverDutyHoursService,
  DEFAULT_DUTY_RULES,
  type DutySegment,
  type ProposedSegment,
} from "../../src/services/driverDutyHoursService";

const DRIVER = "driver-priya";
const CODRIVER = "driver-tom";

/** Saturday. The away fixture is on this day and the field trip the next. */
const BASE = new Date("2027-03-06T00:00:00.000Z");
const DAY = 86_400_000;

function t(dayOffset: number, hour: number, minute = 0): Date {
  return new Date(BASE.getTime() + dayOffset * DAY + hour * 3_600_000 + minute * 60_000);
}

function segment(
  segmentId: string,
  kind: DutySegment["kind"],
  from: Date,
  to: Date,
  driverId = DRIVER,
): DutySegment {
  return { segmentId, driverId, kind, from, to, tripId: "trip-1" };
}

function drive(from: Date, to: Date): ProposedSegment {
  return { kind: "DRIVING", from, to };
}

/**
 * A lawful nine-and-a-half hour driving day: 4h, break, 4h, break, 1h30.
 * Long enough to need an extension, broken properly so nothing else fires.
 */
function extendedDay(service: DriverDutyHoursService, dayOffset: number, prefix: string): void {
  service.recordSegment(segment(`${prefix}-a`, "DRIVING", t(dayOffset, 8), t(dayOffset, 12)));
  service.recordSegment(
    segment(`${prefix}-b`, "DRIVING", t(dayOffset, 12, 45), t(dayOffset, 16, 45)),
  );
  service.recordSegment(segment(`${prefix}-c`, "DRIVING", t(dayOffset, 17, 30), t(dayOffset, 19)));
}

function extendedDayProposal(dayOffset: number): ProposedSegment[] {
  return [
    drive(t(dayOffset, 8), t(dayOffset, 12)),
    drive(t(dayOffset, 12, 45), t(dayOffset, 16, 45)),
    drive(t(dayOffset, 17, 30), t(dayOffset, 19)),
  ];
}

function entitled(service: DriverDutyHoursService, driverId = DRIVER): void {
  service.registerEntitlement({
    driverId,
    category: "D1",
    validFrom: t(-400, 0),
    validUntil: t(400, 0),
  });
}

/** The away fixture: drive out, run the fixture, drive back, home at one. */
function saturdayFixture(service: DriverDutyHoursService): void {
  service.recordSegment(segment("sat-out", "DRIVING", t(0, 10), t(0, 13)));
  service.recordSegment(segment("sat-ground", "OTHER_DUTY", t(0, 14), t(0, 21)));
  service.recordSegment(segment("sat-back", "DRIVING", t(0, 22), t(1, 1)));
}

describe("DriverDutyHoursService (#4705)", () => {
  let service: DriverDutyHoursService;

  beforeEach(() => {
    service = new DriverDutyHoursService();
    entitled(service);
    entitled(service, CODRIVER);
  });

  describe("configuration", () => {
    test("refuses rules that invert the split break", () => {
      expect(
        () =>
          new DriverDutyHoursService({ splitBreakFirstMinutes: 30, splitBreakSecondMinutes: 15 }),
      ).toThrow(/shorter part first/i);
    });

    test("refuses a reduced rest longer than the full one", () => {
      expect(() => new DriverDutyHoursService({ reducedDailyRestMinutes: 900 })).toThrow(
        /cannot be longer/i,
      );
    });

    test("refuses an extended driving day shorter than the ordinary one", () => {
      expect(() => new DriverDutyHoursService({ extendedDailyDrivingMinutes: 300 })).toThrow(
        /cannot be shorter/i,
      );
    });

    test("the defaults are the ones the rules are written against", () => {
      expect(DEFAULT_DUTY_RULES.maxContinuousDrivingMinutes).toBe(270);
      expect(DEFAULT_DUTY_RULES.rollingWindowDays).toBe(7);
    });
  });

  describe("recording", () => {
    test("refuses a segment that ends before it starts", () => {
      expect(() => service.recordSegment(segment("bad", "DRIVING", t(0, 12), t(0, 10)))).toThrow(
        /ends before it starts/i,
      );
    });

    test("refuses a duplicate segment", () => {
      service.recordSegment(segment("s1", "DRIVING", t(0, 10), t(0, 12)));
      expect(() => service.recordSegment(segment("s1", "DRIVING", t(0, 14), t(0, 16)))).toThrow(
        /already recorded/i,
      );
    });

    test("refuses an entitlement valid for no time", () => {
      expect(() =>
        service.registerEntitlement({
          driverId: "driver-x",
          category: "D1",
          validFrom: t(0, 10),
          validUntil: t(0, 10),
        }),
      ).toThrow(/no time at all/i);
    });

    test("refuses an assignment with no segments", () => {
      expect(() => service.assess(DRIVER, [], t(0, 8))).toThrow(/no segments/i);
    });

    test("refuses a proposed segment that ends before it starts", () => {
      expect(() => service.assess(DRIVER, [drive(t(0, 12), t(0, 10))], t(0, 8))).toThrow(
        /ends before it starts/i,
      );
    });
  });

  describe("duty periods", () => {
    test("a gap too short to be a rest keeps one period open", () => {
      saturdayFixture(service);
      service.recordSegment(segment("sun-out", "DRIVING", t(1, 8), t(1, 11)));

      const periods = service.dutyPeriods(DRIVER);
      expect(periods).toHaveLength(1);
      expect(periods[0].drivingMinutes).toBe(540);
    });

    test("a gap long enough to be a rest closes the period", () => {
      saturdayFixture(service);
      service.recordSegment(segment("sun-out", "DRIVING", t(1, 12), t(1, 15)));

      const periods = service.dutyPeriods(DRIVER);
      expect(periods).toHaveLength(2);
      expect(periods[0].drivingMinutes).toBe(360);
      expect(periods[1].drivingMinutes).toBe(180);
    });

    test("duty covers everything and driving covers only the driving", () => {
      saturdayFixture(service);
      const period = service.dutyPeriods(DRIVER)[0];

      expect(period.drivingMinutes).toBe(360);
      expect(period.dutyMinutes).toBe(360 + 420);
      expect(period.breaks.map((gap) => gap.minutes)).toEqual([60, 60]);
    });
  });

  describe("a trip that is lawful in isolation and not after yesterday", () => {
    test("Sunday alone is unremarkable", () => {
      const fresh = new DriverDutyHoursService();
      entitled(fresh);

      const assessment = fresh.assess(DRIVER, [drive(t(1, 8), t(1, 11))], t(0, 12));
      expect(assessment.lawful).toBe(true);
      expect(assessment.drivingMinutes).toBe(180);
    });

    test("the same Sunday after Saturday's away fixture is not", () => {
      saturdayFixture(service);

      const assessment = service.assess(DRIVER, [drive(t(1, 8), t(1, 11))], t(0, 12));
      expect(assessment.lawful).toBe(false);
      expect(assessment.breaches.map((breach) => breach.rule)).toEqual(["DAILY_REST"]);
      expect(assessment.breaches[0]).toMatchObject({ limitMinutes: 540, actualMinutes: 420 });
    });

    test("the refusal says when they may leave", () => {
      saturdayFixture(service);

      const assessment = service.assess(DRIVER, [drive(t(1, 8), t(1, 11))], t(0, 12));
      // Home at one, plus a reduced rest of nine hours.
      expect(assessment.earliestLawfulDeparture).toEqual(t(1, 10));
    });

    test("leaving at the stated time clears it", () => {
      saturdayFixture(service);

      const assessment = service.assess(DRIVER, [drive(t(1, 10), t(1, 13))], t(0, 12));
      expect(assessment.lawful).toBe(true);
      expect(assessment.earliestLawfulDeparture).toEqual(t(1, 10));
    });

    test("a driver with no history has nothing to rest from", () => {
      const assessment = service.assess(DRIVER, [drive(t(1, 8), t(1, 11))], t(0, 12));
      expect(assessment.lawful).toBe(true);
    });
  });

  describe("the split break has an order", () => {
    /** Four hours, a break, four hours, a break, four hours. */
    function splitProposal(firstGap: number, secondGap: number): ProposedSegment[] {
      const start = t(3, 8);
      const firstEnd = new Date(start.getTime() + 120 * 60_000);
      const secondStart = new Date(firstEnd.getTime() + firstGap * 60_000);
      const secondEnd = new Date(secondStart.getTime() + 120 * 60_000);
      const thirdStart = new Date(secondEnd.getTime() + secondGap * 60_000);
      const thirdEnd = new Date(thirdStart.getTime() + 240 * 60_000);

      return [drive(start, firstEnd), drive(secondStart, secondEnd), drive(thirdStart, thirdEnd)];
    }

    test("fifteen minutes then thirty is compliant", () => {
      const assessment = service.assess(DRIVER, splitProposal(15, 30), t(3, 6));
      expect(assessment.lawful).toBe(true);
      expect(assessment.drivingMinutes).toBe(480);
    });

    test("thirty then fifteen is the same minutes and is not", () => {
      const assessment = service.assess(DRIVER, splitProposal(30, 15), t(3, 6));
      expect(assessment.lawful).toBe(false);
      expect(assessment.breaches.map((breach) => breach.rule)).toEqual(["CONTINUOUS_DRIVING"]);
      expect(assessment.breaches[0].actualMinutes).toBe(480);
      // The two proposals total the same driving and the same break minutes.
      expect(assessment.drivingMinutes).toBe(480);
    });

    test("two short breaks do not add up to the longer part", () => {
      const assessment = service.assess(DRIVER, splitProposal(15, 15), t(3, 6));
      expect(assessment.lawful).toBe(false);
      expect(assessment.breaches[0].rule).toBe("CONTINUOUS_DRIVING");
    });

    test("breaks too short to count do nothing at all", () => {
      const assessment = service.assess(DRIVER, splitProposal(10, 10), t(3, 6));
      expect(assessment.breaches[0].actualMinutes).toBe(480);
    });

    test("a full break in one piece resets the run", () => {
      const assessment = service.assess(
        DRIVER,
        [drive(t(3, 8), t(3, 12)), drive(t(3, 12, 45), t(3, 16, 45))],
        t(3, 6),
      );
      expect(assessment.lawful).toBe(true);
    });

    test("an unbroken run past the limit is refused", () => {
      const assessment = service.assess(DRIVER, [drive(t(3, 8), t(3, 13))], t(3, 6));
      expect(assessment.breaches[0]).toMatchObject({
        rule: "CONTINUOUS_DRIVING",
        limitMinutes: 270,
        actualMinutes: 300,
      });
    });

    test("no departure time makes a long drive shorter, and the refusal says so", () => {
      const assessment = service.assess(DRIVER, [drive(t(3, 8), t(3, 13))], t(3, 6));
      expect(assessment.breaches[0].lawfulFrom).toBeNull();
      expect(assessment.earliestLawfulDeparture).toBeNull();
    });
  });

  describe("allowances are consumed over a rolling window", () => {
    test("an extended day is available until the allowance runs out", () => {
      extendedDay(service, -3, "p1");
      expect(service.assess(DRIVER, extendedDayProposal(-1), t(-4, 8)).lawful).toBe(true);

      extendedDay(service, -2, "p2");
      const assessment = service.assess(DRIVER, extendedDayProposal(-1), t(-4, 8));

      expect(assessment.allowances.extensionsUsed).toBe(2);
      expect(assessment.allowances.extensionsRemaining).toBe(0);
      expect(assessment.breaches.map((breach) => breach.rule)).toEqual(["DAILY_DRIVING"]);
      expect(assessment.breaches[0]).toMatchObject({ limitMinutes: 540, actualMinutes: 570 });
    });

    test("past an extended day no allowance helps", () => {
      const assessment = service.assess(
        DRIVER,
        [
          drive(t(3, 8), t(3, 12)),
          drive(t(3, 12, 45), t(3, 16, 45)),
          drive(t(3, 17, 30), t(3, 20)),
        ],
        t(3, 6),
      );

      expect(assessment.drivingMinutes).toBe(630);
      expect(assessment.breaches[0]).toMatchObject({
        rule: "DAILY_DRIVING",
        limitMinutes: 600,
        actualMinutes: 630,
      });
      expect(assessment.earliestLawfulDeparture).toBeNull();
    });

    test("the window rolls from the departure rather than from a Monday", () => {
      extendedDay(service, -8, "old");
      extendedDay(service, -6, "recent");

      const allowances = service.allowances(DRIVER, t(0, 8));
      // Eight days back is outside a seven-day window even though a calendar
      // week reading might have kept it.
      expect(allowances.extensionsUsed).toBe(1);
      expect(allowances.windowFrom).toEqual(t(-7, 8));
    });

    test("a reduced rest is available until the allowance runs out", () => {
      // Four duty periods separated by nine and a half hours apiece.
      service.recordSegment(segment("r1", "DRIVING", t(-6, 8), t(-6, 12)));
      service.recordSegment(segment("r2", "DRIVING", t(-6, 21, 30), t(-6, 23, 30)));
      service.recordSegment(segment("r3", "DRIVING", t(-5, 9), t(-5, 11)));
      service.recordSegment(segment("r4", "DRIVING", t(-5, 20, 30), t(-5, 22, 30)));

      const allowances = service.allowances(DRIVER, t(-4, 5, 30));
      expect(allowances.reductionsUsed).toBe(3);
      expect(allowances.reductionsRemaining).toBe(0);
    });

    test("with every reduction spent the full rest is required", () => {
      service.recordSegment(segment("r1", "DRIVING", t(-6, 8), t(-6, 12)));
      service.recordSegment(segment("r2", "DRIVING", t(-6, 21, 30), t(-6, 23, 30)));
      service.recordSegment(segment("r3", "DRIVING", t(-5, 9), t(-5, 11)));
      service.recordSegment(segment("r4", "DRIVING", t(-5, 20, 30), t(-5, 22, 30)));

      const assessment = service.assess(DRIVER, [drive(t(-4, 5, 30), t(-4, 8))], t(-6, 0));

      expect(assessment.breaches.map((breach) => breach.rule)).toEqual(["DAILY_REST"]);
      expect(assessment.breaches[0].limitMinutes).toBe(660);
      expect(assessment.breaches[0].detail).toMatch(/every reduction in the window is spent/i);
      // Home at half ten, plus a full eleven hours.
      expect(assessment.earliestLawfulDeparture).toEqual(t(-4, 9, 30));
    });

    test("a full rest between duties consumes no reduction", () => {
      extendedDay(service, -3, "p1");
      extendedDay(service, -2, "p2");
      expect(service.allowances(DRIVER, t(-1, 8)).reductionsUsed).toBe(0);
    });
  });

  describe("duty is not driving", () => {
    test("riding as the second driver is duty and not driving", () => {
      const assessment = service.assess(
        CODRIVER,
        [{ kind: "SECOND_DRIVER", from: t(1, 8), to: t(1, 14) }],
        t(0, 12),
      );

      expect(assessment.drivingMinutes).toBe(0);
      expect(assessment.dutyMinutes).toBe(360);
      expect(assessment.lawful).toBe(true);
    });

    test("the second driver still has to have rested", () => {
      // Saturday's own driving is properly broken, so nothing but the rest
      // rule has anything to say about Sunday.
      service.recordSegment(segment("sat-a", "DRIVING", t(0, 19, 30), t(0, 22), CODRIVER));
      service.recordSegment(segment("sat-b", "DRIVING", t(0, 22, 45), t(1, 1), CODRIVER));

      const assessment = service.assess(
        CODRIVER,
        [{ kind: "SECOND_DRIVER", from: t(1, 8), to: t(1, 14) }],
        t(0, 12),
      );

      expect(assessment.lawful).toBe(false);
      expect(assessment.drivingMinutes).toBe(0);
      expect(assessment.breaches.map((breach) => breach.rule)).toEqual(["DAILY_REST"]);
    });

    test("loading and waiting count against the rest and not the wheel", () => {
      const assessment = service.assess(
        DRIVER,
        [{ kind: "OTHER_DUTY", from: t(3, 7), to: t(3, 8) }, drive(t(3, 8), t(3, 12))],
        t(3, 6),
      );

      expect(assessment.drivingMinutes).toBe(240);
      expect(assessment.dutyMinutes).toBe(300);
      expect(assessment.lawful).toBe(true);
    });
  });

  describe("entitlement", () => {
    test("a driver with no recorded entitlement is refused", () => {
      const assessment = service.assess("driver-nobody", [drive(t(1, 8), t(1, 11))], t(0, 12));
      expect(assessment.breaches[0]).toMatchObject({ rule: "ENTITLEMENT_EXPIRED" });
      expect(assessment.breaches[0].detail).toMatch(/no recorded entitlement/i);
    });

    test("entitlement is judged against the journey, not the booking", () => {
      service.registerEntitlement({
        driverId: "driver-lapsing",
        category: "D1",
        validFrom: t(-100, 0),
        validUntil: t(10, 0),
      });

      // Valid on the day the trip is booked.
      expect(service.assess("driver-lapsing", [drive(t(5, 8), t(5, 11))], t(0, 12)).lawful).toBe(
        true,
      );
      // Lapsed by the day the trip runs, and asked about from the same desk.
      const later = service.assess("driver-lapsing", [drive(t(30, 8), t(30, 11))], t(0, 12));
      expect(later.lawful).toBe(false);
      expect(later.breaches[0].rule).toBe("ENTITLEMENT_EXPIRED");
    });

    test("an entitlement that lapses mid-journey covers none of it", () => {
      service.registerEntitlement({
        driverId: "driver-midway",
        category: "D1",
        validFrom: t(-100, 0),
        validUntil: t(5, 10),
      });

      expect(service.assess("driver-midway", [drive(t(5, 8), t(5, 11))], t(0, 12)).lawful).toBe(
        false,
      );
    });

    test("waiting does not cure a lapsed licence", () => {
      const assessment = service.assess("driver-nobody", [drive(t(1, 8), t(1, 11))], t(0, 12));
      expect(assessment.breaches[0].lawfulFrom).toBeNull();
      expect(assessment.earliestLawfulDeparture).toBeNull();
    });
  });

  describe("every broken rule is reported", () => {
    test("three rules broken at once produce three breaches", () => {
      saturdayFixture(service);

      // Sunday morning: too soon after Saturday, too long in one run, and —
      // because the seven-hour gap never closed Saturday's duty period — the
      // two days' driving totals against one daily limit.
      const assessment = service.assess(DRIVER, [drive(t(1, 8), t(1, 13))], t(0, 12));
      expect(assessment.breaches.map((breach) => breach.rule)).toEqual([
        "CONTINUOUS_DRIVING",
        "DAILY_DRIVING",
        "DAILY_REST",
      ]);
      expect(assessment.breaches.find((breach) => breach.rule === "DAILY_DRIVING")).toMatchObject({
        limitMinutes: 600,
        actualMinutes: 660,
      });
    });

    test("an unfixable breach beside a fixable one leaves no lawful departure", () => {
      saturdayFixture(service);

      const assessment = service.assess(DRIVER, [drive(t(1, 8), t(1, 13))], t(0, 12));
      expect(assessment.earliestLawfulDeparture).toBeNull();
    });

    test("a lawful assignment reports the departure it was asked about", () => {
      const assessment = service.assess(DRIVER, [drive(t(1, 8), t(1, 11))], t(0, 12));
      expect(assessment.earliestLawfulDeparture).toEqual(t(1, 8));
      expect(assessment.breaches).toEqual([]);
    });
  });

  describe("recorded segments", () => {
    test("a driver's record comes back in order and scoped to them", () => {
      saturdayFixture(service);
      service.recordSegment(segment("other", "DRIVING", t(0, 9), t(0, 10), CODRIVER));

      const record = service.recordedSegments(DRIVER);
      expect(record.map((entry) => entry.segmentId)).toEqual(["sat-out", "sat-ground", "sat-back"]);
      expect(service.recordedSegments(CODRIVER)).toHaveLength(1);
    });

    test("a driver with no record has none", () => {
      expect(service.recordedSegments("driver-nobody")).toEqual([]);
      expect(service.dutyPeriods("driver-nobody")).toEqual([]);
    });
  });
});
