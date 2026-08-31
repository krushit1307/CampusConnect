/**
 * Test suite: Irregular-Hours Holiday Entitlement Accrual (#5262)
 * File: tests/services/casualHolidayAccrualService.test.ts
 *
 * The cases worth writing down are the ones a fixed annual allowance and a flat
 * "hours worked times 12.07%" both get wrong: the hours credited while somebody
 * was on sick leave, the pay period that straddles the leave-year boundary, the
 * worker who worked all 52 weeks and hits the cap the percentage does not, the
 * reference period with three unpaid weeks in it, and the rate that rose in
 * April before a termination in June.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  CasualHolidayAccrualService,
  ACCRUAL_RATE,
  weekStartOf,
  type PayPeriod,
} from "../../src/services/casualHolidayAccrualService";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const YEAR_2028_START = new Date("2028-04-01T00:00:00.000Z");
const YEAR_2029_START = new Date("2029-04-01T00:00:00.000Z");
const YEAR_2030_START = new Date("2030-04-01T00:00:00.000Z");
/** A Monday, so weekly periods line up with the weeks the reference period uses. */
const FIRST_MONDAY = new Date("2029-04-02T00:00:00.000Z");

function mondayAfter(weeks: number): Date {
  return new Date(FIRST_MONDAY.getTime() + weeks * 7 * MS_PER_DAY);
}

function period(
  overrides: Partial<PayPeriod> & Pick<PayPeriod, "periodId" | "workerId" | "startsOn" | "endsOn">,
): PayPeriod {
  return {
    hoursWorked: 0,
    statutoryLeaveHoursCredited: 0,
    hourlyRatePence: 1200,
    rolledUpPaidPence: 0,
    rolledUpItemised: false,
    ...overrides,
  };
}

function build(): CasualHolidayAccrualService {
  const service = new CasualHolidayAccrualService();

  for (const workerId of ["w-simple", "w-full", "w-weekly", "w-gappy"]) {
    service.registerLeaveYear({ workerId, startsOn: YEAR_2029_START, endsOn: YEAR_2030_START });
  }
  service.registerLeaveYear({
    workerId: "w-simple",
    startsOn: YEAR_2028_START,
    endsOn: YEAR_2029_START,
  });

  // Two hundred hours of ordinary work, and a fortnight straddling 1 April.
  service.recordPayPeriod(
    period({
      periodId: "p-worked",
      workerId: "w-simple",
      startsOn: new Date("2029-05-07T00:00:00.000Z"),
      endsOn: new Date("2029-05-21T00:00:00.000Z"),
      hoursWorked: 100,
      rolledUpPaidPence: 14483,
      rolledUpItemised: true,
    }),
  );
  service.recordPayPeriod(
    period({
      periodId: "p-credited",
      workerId: "w-simple",
      startsOn: new Date("2029-06-04T00:00:00.000Z"),
      endsOn: new Date("2029-06-18T00:00:00.000Z"),
      hoursWorked: 80,
      statutoryLeaveHoursCredited: 20,
    }),
  );
  service.recordPayPeriod(
    period({
      periodId: "p-straddle",
      workerId: "w-simple",
      startsOn: new Date("2029-03-25T00:00:00.000Z"),
      endsOn: new Date("2029-04-08T00:00:00.000Z"),
      hoursWorked: 140,
    }),
  );

  service.recordLeaveTaken({
    leaveId: "l-may",
    workerId: "w-simple",
    takenOn: new Date("2029-05-20T00:00:00.000Z"),
    hours: 8,
  });
  service.recordLeaveTaken({
    leaveId: "l-march",
    workerId: "w-simple",
    takenOn: new Date("2029-03-20T00:00:00.000Z"),
    hours: 8,
  });

  // Fifty-two weeks worked without a break, which is where the cap bites.
  service.recordPayPeriod(
    period({
      periodId: "p-full-year",
      workerId: "w-full",
      startsOn: FIRST_MONDAY,
      endsOn: YEAR_2030_START,
      hoursWorked: 520,
    }),
  );

  // Ten consecutive weeks, with the rate rising halfway through.
  for (let week = 0; week < 10; week += 1) {
    service.recordPayPeriod(
      period({
        periodId: `p-weekly-${week}`,
        workerId: "w-weekly",
        startsOn: mondayAfter(week),
        endsOn: mondayAfter(week + 1),
        hoursWorked: 10,
        hourlyRatePence: week < 5 ? 1200 : 1500,
      }),
    );
  }

  // Three weeks worked out of six, which is the pattern the reference period
  // rules exist for.
  for (const week of [0, 2, 4]) {
    service.recordPayPeriod(
      period({
        periodId: `p-gappy-${week}`,
        workerId: "w-gappy",
        startsOn: mondayAfter(week),
        endsOn: mondayAfter(week + 1),
        hoursWorked: 10,
      }),
    );
  }

  return service;
}

describe("the accrual rate", () => {
  test("is 5.6 weeks over the 46.4 remaining working weeks", () => {
    expect(ACCRUAL_RATE).toBeCloseTo(0.1207, 4);
  });

  test("weekStartOf resolves a Sunday back to its Monday", () => {
    expect(weekStartOf(new Date("2029-04-08T18:00:00.000Z")).toISOString()).toBe(
      "2029-04-02T00:00:00.000Z",
    );
  });
});

describe("entitlement accrues per pay period", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("a hundred hours worked earns just over twelve hours of leave", () => {
    expect(service.accrualForPeriod("p-worked")).toBe(12.069);
  });

  test("hours credited during statutory leave accrue exactly as worked hours do", () => {
    // Eighty worked plus twenty credited earns the same as a hundred worked.
    expect(service.accrualForPeriod("p-credited")).toBe(service.accrualForPeriod("p-worked"));
  });

  test("a period with no hours earns nothing rather than a share of an allowance", () => {
    service.recordPayPeriod(
      period({
        periodId: "p-empty",
        workerId: "w-simple",
        startsOn: new Date("2029-07-02T00:00:00.000Z"),
        endsOn: new Date("2029-07-16T00:00:00.000Z"),
      }),
    );
    expect(service.accrualForPeriod("p-empty")).toBe(0);
  });

  test("a period nobody recorded is an error rather than zero", () => {
    expect(() => service.accrualForPeriod("p-nope")).toThrow(/Unknown pay period/);
  });
});

describe("the leave-year boundary cuts the accrual, not the year", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("a fortnight straddling 1 April is split between the two years", () => {
    const current = service.accrual("w-simple", YEAR_2029_START);
    const previous = service.accrual("w-simple", YEAR_2028_START);

    // Seven of the fourteen days fall each side of the boundary.
    expect(previous.hoursWorked).toBe(70);
    expect(current.hoursWorked).toBe(250);
  });

  test("the earlier year accrues only from its own share", () => {
    expect(service.accrual("w-simple", YEAR_2028_START).cappedAccruedHours).toBe(8.448);
  });

  test("the later year carries the rest of the fortnight and everything after", () => {
    expect(service.accrual("w-simple", YEAR_2029_START).cappedAccruedHours).toBe(32.586);
  });

  test("a date no leave year covers is an error rather than a guess", () => {
    expect(() => service.accrual("w-simple", new Date("2035-01-01T00:00:00.000Z"))).toThrow(
      /No leave year covers/,
    );
  });
});

describe("leave is applied to the year its dates fall in", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("leave taken in May belongs to the year that opened in April", () => {
    expect(service.leaveTakenInYear("w-simple", YEAR_2029_START)).toBe(8);
  });

  test("leave taken in March belongs to the year before it", () => {
    expect(service.leaveTakenInYear("w-simple", YEAR_2028_START)).toBe(8);
  });

  test("the balance is accrued plus carried in, less taken", () => {
    service.setCarriedIn("w-simple", YEAR_2029_START, 4);
    const balance = service.balance("w-simple", YEAR_2029_START);

    expect(balance.accruedHours).toBe(32.586);
    expect(balance.carriedInHours).toBe(4);
    expect(balance.takenHours).toBe(8);
    expect(balance.remainingHours).toBe(28.586);
  });

  test("leave of nothing is rejected on the way in", () => {
    expect(() =>
      service.recordLeaveTaken({
        leaveId: "l-bad",
        workerId: "w-simple",
        takenOn: YEAR_2029_START,
        hours: 0,
      }),
    ).toThrow(/positive number of hours/);
  });
});

describe("the cap the percentage does not apply on its own", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("fifty-two weeks worked accrues more than the statutory maximum by the formula", () => {
    expect(service.accrual("w-full", YEAR_2029_START).rawAccruedHours).toBe(62.759);
  });

  test("and is capped at 5.6 weeks of the worker's own average week", () => {
    const accrual = service.accrual("w-full", YEAR_2029_START);

    expect(accrual.averageWeeklyHours).toBe(10);
    expect(accrual.capHours).toBe(56);
    expect(accrual.cappedAccruedHours).toBe(56);
    expect(accrual.capApplied).toBe(true);
  });

  test("the cap does not bite on a part-year worker", () => {
    const accrual = service.accrual("w-simple", YEAR_2029_START);

    expect(accrual.capApplied).toBe(false);
    expect(accrual.cappedAccruedHours).toBe(accrual.rawAccruedHours);
  });

  test("the cap is measured against the worker's own week, not a full-time one", () => {
    // Ten hours a week gives a cap of 56 hours; a notional 37.5-hour week would
    // give 210 and cap nobody.
    expect(service.accrual("w-full", YEAR_2029_START).capHours).toBe(56);
    expect(service.accrual("w-weekly", YEAR_2029_START).capHours).toBe(56);
  });
});

describe("rolled-up holiday pay has to be paid and itemised", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("a period paid in full and itemised is compliant", () => {
    const compliance = service.periodCompliance("p-worked");

    expect(compliance.duePence).toBe(14483);
    expect(compliance.compliant).toBe(true);
    expect(compliance.problems).toEqual([]);
  });

  test("a period that paid nothing fails on both counts", () => {
    const compliance = service.periodCompliance("p-credited");

    expect(compliance.compliant).toBe(false);
    expect(compliance.problems).toEqual(["ROLLED_UP_NOT_PAID", "ROLLED_UP_NOT_ITEMISED"]);
  });

  test("paying the right amount without itemising it does not discharge the obligation", () => {
    service.recordPayPeriod(
      period({
        periodId: "p-quiet",
        workerId: "w-simple",
        startsOn: new Date("2029-08-06T00:00:00.000Z"),
        endsOn: new Date("2029-08-20T00:00:00.000Z"),
        hoursWorked: 100,
        rolledUpPaidPence: 14483,
        rolledUpItemised: false,
      }),
    );

    const compliance = service.periodCompliance("p-quiet");
    expect(compliance.compliant).toBe(false);
    expect(compliance.problems).toEqual(["ROLLED_UP_NOT_ITEMISED"]);
  });

  test("underpaying is reported distinctly from not paying at all", () => {
    service.recordPayPeriod(
      period({
        periodId: "p-short",
        workerId: "w-simple",
        startsOn: new Date("2029-09-03T00:00:00.000Z"),
        endsOn: new Date("2029-09-17T00:00:00.000Z"),
        hoursWorked: 100,
        rolledUpPaidPence: 10000,
        rolledUpItemised: true,
      }),
    );

    expect(service.periodCompliance("p-short").problems).toEqual(["ROLLED_UP_UNDERPAID"]);
  });

  test("a period with no hours owes nothing and is not reported", () => {
    service.recordPayPeriod(
      period({
        periodId: "p-nil",
        workerId: "w-simple",
        startsOn: new Date("2029-10-01T00:00:00.000Z"),
        endsOn: new Date("2029-10-15T00:00:00.000Z"),
      }),
    );

    expect(service.periodCompliance("p-nil").compliant).toBe(true);
  });

  test("the non-compliant periods come back in date order", () => {
    expect(service.nonCompliantPeriods("w-simple").map((line) => line.periodId)).toEqual([
      "p-straddle",
      "p-credited",
    ]);
  });
});

describe("the reference period skips unpaid weeks rather than averaging them in", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("a worker paid every week has no weeks skipped", () => {
    const reference = service.referencePeriod("w-weekly", new Date("2029-06-15T00:00:00.000Z"));

    expect(reference.weeks).toHaveLength(10);
    expect(reference.weeksSkipped).toBe(0);
    expect(reference.averageWeeklyHours).toBe(10);
  });

  test("the average reflects the weeks actually worked, not the weeks elapsed", () => {
    const reference = service.referencePeriod("w-gappy", new Date("2029-05-14T00:00:00.000Z"));

    expect(reference.weeks).toHaveLength(3);
    expect(reference.weeksSkipped).toBe(3);
    // Three paid weeks at £120. Averaging six weeks would give £60 and be the
    // wrong number in the one calculation nobody can query afterwards.
    expect(reference.averageWeeklyPayPence).toBe(12000);
    expect(reference.averageWeeklyHours).toBe(10);
  });

  test("a rate rise part-way through moves the average without moving the hours", () => {
    const reference = service.referencePeriod("w-weekly", new Date("2029-06-15T00:00:00.000Z"));

    // Five weeks at £120 and five at £150.
    expect(reference.averageWeeklyPayPence).toBe(13500);
  });

  test("a worker with no paid weeks has no average to strike", () => {
    service.registerLeaveYear({
      workerId: "w-none",
      startsOn: YEAR_2029_START,
      endsOn: YEAR_2030_START,
    });

    const reference = service.referencePeriod("w-none", new Date("2029-06-15T00:00:00.000Z"));
    expect(reference.weeks).toEqual([]);
    expect(reference.averageWeeklyPayPence).toBe(0);
  });
});

describe("payment in lieu at termination", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("it uses average weekly pay, not the rate in force on the last day", () => {
    const payment = service.terminationPayInLieu("w-weekly", new Date("2029-06-15T00:00:00.000Z"));

    expect(payment.untakenHours).toBe(12.069);
    expect(payment.weeksOwed).toBe(1.207);
    expect(payment.amountPence).toBe(16295);

    // At the final £15 rate the same balance would come to £181.05, which is
    // the number a naive implementation produces and the worker is not owed.
    expect(payment.amountPence).toBeLessThan(Math.round(1.207 * 15000));
  });

  test("the reference period used comes back with the payment", () => {
    const payment = service.terminationPayInLieu("w-weekly", new Date("2029-06-15T00:00:00.000Z"));

    expect(payment.reference.weeks).toHaveLength(10);
    expect(payment.reason).toContain("10 paid weeks");
  });

  test("leave already taken reduces what is paid in lieu", () => {
    service.recordLeaveTaken({
      leaveId: "l-weekly",
      workerId: "w-weekly",
      takenOn: new Date("2029-05-14T00:00:00.000Z"),
      hours: 10,
    });

    const payment = service.terminationPayInLieu("w-weekly", new Date("2029-06-15T00:00:00.000Z"));
    expect(payment.untakenHours).toBe(2.069);
  });

  test("a worker who took more than they accrued is paid nothing, not a negative", () => {
    service.recordLeaveTaken({
      leaveId: "l-overdrawn",
      workerId: "w-weekly",
      takenOn: new Date("2029-05-14T00:00:00.000Z"),
      hours: 40,
    });

    const payment = service.terminationPayInLieu("w-weekly", new Date("2029-06-15T00:00:00.000Z"));
    expect(payment.untakenHours).toBe(0);
    expect(payment.amountPence).toBe(0);
  });

  test("no paid weeks means no average, and the reason says so", () => {
    service.registerLeaveYear({
      workerId: "w-none",
      startsOn: YEAR_2029_START,
      endsOn: YEAR_2030_START,
    });

    const payment = service.terminationPayInLieu("w-none", new Date("2029-06-15T00:00:00.000Z"));
    expect(payment.amountPence).toBe(0);
    expect(payment.reason).toMatch(/No paid weeks/);
  });
});

describe("carry-over and what lapses", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("an untaken balance lapses by default", () => {
    const assessment = service.carryOverAssessment("w-simple", YEAR_2029_START);

    expect(assessment.untakenHours).toBe(24.586);
    expect(assessment.carriedHours).toBe(0);
    expect(assessment.lapsedHours).toBe(24.586);
    expect(assessment.reasons[0]).toContain("lapsed");
  });

  test("leave the worker was prevented from taking carries", () => {
    const assessment = service.carryOverAssessment("w-simple", YEAR_2029_START, {
      preventedHours: 10,
    });

    expect(assessment.carriedHours).toBe(10);
    expect(assessment.lapsedHours).toBe(14.586);
    expect(assessment.reasons[0]).toContain("prevented");
  });

  test("carry by agreement is separate and reported separately", () => {
    const assessment = service.carryOverAssessment("w-simple", YEAR_2029_START, {
      preventedHours: 10,
      agreedHours: 5,
    });

    expect(assessment.carriedHours).toBe(15);
    expect(assessment.reasons).toHaveLength(3);
    expect(assessment.reasons[1]).toContain("by agreement");
  });

  test("each basis carries only as far as it carries", () => {
    // Ten hours a week: four weeks prevented is 40 hours, 1.6 weeks agreed is 16.
    const assessment = service.carryOverAssessment("w-full", YEAR_2029_START, {
      preventedHours: 50,
      agreedHours: 30,
    });

    expect(assessment.untakenHours).toBe(56);
    expect(assessment.carriedHours).toBe(56);
    expect(assessment.lapsedHours).toBe(0);
    expect(assessment.reasons[0]).toContain("40h");
    expect(assessment.reasons[1]).toContain("16h");
  });

  test("nothing untaken is reported as nothing untaken", () => {
    service.recordLeaveTaken({
      leaveId: "l-all",
      workerId: "w-simple",
      takenOn: new Date("2029-07-16T00:00:00.000Z"),
      hours: 24.586,
    });

    const assessment = service.carryOverAssessment("w-simple", YEAR_2029_START);
    expect(assessment.untakenHours).toBe(0);
    expect(assessment.reasons).toEqual(["No untaken balance at the end of the leave year"]);
  });
});

describe("inputs that cannot be interpreted", () => {
  let service: CasualHolidayAccrualService;

  beforeEach(() => {
    service = build();
  });

  test("a leave year ending before it starts is refused", () => {
    expect(() =>
      service.registerLeaveYear({
        workerId: "w-simple",
        startsOn: YEAR_2030_START,
        endsOn: YEAR_2029_START,
      }),
    ).toThrow(/must end after it starts/);
  });

  test("a pay period ending before it starts is refused", () => {
    expect(() =>
      service.recordPayPeriod(
        period({
          periodId: "p-backwards",
          workerId: "w-simple",
          startsOn: new Date("2029-06-01T00:00:00.000Z"),
          endsOn: new Date("2029-05-01T00:00:00.000Z"),
        }),
      ),
    ).toThrow(/must end after it starts/);
  });

  test("negative hours are refused rather than reducing somebody's entitlement", () => {
    expect(() =>
      service.recordPayPeriod(
        period({
          periodId: "p-negative",
          workerId: "w-simple",
          startsOn: new Date("2029-06-01T00:00:00.000Z"),
          endsOn: new Date("2029-06-15T00:00:00.000Z"),
          hoursWorked: -10,
        }),
      ),
    ).toThrow(/negative hours/);
  });

  test("recording the same period twice replaces rather than duplicates it", () => {
    service.recordPayPeriod(
      period({
        periodId: "p-worked",
        workerId: "w-simple",
        startsOn: new Date("2029-05-07T00:00:00.000Z"),
        endsOn: new Date("2029-05-21T00:00:00.000Z"),
        hoursWorked: 50,
      }),
    );

    expect(service.accrualForPeriod("p-worked")).toBe(6.034);
  });
});
