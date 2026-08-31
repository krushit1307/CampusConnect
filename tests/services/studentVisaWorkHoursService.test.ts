/**
 * Test suite: Student Visa Work-Hour Compliance (#5257)
 * File: tests/services/studentVisaWorkHoursService.test.ts
 *
 * The cases worth writing down are the ones a per-rota hours check cannot
 * fail: the Sunday bar shift that ends at 02:00 and lands in two weeks, the
 * twelve hours at the bar plus ten at the sports centre that neither rota can
 * see, the student whose vacation started a fortnight before their coursemates'
 * did, the shift that crosses the last day of term, and the visa that expires
 * between the roster being published and the shift being worked.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  StudentVisaWorkHoursService,
  weekStartOf,
  type Shift,
} from "../../src/services/studentVisaWorkHoursService";

const PROG_A = "prog-a";
/** Same institution, vacation a fortnight earlier. */
const PROG_B = "prog-b";
/** Vacation starting mid-week, so a boundary falls inside a single week. */
const PROG_C = "prog-c";

const WEEK_FEB_05 = new Date("2029-02-05T00:00:00.000Z");
const WEEK_FEB_12 = new Date("2029-02-12T00:00:00.000Z");
const WEEK_MAR_12 = new Date("2029-03-12T00:00:00.000Z");

const CHECKED_ON = new Date("2028-09-01T00:00:00.000Z");
const FAR_EXPIRY = new Date("2030-06-30T00:00:00.000Z");

function build(): StudentVisaWorkHoursService {
  const service = new StudentVisaWorkHoursService();

  service.registerWorker({
    workerId: "w-degree",
    programmeId: PROG_A,
    status: "STUDENT_VISA",
    studyLevel: "DEGREE_OR_ABOVE",
  });
  service.registerWorker({
    workerId: "w-early-vacation",
    programmeId: PROG_B,
    status: "STUDENT_VISA",
    studyLevel: "DEGREE_OR_ABOVE",
  });
  service.registerWorker({
    workerId: "w-midweek",
    programmeId: PROG_C,
    status: "STUDENT_VISA",
    studyLevel: "DEGREE_OR_ABOVE",
  });
  service.registerWorker({
    workerId: "w-below-degree",
    programmeId: PROG_A,
    status: "STUDENT_VISA",
    studyLevel: "BELOW_DEGREE",
  });
  service.registerWorker({
    workerId: "w-unrestricted",
    programmeId: PROG_A,
    status: "UNRESTRICTED",
    studyLevel: "DEGREE_OR_ABOVE",
  });
  service.registerWorker({
    workerId: "w-short-term",
    programmeId: PROG_A,
    status: "SHORT_TERM_STUDY",
    studyLevel: "DEGREE_OR_ABOVE",
  });
  service.registerWorker({
    workerId: "w-expiring",
    programmeId: PROG_A,
    status: "STUDENT_VISA",
    studyLevel: "DEGREE_OR_ABOVE",
  });
  service.registerWorker({
    workerId: "w-unchecked",
    programmeId: PROG_A,
    status: "STUDENT_VISA",
    studyLevel: "DEGREE_OR_ABOVE",
  });

  // Standard calendar.
  service.registerTermPeriod({
    programmeId: PROG_A,
    kind: "TERM",
    startsOn: new Date("2029-01-08T00:00:00.000Z"),
    endsOn: new Date("2029-03-26T00:00:00.000Z"),
  });
  service.registerTermPeriod({
    programmeId: PROG_A,
    kind: "VACATION",
    startsOn: new Date("2029-03-26T00:00:00.000Z"),
    endsOn: new Date("2029-04-23T00:00:00.000Z"),
  });

  // Same weeks, vacation a fortnight earlier.
  service.registerTermPeriod({
    programmeId: PROG_B,
    kind: "TERM",
    startsOn: new Date("2029-01-08T00:00:00.000Z"),
    endsOn: new Date("2029-03-12T00:00:00.000Z"),
  });
  service.registerTermPeriod({
    programmeId: PROG_B,
    kind: "VACATION",
    startsOn: new Date("2029-03-12T00:00:00.000Z"),
    endsOn: new Date("2029-04-23T00:00:00.000Z"),
  });

  // Vacation opens on the Wednesday, mid-week.
  service.registerTermPeriod({
    programmeId: PROG_C,
    kind: "TERM",
    startsOn: new Date("2029-01-08T00:00:00.000Z"),
    endsOn: new Date("2029-03-14T00:00:00.000Z"),
  });
  service.registerTermPeriod({
    programmeId: PROG_C,
    kind: "VACATION",
    startsOn: new Date("2029-03-14T00:00:00.000Z"),
    endsOn: new Date("2029-04-23T00:00:00.000Z"),
  });

  for (const workerId of [
    "w-degree",
    "w-early-vacation",
    "w-midweek",
    "w-below-degree",
    "w-unrestricted",
    "w-short-term",
  ]) {
    service.registerDocument({
      workerId,
      type: "SHARE_CODE",
      checkedOn: CHECKED_ON,
      expiresOn: FAR_EXPIRY,
    });
  }

  // Checked in good time, expires before the February shifts are worked.
  service.registerDocument({
    workerId: "w-expiring",
    type: "BIOMETRIC_RESIDENCE_PERMIT",
    checkedOn: CHECKED_ON,
    expiresOn: new Date("2029-02-01T00:00:00.000Z"),
  });

  return service;
}

/** A shift of `hours` starting at `start`, for the worker and employer given. */
function block(
  shiftId: string,
  workerId: string,
  employerId: string,
  start: string,
  hours: number,
  state: Shift["state"] = "ROSTERED",
): Shift {
  const startsAt = new Date(start);
  return {
    shiftId,
    workerId,
    employerId,
    rotaId: `rota-${employerId}`,
    startsAt,
    endsAt: new Date(startsAt.getTime() + hours * 60 * 60 * 1000),
    state,
  };
}

describe("weekStartOf", () => {
  test("a Sunday belongs to the week that began on the preceding Monday", () => {
    expect(weekStartOf(new Date("2029-02-11T23:30:00.000Z")).toISOString()).toBe(
      "2029-02-05T00:00:00.000Z",
    );
  });

  test("a Monday at midnight is the start of its own week", () => {
    expect(weekStartOf(WEEK_FEB_12).toISOString()).toBe("2029-02-12T00:00:00.000Z");
  });

  test("a Monday later in the day still resolves to that Monday's midnight", () => {
    expect(weekStartOf(new Date("2029-02-12T17:45:00.000Z")).toISOString()).toBe(
      "2029-02-12T00:00:00.000Z",
    );
  });
});

describe("cap resolution", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
  });

  test("degree-level study on the Student route carries the twenty-hour cap", () => {
    expect(service.capFor("w-degree")).toBe(20);
  });

  test("below degree level carries the lower cap", () => {
    expect(service.capFor("w-below-degree")).toBe(10);
  });

  test("an unrestricted worker carries no cap at all, which is not a cap of zero", () => {
    expect(service.capFor("w-unrestricted")).toBeNull();
  });

  test("short-term study is a cap of zero rather than an absence of one", () => {
    expect(service.capFor("w-short-term")).toBe(0);
  });

  test("an unknown worker is an error rather than an unrestricted default", () => {
    expect(() => service.capFor("w-nobody")).toThrow(/Unknown worker/);
  });
});

describe("shifts that straddle a week boundary", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
  });

  test("a Sunday night shift ending at 02:00 contributes to both weeks", () => {
    // Sunday 20:00 to Monday 02:00: four hours one side, two the other.
    const overnight = block("s-overnight", "w-degree", "emp-bar", "2029-02-11T20:00:00.000Z", 6);
    const segments = service.segmentsFor(overnight);

    expect(segments).toHaveLength(2);
    expect(segments[0].weekStart.toISOString()).toBe("2029-02-05T00:00:00.000Z");
    expect(segments[0].restrictedHours).toBe(4);
    expect(segments[1].weekStart.toISOString()).toBe("2029-02-12T00:00:00.000Z");
    expect(segments[1].restrictedHours).toBe(2);
  });

  test("the split lands in the weekly aggregate on both sides", () => {
    service.recordShift(block("s-overnight", "w-degree", "emp-bar", "2029-02-11T20:00:00.000Z", 6));

    expect(service.weeklyLoad("w-degree", WEEK_FEB_05).restrictedHours).toBe(4);
    expect(service.weeklyLoad("w-degree", WEEK_FEB_12).restrictedHours).toBe(2);
  });

  test("a shift wholly inside one week produces a single segment", () => {
    const daytime = block("s-day", "w-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 5);
    expect(service.segmentsFor(daytime)).toHaveLength(1);
  });
});

describe("aggregation across rotas", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
    service.recordShift(block("s-bar", "w-degree", "emp-bar", "2029-02-06T17:00:00.000Z", 12));
    service.recordShift(block("s-sport", "w-degree", "emp-sport", "2029-02-08T09:00:00.000Z", 10));
  });

  test("neither rota breaches on its own but the aggregate does", () => {
    const load = service.weeklyLoad("w-degree", WEEK_FEB_05);
    expect(load.restrictedHours).toBe(22);
    expect(load.capHours).toBe(20);
    expect(load.employerIds).toEqual(["emp-bar", "emp-sport"]);
  });

  test("the breach names every employer contributing to the week", () => {
    const breaches = service.detectBreaches(
      "w-degree",
      WEEK_FEB_05,
      WEEK_FEB_05,
      new Date("2029-02-20T00:00:00.000Z"),
    );

    expect(breaches).toHaveLength(1);
    expect(breaches[0].excessHours).toBe(2);
    expect(breaches[0].employerIds).toEqual(["emp-bar", "emp-sport"]);
  });

  test("headroom is reported as zero rather than negative once the cap is passed", () => {
    expect(service.headroom("w-degree", WEEK_FEB_05)).toBe(0);
  });

  test("a cancelled shift stops counting", () => {
    service.recordShift(
      block("s-sport", "w-degree", "emp-sport", "2029-02-08T09:00:00.000Z", 10, "CANCELLED"),
    );
    expect(service.weeklyLoad("w-degree", WEEK_FEB_05).restrictedHours).toBe(12);
  });
});

describe("the cap is weekly and not an average", () => {
  test("twenty-five hours then fifteen is a breach followed by a compliant week", () => {
    const service = build();
    service.recordShift(block("s-heavy", "w-degree", "emp-bar", "2029-02-05T09:00:00.000Z", 25));
    service.recordShift(block("s-light", "w-degree", "emp-bar", "2029-02-12T09:00:00.000Z", 15));

    const breaches = service.detectBreaches(
      "w-degree",
      WEEK_FEB_05,
      WEEK_FEB_12,
      new Date("2029-03-01T00:00:00.000Z"),
    );

    expect(breaches).toHaveLength(1);
    expect(breaches[0].weekStart.toISOString()).toBe("2029-02-05T00:00:00.000Z");
    expect(breaches[0].restrictedHours).toBe(25);
  });
});

describe("the programme calendar rather than an institutional one", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
    // The same week, the same hours, two students on different programmes.
    service.recordShift(block("s-a", "w-degree", "emp-bar", "2029-03-13T09:00:00.000Z", 24));
    service.recordShift(
      block("s-b", "w-early-vacation", "emp-bar", "2029-03-13T09:00:00.000Z", 24),
    );
  });

  test("the student still in term is capped", () => {
    const load = service.weeklyLoad("w-degree", WEEK_MAR_12);
    expect(load.restrictedHours).toBe(24);
    expect(load.unrestrictedHours).toBe(0);
    expect(load.headroomHours).toBe(0);
  });

  test("the student whose vacation started early is unrestricted in the same week", () => {
    const load = service.weeklyLoad("w-early-vacation", WEEK_MAR_12);
    expect(load.restrictedHours).toBe(0);
    expect(load.unrestrictedHours).toBe(24);
    expect(load.headroomHours).toBe(20);
  });

  test("only the student in term is in breach", () => {
    const asOf = new Date("2029-04-01T00:00:00.000Z");
    expect(service.detectBreaches("w-degree", WEEK_MAR_12, WEEK_MAR_12, asOf)).toHaveLength(1);
    expect(service.detectBreaches("w-early-vacation", WEEK_MAR_12, WEEK_MAR_12, asOf)).toHaveLength(
      0,
    );
  });
});

describe("shifts that cross the term boundary", () => {
  test("only the term-time portion counts against the cap", () => {
    const service = build();
    // Tuesday 22:00 to Wednesday 06:00, with vacation opening at Wednesday 00:00.
    service.recordShift(block("s-boundary", "w-midweek", "emp-bar", "2029-03-13T22:00:00.000Z", 8));

    const load = service.weeklyLoad("w-midweek", WEEK_MAR_12);
    expect(load.restrictedHours).toBe(2);
    expect(load.unrestrictedHours).toBe(6);
  });

  test("a shift wholly in vacation counts nothing against the cap", () => {
    const service = build();
    service.recordShift(block("s-vac", "w-midweek", "emp-bar", "2029-03-19T09:00:00.000Z", 30));

    const load = service.weeklyLoad("w-midweek", new Date("2029-03-19T00:00:00.000Z"));
    expect(load.restrictedHours).toBe(0);
    expect(load.unrestrictedHours).toBe(30);
  });
});

describe("right to work as at the date of the shift", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
  });

  test("evidence valid today but expired by the shift date blocks the shift", () => {
    const assessment = service.assessProposedShift(
      block("s-late", "w-expiring", "emp-bar", "2029-02-06T09:00:00.000Z", 4),
    );

    expect(assessment.permitted).toBe(false);
    expect(assessment.blockers.map((blocker) => blocker.kind)).toContain("RIGHT_TO_WORK_EXPIRED");
    expect(assessment.blockers[0].detail).toContain("2029-02-01");
  });

  test("the same evidence permits a shift falling inside its validity", () => {
    const assessment = service.assessProposedShift(
      block("s-early", "w-expiring", "emp-bar", "2029-01-15T09:00:00.000Z", 4),
    );
    expect(assessment.permitted).toBe(true);
  });

  test("a worker with no recorded check is blocked distinctly from an expired one", () => {
    const assessment = service.assessProposedShift(
      block("s-none", "w-unchecked", "emp-bar", "2029-02-06T09:00:00.000Z", 4),
    );

    expect(assessment.blockers.map((blocker) => blocker.kind)).toEqual([
      "NO_RIGHT_TO_WORK_EVIDENCE",
    ]);
  });

  test("evidence that never expires stays valid indefinitely", () => {
    service.registerDocument({
      workerId: "w-unchecked",
      type: "PASSPORT",
      checkedOn: CHECKED_ON,
      expiresOn: null,
    });
    expect(
      service.rightToWorkBlockers("w-unchecked", new Date("2035-01-01T00:00:00.000Z")),
    ).toEqual([]);
  });
});

describe("assessing a shift before it is confirmed", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
    service.recordShift(block("s-bar", "w-degree", "emp-bar", "2029-02-06T17:00:00.000Z", 16));
  });

  test("the proposal is measured against the hours already on other rotas", () => {
    const assessment = service.assessProposedShift(
      block("s-new", "w-degree", "emp-sport", "2029-02-08T09:00:00.000Z", 6),
    );

    expect(assessment.permitted).toBe(false);
    const blocker = assessment.blockers.find((b) => b.kind === "WEEKLY_CAP_EXCEEDED");
    expect(blocker?.detail).toContain("22h");
    expect(blocker?.remedy).toContain("2h");
  });

  test("a proposal inside the headroom is permitted", () => {
    const assessment = service.assessProposedShift(
      block("s-new", "w-degree", "emp-sport", "2029-02-08T09:00:00.000Z", 4),
    );

    expect(assessment.permitted).toBe(true);
    expect(assessment.resultingLoad[0].restrictedHours).toBe(20);
    expect(assessment.resultingLoad[0].headroomHours).toBe(0);
  });

  test("re-assessing a stored shift does not count it twice", () => {
    const assessment = service.assessProposedShift(
      block("s-bar", "w-degree", "emp-bar", "2029-02-06T17:00:00.000Z", 16),
    );
    expect(assessment.resultingLoad[0].restrictedHours).toBe(16);
    expect(assessment.permitted).toBe(true);
  });

  test("a proposal straddling the week boundary reports both weeks", () => {
    const assessment = service.assessProposedShift(
      block("s-over", "w-degree", "emp-sport", "2029-02-11T20:00:00.000Z", 6),
    );
    expect(assessment.resultingLoad).toHaveLength(2);
    expect(assessment.resultingLoad[0].restrictedHours).toBe(20);
    expect(assessment.resultingLoad[1].restrictedHours).toBe(2);
  });
});

describe("statuses that are not simply a smaller cap", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
  });

  test("short-term study is refused as work not permitted, not as a cap breach", () => {
    const assessment = service.assessProposedShift(
      block("s-any", "w-short-term", "emp-bar", "2029-02-06T09:00:00.000Z", 2),
    );

    expect(assessment.permitted).toBe(false);
    expect(assessment.blockers.map((blocker) => blocker.kind)).toEqual(["WORK_NOT_PERMITTED"]);
  });

  test("an unrestricted worker is never blocked on hours", () => {
    service.recordShift(
      block("s-long", "w-unrestricted", "emp-bar", "2029-02-05T06:00:00.000Z", 50),
    );

    const load = service.weeklyLoad("w-unrestricted", WEEK_FEB_05);
    expect(load.capHours).toBeNull();
    expect(load.headroomHours).toBeNull();
    expect(
      service.detectBreaches("w-unrestricted", WEEK_FEB_05, WEEK_FEB_05, new Date("2029-03-01")),
    ).toEqual([]);
  });

  test("the lower cap applies to below-degree study", () => {
    service.recordShift(block("s-12", "w-below-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 12));

    const breaches = service.detectBreaches(
      "w-below-degree",
      WEEK_FEB_05,
      WEEK_FEB_05,
      new Date("2029-03-01T00:00:00.000Z"),
    );
    expect(breaches[0].capHours).toBe(10);
    expect(breaches[0].excessHours).toBe(2);
  });
});

describe("breaches already worked against breaches still preventable", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
  });

  test("a week that has finished is reported as already worked", () => {
    service.recordShift(block("s-past", "w-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 24));

    const breaches = service.detectBreaches(
      "w-degree",
      WEEK_FEB_05,
      WEEK_FEB_05,
      new Date("2029-02-20T00:00:00.000Z"),
    );
    expect(breaches[0].timing).toBe("ALREADY_WORKED");
  });

  test("a week still ahead is reported as preventable", () => {
    service.recordShift(block("s-future", "w-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 24));

    const breaches = service.detectBreaches(
      "w-degree",
      WEEK_FEB_05,
      WEEK_FEB_05,
      new Date("2029-02-01T00:00:00.000Z"),
    );
    expect(breaches[0].timing).toBe("STILL_PREVENTABLE");
  });

  test("a shift marked worked is already worked even inside an open week", () => {
    service.recordShift(
      block("s-done", "w-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 24, "WORKED"),
    );

    const breaches = service.detectBreaches(
      "w-degree",
      WEEK_FEB_05,
      WEEK_FEB_05,
      new Date("2029-02-07T12:00:00.000Z"),
    );
    expect(breaches[0].timing).toBe("ALREADY_WORKED");
  });

  test("a compliant range produces no breaches", () => {
    service.recordShift(block("s-ok", "w-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 8));
    expect(
      service.detectBreaches("w-degree", WEEK_FEB_05, WEEK_FEB_12, new Date("2029-03-01")),
    ).toEqual([]);
  });
});

describe("calendar coverage", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
  });

  test("time the calendar does not cover counts as term time", () => {
    // September sits outside every registered period for this programme.
    service.recordShift(block("s-sept", "w-degree", "emp-bar", "2029-09-04T09:00:00.000Z", 30));

    const load = service.weeklyLoad("w-degree", new Date("2029-09-03T00:00:00.000Z"));
    expect(load.restrictedHours).toBe(30);
    expect(load.unrestrictedHours).toBe(0);
  });

  test("the uncovered stretches are reported so the omission is visible", () => {
    const gaps = service.calendarGaps(
      PROG_A,
      new Date("2029-01-01T00:00:00.000Z"),
      new Date("2029-05-01T00:00:00.000Z"),
    );

    expect(gaps).toHaveLength(2);
    expect(gaps[0].to.toISOString()).toBe("2029-01-08T00:00:00.000Z");
    expect(gaps[1].from.toISOString()).toBe("2029-04-23T00:00:00.000Z");
  });

  test("a fully covered range reports no gaps", () => {
    const gaps = service.calendarGaps(
      PROG_A,
      new Date("2029-01-08T00:00:00.000Z"),
      new Date("2029-04-23T00:00:00.000Z"),
    );
    expect(gaps).toEqual([]);
  });
});

describe("inputs that cannot be interpreted", () => {
  let service: StudentVisaWorkHoursService;

  beforeEach(() => {
    service = build();
  });

  test("a shift ending before it starts is rejected on the way in", () => {
    expect(() =>
      service.recordShift({
        shiftId: "s-bad",
        workerId: "w-degree",
        employerId: "emp-bar",
        rotaId: "rota-bar",
        startsAt: new Date("2029-02-06T12:00:00.000Z"),
        endsAt: new Date("2029-02-06T09:00:00.000Z"),
        state: "ROSTERED",
      }),
    ).toThrow(/must end after it starts/);
  });

  test("a term period ending before it starts is rejected on the way in", () => {
    expect(() =>
      service.registerTermPeriod({
        programmeId: PROG_A,
        kind: "TERM",
        startsOn: new Date("2029-03-01T00:00:00.000Z"),
        endsOn: new Date("2029-02-01T00:00:00.000Z"),
      }),
    ).toThrow(/must end after it starts/);
  });

  test("recording the same shift id twice replaces rather than duplicates it", () => {
    service.recordShift(block("s-one", "w-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 8));
    service.recordShift(block("s-one", "w-degree", "emp-bar", "2029-02-06T09:00:00.000Z", 5));
    expect(service.weeklyLoad("w-degree", WEEK_FEB_05).restrictedHours).toBe(5);
  });

  test("a shift for a worker who does not exist is an error rather than a silent skip", () => {
    expect(() =>
      service.segmentsFor(block("s-ghost", "w-nobody", "emp-bar", "2029-02-06T09:00:00.000Z", 4)),
    ).toThrow(/Unknown worker/);
  });
});
