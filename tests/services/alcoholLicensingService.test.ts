/**
 * Test suite: Alcohol Licensing Compliance (#5161)
 * File: tests/services/alcoholLicensingService.test.ts
 *
 * The cases worth writing down are the ones the two-page annex and a clock
 * comparison both miss: the event running 22:00 to 01:00 inside a period that
 * crosses midnight, the licensed occupancy of 250 sitting under a fire capacity
 * of 400 and over an allocation of 300, the DPS whose personal licence expired
 * in February, and the summer series that exhausts one of five interacting
 * counters in May.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  AlcoholLicensingService,
  daysCovered,
  type LicensableEvent,
  type LicenceCondition,
  type TemporaryEventNotice,
  type TenLimits,
} from "../../src/services/alcoholLicensingService";

const FRIDAY = 5;
const SATURDAY = 6;

const DEFAULT_LIMITS: TenLimits = {
  noticesPerPremisesPerYear: 15,
  daysPerPremisesPerYear: 21,
  maxDaysPerNotice: 7,
  noticesPerPersonalLicenceHolderPerYear: 50,
  noticesPerOtherGiverPerYear: 5,
  minimumIntervalDays: 24,
};

const CONDITIONS: LicenceCondition[] = [
  { kind: "CAPACITY", conditionId: "cnd-capacity", maxOccupancy: 250 },
  { kind: "DPS_PRESENT", conditionId: "cnd-dps" },
  {
    kind: "DOOR_SUPERVISORS",
    conditionId: "cnd-door",
    thresholdHeadcount: 100,
    onePerHeadcount: 75,
  },
  {
    kind: "ACTIVITY_RESTRICTION",
    conditionId: "cnd-vertical",
    activity: "VERTICAL_DRINKING",
    notAfterMinute: 23 * 60,
  },
];

function build(overrides: Partial<TenLimits> = {}): AlcoholLicensingService {
  const service = new AlcoholLicensingService({ ...DEFAULT_LIMITS, ...overrides });

  service.registerLicence({
    licenceId: "lic-union",
    premisesId: "prem-union-bar",
    permittedPeriods: [
      // Friday 11:00 through to 02:00 on Saturday, which is one period.
      { startDay: FRIDAY, startMinute: 11 * 60, endMinute: 26 * 60 },
      // Saturday 22:00 into Sunday, which runs past the end of the week.
      { startDay: SATURDAY, startMinute: 22 * 60, endMinute: 26 * 60 },
    ],
    conditions: CONDITIONS,
  });

  service.registerPersonalLicence({
    holderId: "per-jo",
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validTo: new Date("2036-01-01T00:00:00.000Z"),
  });
  service.registerPersonalLicence({
    holderId: "per-lapsed",
    validFrom: new Date("2019-01-01T00:00:00.000Z"),
    validTo: new Date("2029-02-01T00:00:00.000Z"),
  });

  return service;
}

function event(overrides: Partial<LicensableEvent> = {}): LicensableEvent {
  return {
    eventId: "evt-friday-night",
    premisesId: "prem-union-bar",
    startsAt: new Date("2029-03-16T22:00:00.000Z"),
    endsAt: new Date("2029-03-17T01:00:00.000Z"),
    physicalCapacity: 400,
    ticketAllocation: 200,
    expectedHeadcount: 90,
    roster: [{ personId: "per-jo", role: "DPS" }],
    activities: [],
    ...overrides,
  };
}

function notice(
  overrides: Partial<TemporaryEventNotice> & Pick<TemporaryEventNotice, "noticeId">,
): TemporaryEventNotice {
  return {
    premisesId: "prem-quad",
    givenBy: "usr-officer",
    giverHoldsPersonalLicence: true,
    from: new Date("2029-05-01T00:00:00.000Z"),
    to: new Date("2029-05-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("permitted hours across midnight", () => {
  let service: AlcoholLicensingService;

  beforeEach(() => {
    service = build();
  });

  test("an event from 22:00 to 01:00 is inside a period running to 02:00", () => {
    const assessment = service.assessEvent(event());

    expect(assessment.route).toBe("PREMISES_LICENCE");
    expect(assessment.lawful).toBe(true);
  });

  test("an event finishing exactly at the terminal hour is still inside it", () => {
    const assessment = service.assessEvent(event({ endsAt: new Date("2029-03-17T02:00:00.000Z") }));

    expect(assessment.breaches.map((breach) => breach.kind)).not.toContain(
      "OUTSIDE_PERMITTED_HOURS",
    );
  });

  test("an event starting at 03:00 the same night is outside them", () => {
    const assessment = service.assessEvent(
      event({
        startsAt: new Date("2029-03-17T03:00:00.000Z"),
        endsAt: new Date("2029-03-17T05:00:00.000Z"),
      }),
    );

    expect(assessment.lawful).toBe(false);
    expect(assessment.route).toBe("TEN_REQUIRED");
    expect(assessment.breaches[0].kind).toBe("OUTSIDE_PERMITTED_HOURS");
  });

  test("a Saturday period reaching into Sunday wraps the end of the week", () => {
    const assessment = service.assessEvent(
      event({
        startsAt: new Date("2029-03-18T00:30:00.000Z"),
        endsAt: new Date("2029-03-18T01:30:00.000Z"),
      }),
    );

    expect(assessment.route).toBe("PREMISES_LICENCE");
  });

  test("an hour's extension past the terminal hour takes the event outside them", () => {
    const assessment = service.assessEvent(event({ endsAt: new Date("2029-03-17T02:30:00.000Z") }));

    expect(assessment.route).toBe("TEN_REQUIRED");
  });
});

describe("capacity as the lowest of three independent numbers", () => {
  let service: AlcoholLicensingService;

  beforeEach(() => {
    service = build();
  });

  test("a licence condition below the fire capacity is the number that binds", () => {
    const assessment = service.assessEvent(event({ ticketAllocation: 300 }));

    expect(assessment.capacity).toEqual({ bindingCapacity: 250, source: "LICENCE_CONDITION" });
    expect(assessment.breaches.map((breach) => breach.kind)).toContain("CAPACITY_EXCEEDED");
  });

  test("an allocation below the licence condition binds without breaching it", () => {
    const assessment = service.assessEvent(event({ ticketAllocation: 200 }));

    expect(assessment.capacity).toEqual({ bindingCapacity: 200, source: "TICKET_ALLOCATION" });
    expect(assessment.lawful).toBe(true);
  });

  test("a room smaller than either is still the number that binds", () => {
    const assessment = service.assessEvent(event({ physicalCapacity: 180 }));

    expect(assessment.capacity).toEqual({ bindingCapacity: 180, source: "PHYSICAL_CAPACITY" });
  });
});

describe("conditions that require a person to be there", () => {
  let service: AlcoholLicensingService;

  beforeEach(() => {
    service = build();
  });

  test("no designated premises supervisor on the roster is a breach", () => {
    const assessment = service.assessEvent(event({ roster: [] }));

    expect(assessment.breaches.map((breach) => breach.kind)).toContain("NO_DPS_ON_PREMISES");
  });

  test("a DPS whose personal licence expired in February is not a DPS in March", () => {
    const assessment = service.assessEvent(
      event({ roster: [{ personId: "per-lapsed", role: "DPS" }] }),
    );

    const breach = assessment.breaches.find((item) => item.kind === "DPS_LICENCE_NOT_IN_FORCE");
    expect(breach).toBeDefined();
    expect(breach?.conditionId).toBe("cnd-dps");
  });

  test("a rostered DPS holding a licence in force satisfies the condition", () => {
    expect(service.assessEvent(event()).lawful).toBe(true);
  });

  test("the door supervisor condition does not bite below its threshold", () => {
    const assessment = service.assessEvent(event({ expectedHeadcount: 90 }));

    expect(assessment.breaches.map((breach) => breach.kind)).not.toContain(
      "INSUFFICIENT_DOOR_SUPERVISORS",
    );
  });

  test("above the threshold the ratio decides how many are needed", () => {
    const assessment = service.assessEvent(
      event({
        expectedHeadcount: 220,
        roster: [
          { personId: "per-jo", role: "DPS" },
          { personId: "per-a", role: "DOOR_SUPERVISOR" },
        ],
      }),
    );

    const breach = assessment.breaches.find(
      (item) => item.kind === "INSUFFICIENT_DOOR_SUPERVISORS",
    );
    expect(breach?.detail).toContain("3 required");
    expect(breach?.remedy).toContain("2 more");
  });

  test("rostering to the ratio clears the condition", () => {
    const assessment = service.assessEvent(
      event({
        expectedHeadcount: 220,
        roster: [
          { personId: "per-jo", role: "DPS" },
          { personId: "per-a", role: "DOOR_SUPERVISOR" },
          { personId: "per-b", role: "DOOR_SUPERVISOR" },
          { personId: "per-c", role: "DOOR_SUPERVISOR" },
        ],
      }),
    );

    expect(assessment.lawful).toBe(true);
  });
});

describe("activity restrictions and unlicensed premises", () => {
  let service: AlcoholLicensingService;

  beforeEach(() => {
    service = build();
  });

  test("an activity running past its restriction is a breach", () => {
    const assessment = service.assessEvent(
      event({ activities: [{ activity: "VERTICAL_DRINKING", endsAtMinute: 23 * 60 + 30 }] }),
    );

    expect(assessment.breaches.map((breach) => breach.kind)).toContain("ACTIVITY_RESTRICTED");
  });

  test("an activity stopping exactly on the restriction is not", () => {
    const assessment = service.assessEvent(
      event({ activities: [{ activity: "VERTICAL_DRINKING", endsAtMinute: 23 * 60 }] }),
    );

    expect(assessment.lawful).toBe(true);
  });

  test("premises with no licence at all are a different answer from a breached condition", () => {
    const assessment = service.assessEvent(event({ premisesId: "prem-quad" }));

    expect(assessment.route).toBe("UNLICENSED");
    expect(assessment.licenceId).toBeNull();
    expect(assessment.breaches[0].kind).toBe("NO_LICENCE_FOR_PREMISES");
  });
});

describe("temporary event notice counters", () => {
  test("a notice covering both its first and last day counts both", () => {
    expect(
      daysCovered(new Date("2029-05-01T00:00:00.000Z"), new Date("2029-05-01T00:00:00.000Z")),
    ).toBe(1);
    expect(
      daysCovered(new Date("2029-05-01T00:00:00.000Z"), new Date("2029-05-03T00:00:00.000Z")),
    ).toBe(3);
  });

  test("the notice count at a premises exhausts on its own", () => {
    const service = build({
      noticesPerPremisesPerYear: 3,
      daysPerPremisesPerYear: 100,
      minimumIntervalDays: 0,
    });
    for (let index = 0; index < 3; index += 1) {
      service.recordNotice(
        notice({
          noticeId: `ten-${index}`,
          from: new Date(`2029-0${index + 1}-01T00:00:00.000Z`),
          to: new Date(`2029-0${index + 1}-01T00:00:00.000Z`),
        }),
      );
    }

    const assessment = service.assessNotice(notice({ noticeId: "ten-new" }));
    expect(assessment.permitted).toBe(false);
    expect(assessment.exhausted).toBe("NOTICES_PER_PREMISES");
  });

  test("the day count at a premises exhausts even where the notice count has not", () => {
    const service = build({
      noticesPerPremisesPerYear: 20,
      daysPerPremisesPerYear: 10,
      minimumIntervalDays: 0,
    });
    service.recordNotice(
      notice({
        noticeId: "ten-a",
        from: new Date("2029-02-01T00:00:00.000Z"),
        to: new Date("2029-02-05T00:00:00.000Z"),
      }),
    );
    service.recordNotice(
      notice({
        noticeId: "ten-b",
        from: new Date("2029-03-01T00:00:00.000Z"),
        to: new Date("2029-03-05T00:00:00.000Z"),
      }),
    );

    const assessment = service.assessNotice(notice({ noticeId: "ten-new" }));
    expect(assessment.exhausted).toBe("DAYS_PER_PREMISES");
    expect(
      assessment.counters.find((counter) => counter.counter === "DAYS_PER_PREMISES")?.used,
    ).toBe(10);
  });

  test("a single notice longer than the per-notice limit is refused whatever else is unused", () => {
    const service = build({ minimumIntervalDays: 0 });

    const assessment = service.assessNotice(
      notice({
        noticeId: "ten-long",
        from: new Date("2029-05-01T00:00:00.000Z"),
        to: new Date("2029-05-08T00:00:00.000Z"),
      }),
    );

    expect(assessment.exhausted).toBe("DAYS_PER_NOTICE");
  });

  test("a giver without a personal licence has a lower ceiling than one with it", () => {
    const service = build({
      noticesPerOtherGiverPerYear: 2,
      noticesPerPersonalLicenceHolderPerYear: 50,
      minimumIntervalDays: 0,
    });
    service.recordNotice(
      notice({ noticeId: "ten-a", givenBy: "usr-fresher", giverHoldsPersonalLicence: false }),
    );
    service.recordNotice(
      notice({
        noticeId: "ten-b",
        givenBy: "usr-fresher",
        giverHoldsPersonalLicence: false,
        from: new Date("2029-06-01T00:00:00.000Z"),
        to: new Date("2029-06-01T00:00:00.000Z"),
      }),
    );

    const refused = service.assessNotice(
      notice({ noticeId: "ten-c", givenBy: "usr-fresher", giverHoldsPersonalLicence: false }),
    );
    expect(refused.exhausted).toBe("NOTICES_PER_GIVER");

    const permitted = service.assessNotice(
      notice({ noticeId: "ten-c", givenBy: "usr-fresher", giverHoldsPersonalLicence: true }),
    );
    expect(permitted.permitted).toBe(true);
  });

  test("a giver's count follows them across premises", () => {
    const service = build({ noticesPerPersonalLicenceHolderPerYear: 2, minimumIntervalDays: 0 });
    service.recordNotice(notice({ noticeId: "ten-a", premisesId: "prem-quad" }));
    service.recordNotice(
      notice({
        noticeId: "ten-b",
        premisesId: "prem-lawn",
        from: new Date("2029-06-01T00:00:00.000Z"),
        to: new Date("2029-06-01T00:00:00.000Z"),
      }),
    );

    const assessment = service.assessNotice(
      notice({ noticeId: "ten-c", premisesId: "prem-field" }),
    );
    expect(assessment.exhausted).toBe("NOTICES_PER_GIVER");
  });

  test("notices too close together at one premises are refused on the interval alone", () => {
    const service = build({ minimumIntervalDays: 24 });
    service.recordNotice(
      notice({
        noticeId: "ten-a",
        from: new Date("2029-05-01T00:00:00.000Z"),
        to: new Date("2029-05-01T00:00:00.000Z"),
      }),
    );

    const assessment = service.assessNotice(
      notice({
        noticeId: "ten-b",
        from: new Date("2029-05-10T00:00:00.000Z"),
        to: new Date("2029-05-10T00:00:00.000Z"),
      }),
    );

    expect(assessment.exhausted).toBe("MINIMUM_INTERVAL");
    expect(assessment.detail).toContain("9 day(s)");
  });

  test("the first notice at a premises is not refused for want of a predecessor", () => {
    const service = build({ minimumIntervalDays: 24 });
    expect(service.assessNotice(notice({ noticeId: "ten-a" })).permitted).toBe(true);
  });

  test("withdrawn notices and notices from another year do not count", () => {
    const service = build({ noticesPerPremisesPerYear: 1, minimumIntervalDays: 0 });
    service.recordNotice(notice({ noticeId: "ten-withdrawn", withdrawn: true }));
    service.recordNotice(
      notice({
        noticeId: "ten-last-year",
        from: new Date("2028-05-01T00:00:00.000Z"),
        to: new Date("2028-05-01T00:00:00.000Z"),
      }),
    );

    expect(service.assessNotice(notice({ noticeId: "ten-new" })).permitted).toBe(true);
  });

  test("what is left at a premises is reportable before the series is planned", () => {
    const service = build({ noticesPerPremisesPerYear: 15, daysPerPremisesPerYear: 21 });
    service.recordNotice(
      notice({
        noticeId: "ten-a",
        from: new Date("2029-05-01T00:00:00.000Z"),
        to: new Date("2029-05-04T00:00:00.000Z"),
      }),
    );

    expect(service.remainingAllowance("prem-quad", 2029)).toEqual({
      noticesRemaining: 14,
      daysRemaining: 17,
    });
  });
});

describe("amendments as a fresh determination", () => {
  let service: AlcoholLicensingService;

  beforeEach(() => {
    service = build();
  });

  test("an hour's extension introduces the breach it creates", () => {
    const amendment = service.assessAmendment(
      event(),
      event({ endsAt: new Date("2029-03-17T02:30:00.000Z") }),
    );

    expect(amendment.wasLawful).toBe(true);
    expect(amendment.isLawful).toBe(false);
    expect(amendment.introduced.map((breach) => breach.kind)).toEqual(["OUTSIDE_PERMITTED_HOURS"]);
  });

  test("raising the allocation over the licensed occupancy introduces a capacity breach", () => {
    const amendment = service.assessAmendment(event(), event({ ticketAllocation: 300 }));

    expect(amendment.introduced.map((breach) => breach.kind)).toEqual(["CAPACITY_EXCEEDED"]);
  });

  test("rostering a DPS resolves the breach rather than leaving the earlier verdict standing", () => {
    const amendment = service.assessAmendment(event({ roster: [] }), event());

    expect(amendment.wasLawful).toBe(false);
    expect(amendment.isLawful).toBe(true);
    expect(amendment.resolved.map((breach) => breach.kind)).toEqual(["NO_DPS_ON_PREMISES"]);
  });
});
