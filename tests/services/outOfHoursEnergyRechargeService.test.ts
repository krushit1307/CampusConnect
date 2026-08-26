/**
 * Test suite: Out-of-Hours Venue Energy Recharge (#4706)
 * File: tests/services/outOfHoursEnergyRechargeService.test.ts
 *
 * The two cases that decide whether this is right are the lead-in, which makes
 * the charge start before the booking does, and the overlap, where charging two
 * clubs the full cost bills the university twice for one unit of gas. The
 * apportionments are checked against the plant cost every time.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  OutOfHoursEnergyRechargeService,
  allocateByLargestRemainder,
  type BuildingEnergyProfile,
  type RoomBooking,
} from "../../src/services/outOfHoursEnergyRechargeService";

const ARTS = "building-arts";
const ANNEXE = "building-annexe";

const WINTER = "2027-11-15";
const SUMMER = "2027-07-10";
const MILD = "2027-05-01";

/** Winter evening. Core hours are eight to six. */
function t(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2027, 10, 15, hour, minute));
}

function nextDay(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2027, 10, 16, hour, minute));
}

function summer(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2027, 6, 10, hour, minute));
}

function mild(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2027, 4, 1, hour, minute));
}

function artsProfile(overrides: Partial<BuildingEnergyProfile> = {}): BuildingEnergyProfile {
  return {
    buildingId: ARTS,
    coreStartMinute: 8 * 60,
    coreEndMinute: 18 * 60,
    leadInMinutes: 90,
    heatingPlantKw: 60,
    coolingPlantKw: 40,
    startupKwh: 40,
    minimumBlockMinutes: 60,
    standingChargeCents: 500,
    ratePerKwhCents: 30,
    ...overrides,
  };
}

function booking(
  bookingId: string,
  from: Date,
  to: Date,
  overrides: Partial<RoomBooking> = {},
): RoomBooking {
  return {
    bookingId,
    buildingId: ARTS,
    roomId: "room-studio",
    clubId: `club-${bookingId}`,
    from,
    to,
    ...overrides,
  };
}

function build(): OutOfHoursEnergyRechargeService {
  const service = new OutOfHoursEnergyRechargeService();
  service.registerProfile(artsProfile());
  service.registerProfile(
    artsProfile({
      buildingId: ANNEXE,
      leadInMinutes: 0,
      coolingPlantKw: 60,
      startupKwh: 0,
      minimumBlockMinutes: 0,
      standingChargeCents: 0,
      ratePerKwhCents: 37,
    }),
  );

  service.recordDegreeDays({ date: WINTER, heatingDegreeDays: 8, coolingDegreeDays: 0 });
  service.recordDegreeDays({ date: "2027-11-16", heatingDegreeDays: 8, coolingDegreeDays: 0 });
  service.recordDegreeDays({ date: SUMMER, heatingDegreeDays: 0, coolingDegreeDays: 6 });
  service.recordDegreeDays({ date: MILD, heatingDegreeDays: 0, coolingDegreeDays: 0 });

  return service;
}

describe("OutOfHoursEnergyRechargeService (#4706)", () => {
  let service: OutOfHoursEnergyRechargeService;

  beforeEach(() => {
    service = build();
  });

  describe("registration", () => {
    test("rejects a duplicate profile", () => {
      expect(() => service.registerProfile(artsProfile())).toThrow(
        /already has an energy profile/i,
      );
    });

    test("rejects core hours that end before they begin", () => {
      expect(() =>
        service.registerProfile(
          artsProfile({ buildingId: "b1", coreStartMinute: 1_080, coreEndMinute: 480 }),
        ),
      ).toThrow(/end before they begin/i);
    });

    test("rejects core hours running past midnight", () => {
      expect(() =>
        service.registerProfile(artsProfile({ buildingId: "b2", coreEndMinute: 1_500 })),
      ).toThrow(/past midnight/i);
    });

    test("rejects a negative interval", () => {
      expect(() =>
        service.registerProfile(artsProfile({ buildingId: "b3", leadInMinutes: -10 })),
      ).toThrow(/negative interval/i);
    });

    test("rejects negative degree days", () => {
      expect(() =>
        service.recordDegreeDays({ date: WINTER, heatingDegreeDays: -1, coolingDegreeDays: 0 }),
      ).toThrow(/negative/i);
    });

    test("rejects a booking in an unknown building or ending before it starts", () => {
      expect(() =>
        service.recordBooking(booking("b", t(19), t(22), { buildingId: "building-none" })),
      ).toThrow(/Unknown building/i);
      expect(() => service.recordBooking(booking("b", t(22), t(19)))).toThrow(
        /ends before it starts/i,
      );
      expect(() => service.quote("booking-none", t(12))).toThrow(/Unknown booking/i);
    });
  });

  describe("the weather decides the mode, not the season", () => {
    test("a cold day heats and a hot day cools", () => {
      expect(service.plantMode(ARTS, t(19))).toBe("HEATING");
      expect(service.plantMode(ARTS, summer(19))).toBe("COOLING");
    });

    test("a mild day runs no plant at all", () => {
      expect(service.plantMode(ARTS, mild(19))).toBe("NONE");
    });

    test("a mild evening is quoted at nothing rather than at an hourly rate", () => {
      service.recordBooking(booking("mild", mild(19), mild(22)));
      const quote = service.quote("mild", mild(12));

      expect(quote.outcome).toBe("NO_PLANT_REQUIRED");
      expect(quote.mode).toBe("NONE");
      expect(quote.standaloneCents).toBe(0);
    });

    test("an unobserved date throws rather than quoting nothing", () => {
      service.recordBooking(
        booking(
          "unknown-day",
          new Date(Date.UTC(2028, 0, 5, 19)),
          new Date(Date.UTC(2028, 0, 5, 22)),
        ),
      );
      expect(() => service.quote("unknown-day", new Date(Date.UTC(2028, 0, 5, 12)))).toThrow(
        /No degree-day observation/i,
      );
    });

    test("cooling uses the cooling plant, which is a different size", () => {
      service.recordBooking(booking("summer", summer(19), summer(22)));
      const quote = service.quote("summer", summer(12));

      expect(quote.mode).toBe("COOLING");
      expect(quote.chargeableMinutes).toBe(240);
      // Forty kilowatts rather than sixty.
      expect(quote.runningKwh).toBe(160);
      expect(quote.standaloneCents).toBe(1_200 + 500 + 4_800);
    });
  });

  describe("the plant runs before the booking starts", () => {
    test("a three-hour booking is charged for four hours of plant", () => {
      service.recordBooking(booking("drama", t(19), t(22)));
      const quote = service.quote("drama", t(12));

      expect(quote.plantFrom).toEqual(t(17, 30));
      // The booking is 180 minutes. The plant runs for 240 chargeable ones.
      expect(quote.chargeableMinutes).toBe(240);
      expect(quote.chargeableMinutes).toBeGreaterThan(180);
    });

    test("the part of the lead-in inside core hours costs nothing", () => {
      service.recordBooking(booking("drama", t(19), t(22)));
      const quote = service.quote("drama", t(12));

      expect(quote.coreHoursMinutes).toBe(30);
    });

    test("a booking starting inside core hours is only charged from the end of them", () => {
      service.recordBooking(booking("early", t(17), t(20)));
      const quote = service.quote("early", t(12));

      expect(quote.chargeableMinutes).toBe(120);
      expect(quote.coreHoursMinutes).toBe(150);
    });

    test("a booking made inside the lead-in horizon cannot be serviced", () => {
      service.recordBooking(booking("late-request", t(19), t(22)));
      const quote = service.quote("late-request", t(18));

      expect(quote.outcome).toBe("UNSERVICEABLE");
      expect(quote.standaloneCents).toBe(0);
      expect(quote.commitAt).toEqual(t(17, 30));
    });

    test("a window spanning midnight is one interval, not two", () => {
      service.recordBooking(booking("overnight", t(22), nextDay(2)));
      const quote = service.quote("overnight", t(12));

      expect(quote.plantFrom).toEqual(t(20, 30));
      expect(quote.chargeableMinutes).toBe(330);
    });
  });

  describe("the minimum block", () => {
    test("a short booking is padded to the block and the padding is reported", () => {
      service.recordBooking(booking("short", t(18), t(18, 20)));
      const quote = service.quote("short", t(12));

      expect(quote.minimumBlockPaddingMinutes).toBe(40);
      expect(quote.chargeableMinutes).toBe(60);
      expect(quote.plantTo).toEqual(t(19));
      expect(quote.standaloneCents).toBe(1_200 + 500 + 1_800);
    });

    test("a booking past the block is not padded", () => {
      service.recordBooking(booking("drama", t(19), t(22)));
      expect(service.quote("drama", t(12)).minimumBlockPaddingMinutes).toBe(0);
    });
  });

  describe("the cost is shared, not duplicated", () => {
    beforeEach(() => {
      service.recordBooking(booking("drama", t(19), t(22), { clubId: "club-drama" }));
      service.recordBooking(booking("orchestra", t(20), t(23), { clubId: "club-orchestra" }));
    });

    test("the plant runs once over the union of the two windows", () => {
      const runs = service.plantRuns(ARTS, WINTER, t(12));

      expect(runs).toHaveLength(1);
      expect(runs[0].from).toEqual(t(18));
      expect(runs[0].to).toEqual(t(23));
      expect(runs[0].runningMinutes).toBe(300);
    });

    test("charging both of them standalone would bill for nearly twice the gas", () => {
      const standalone =
        service.quote("drama", t(12)).standaloneCents +
        service.quote("orchestra", t(12)).standaloneCents;
      const actual = service.plantRuns(ARTS, WINTER, t(12))[0].plantCostCents;

      expect(standalone).toBe(18_700);
      expect(actual).toBe(10_700);
    });

    test("the startup goes to whoever fired the plant", () => {
      const [run] = service.plantRuns(ARTS, WINTER, t(12));
      const drama = run.apportionments.find((entry) => entry.bookingId === "drama")!;
      const orchestra = run.apportionments.find((entry) => entry.bookingId === "orchestra")!;

      expect(drama.triggeredPlant).toBe(true);
      expect(drama.startupCents).toBe(1_700);
      expect(orchestra.triggeredPlant).toBe(false);
      expect(orchestra.startupCents).toBe(0);
    });

    test("running cost is shared by the minutes each of them occupied", () => {
      const [run] = service.plantRuns(ARTS, WINTER, t(12));
      const drama = run.apportionments.find((entry) => entry.bookingId === "drama")!;
      const orchestra = run.apportionments.find((entry) => entry.bookingId === "orchestra")!;

      // Half an hour alone, three and a half shared, then an hour alone.
      expect(drama.weightedMinutes).toBe(135);
      expect(orchestra.weightedMinutes).toBe(165);
      expect(drama.runningCents).toBe(4_050);
      expect(orchestra.runningCents).toBe(4_950);
    });

    test("the apportionments sum to exactly the plant cost", () => {
      const [run] = service.plantRuns(ARTS, WINTER, t(12));
      const sum = run.apportionments.reduce((total, entry) => total + entry.totalCents, 0);

      expect(sum).toBe(run.plantCostCents);
      expect(sum).toBe(10_700);
    });

    test("one booking's recharge is what it owes after sharing, not its standalone", () => {
      const recharge = service.rechargeFor("drama", t(12))!;

      expect(recharge.totalCents).toBe(5_750);
      expect(recharge.totalCents).toBeLessThan(service.quote("drama", t(12)).standaloneCents);
    });

    test("windows that do not touch are two separate plant runs", () => {
      const fresh = build();
      fresh.recordBooking(booking("drama", t(19), t(22)));
      fresh.recordBooking(booking("late", t(23, 45), nextDay(1)));

      const runs = fresh.plantRuns(ARTS, WINTER, t(12));
      expect(runs).toHaveLength(2);
      expect(runs[0].runningMinutes).toBe(240);
      expect(runs[1].runningMinutes).toBe(165);
      // Two runs means two startups. The plant really did fire twice.
      expect(runs[1].startupCents).toBe(1_700);
    });

    test("a building with nothing booked has no runs", () => {
      expect(service.plantRuns(ARTS, "2027-12-25", t(12))).toEqual([]);
      expect(() => service.plantRuns("building-none", WINTER, t(12))).toThrow(/Unknown building/i);
    });

    test("a booking needing no plant has no recharge", () => {
      service.recordBooking(booking("mild", mild(19), mild(22)));
      expect(service.rechargeFor("mild", mild(12))).toBeNull();
    });
  });

  describe("the remainder is allocated rather than lost", () => {
    test("a three-way overlap still sums to the plant cost", () => {
      service.recordBooking(
        booking("annexe-a", t(18), t(19), { buildingId: ANNEXE, clubId: "club-a" }),
      );
      service.recordBooking(
        booking("annexe-b", t(18), t(19), { buildingId: ANNEXE, clubId: "club-b" }),
      );
      service.recordBooking(
        booking("annexe-c", t(18), t(18, 20), { buildingId: ANNEXE, clubId: "club-c" }),
      );

      const [run] = service.plantRuns(ANNEXE, WINTER, t(12));
      const sum = run.apportionments.reduce((total, entry) => total + entry.totalCents, 0);

      expect(run.plantCostCents).toBe(2_220);
      expect(sum).toBe(2_220);
      // 986.67 apiece for the two full hours and 246.67 for the short one; the
      // two spare pence go to the largest fractions rather than evaporating.
      expect(run.apportionments.map((entry) => entry.totalCents)).toEqual([987, 987, 246]);
    });

    test("largest remainder splits a total that does not divide", () => {
      expect(allocateByLargestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
      expect(allocateByLargestRemainder(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
      expect(allocateByLargestRemainder(7, [1, 1])).toEqual([4, 3]);
    });

    test("largest remainder handles the degenerate cases", () => {
      expect(allocateByLargestRemainder(10, [])).toEqual([]);
      expect(allocateByLargestRemainder(0, [1, 2])).toEqual([0, 0]);
      expect(allocateByLargestRemainder(100, [0, 0])).toEqual([0, 0]);
    });

    test("an exact division leaves nothing to allocate", () => {
      expect(allocateByLargestRemainder(90, [1, 2])).toEqual([30, 60]);
    });
  });

  describe("cancellation", () => {
    beforeEach(() => service.recordBooking(booking("drama", t(19), t(22))));

    test("cancelling before the plant is committed saves the charge", () => {
      const assessment = service.assessCancellation("drama", t(17));

      expect(assessment.charged).toBe(false);
      expect(assessment.commitAt).toEqual(t(17, 30));
      expect(assessment.reason).toMatch(/before the plant was committed/i);
    });

    test("cancelling at the horizon is too late", () => {
      expect(service.assessCancellation("drama", t(17, 30)).charged).toBe(true);
    });

    test("cancelling after the plant has run is charged, because the gas was burned", () => {
      const assessment = service.assessCancellation("drama", t(20));

      expect(assessment.charged).toBe(true);
      expect(assessment.reason).toMatch(/the gas was burned/i);
    });
  });

  describe("chargeable intervals", () => {
    test("a window wholly inside core hours is chargeable for nothing", () => {
      const intervals = service.chargeableIntervals(t(10), t(12), artsProfile());
      expect(intervals).toEqual([]);
    });

    test("a window wholly outside core hours is chargeable throughout", () => {
      const intervals = service.chargeableIntervals(t(19), t(22), artsProfile());
      expect(intervals).toEqual([{ from: t(19), to: t(22) }]);
    });

    test("a window straddling the end of core hours is clipped", () => {
      const intervals = service.chargeableIntervals(t(16), t(20), artsProfile());
      expect(intervals).toEqual([{ from: t(18), to: t(20) }]);
    });

    test("a window straddling both edges leaves the middle alone", () => {
      const intervals = service.chargeableIntervals(t(6), t(20), artsProfile());
      expect(intervals).toEqual([
        { from: t(6), to: t(8) },
        { from: t(18), to: t(20) },
      ]);
    });
  });
});
