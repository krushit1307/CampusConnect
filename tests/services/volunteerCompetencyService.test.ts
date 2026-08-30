/**
 * Test suite: Volunteer Competency Currency (#5160)
 * File: tests/services/volunteerCompetencyService.test.ts
 *
 * The cases worth writing down are the ones a spreadsheet of certificates and a
 * "qualified" checkbox both miss: the steward who is current today and lapsed
 * by the shift, the refresher already booked for the week before it, the
 * fixture whose only first aider is being supervised by somebody who is not
 * one, the nine lapsed volunteers notionally supervised by one person, and the
 * certificate nobody has ever looked at.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  VolunteerCompetencyService,
  addMonths,
  type Shift,
  type ShiftAssignment,
} from "../../src/services/volunteerCompetencyService";

const SHIFT_START = new Date("2029-03-14T18:00:00.000Z");

function build(): VolunteerCompetencyService {
  const service = new VolunteerCompetencyService();

  service.registerCompetency({
    competencyId: "comp-first-aid",
    name: "Emergency first aid at work",
    validityMonths: 36,
    graceDays: 0,
    supervisable: true,
    supervisionRatio: 4,
    supervisionCoversFloor: false,
    safetyCritical: true,
  });
  service.registerCompetency({
    competencyId: "comp-safeguarding",
    name: "Safeguarding refresher",
    validityMonths: 12,
    graceDays: 30,
    supervisable: false,
    supervisionRatio: 0,
    supervisionCoversFloor: false,
    safetyCritical: true,
  });
  service.registerCompetency({
    competencyId: "comp-stewarding",
    name: "Event stewarding",
    validityMonths: 24,
    graceDays: 30,
    supervisable: true,
    supervisionRatio: 5,
    supervisionCoversFloor: true,
    safetyCritical: false,
  });
  service.registerCompetency({
    competencyId: "comp-food-hygiene",
    name: "Level 2 food hygiene",
    validityMonths: 36,
    graceDays: 0,
    supervisable: false,
    supervisionRatio: 0,
    supervisionCoversFloor: false,
    safetyCritical: false,
  });

  service.addRoleRequirement({
    roleId: "role-fixture",
    competencyId: "comp-first-aid",
    minimumCount: 1,
    onePerAttendees: 100,
    acceptsUnverifiedEvidence: false,
    supervisionPermitted: true,
  });
  service.addRoleRequirement({
    roleId: "role-major-fixture",
    competencyId: "comp-first-aid",
    minimumCount: 2,
    onePerAttendees: 100,
    acceptsUnverifiedEvidence: false,
    supervisionPermitted: true,
  });
  service.addRoleRequirement({
    roleId: "role-door",
    competencyId: "comp-stewarding",
    minimumCount: 2,
    onePerAttendees: 50,
    acceptsUnverifiedEvidence: true,
    supervisionPermitted: true,
  });
  service.addRoleRequirement({
    roleId: "role-bar",
    competencyId: "comp-food-hygiene",
    minimumCount: 1,
    onePerAttendees: null,
    acceptsUnverifiedEvidence: false,
    supervisionPermitted: false,
  });
  service.addRoleRequirement({
    roleId: "role-welfare",
    competencyId: "comp-safeguarding",
    minimumCount: 1,
    onePerAttendees: null,
    acceptsUnverifiedEvidence: false,
    supervisionPermitted: false,
  });
  service.addRoleRequirement({
    roleId: "role-welfare",
    competencyId: "comp-food-hygiene",
    minimumCount: 1,
    onePerAttendees: null,
    acceptsUnverifiedEvidence: false,
    supervisionPermitted: false,
  });

  return service;
}

function assign(volunteerId: string, asSupervisor = false): ShiftAssignment {
  return { volunteerId, asSupervisor };
}

function shift(overrides: Partial<Shift> & Pick<Shift, "roleId">): Shift {
  return {
    shiftId: "sh-01",
    eventId: "evt-varsity",
    eventName: "Varsity Fixture",
    startsAt: SHIFT_START,
    expectedAttendance: 100,
    assignments: [],
    ...overrides,
  };
}

function findingFor(
  compliance: ReturnType<VolunteerCompetencyService["assessShift"]>,
  competencyId: string,
) {
  const finding = compliance.findings.find((item) => item.competencyId === competencyId);
  if (!finding) throw new Error(`No finding for ${competencyId}`);
  return finding;
}

describe("currency as at the shift date", () => {
  let service: VolunteerCompetencyService;

  beforeEach(() => {
    service = build();
    service.recordAward({
      awardId: "awd-01",
      volunteerId: "vol-priya",
      competencyId: "comp-first-aid",
      awardedOn: new Date("2026-03-01T00:00:00.000Z"),
      verified: true,
    });
  });

  test("a volunteer current when the roster was built can be lapsed by the shift", () => {
    expect(
      service.resolveCurrency("vol-priya", "comp-first-aid", new Date("2029-02-01T00:00:00.000Z"))
        .status,
    ).toBe("CURRENT");
    expect(service.resolveCurrency("vol-priya", "comp-first-aid", SHIFT_START).status).toBe(
      "LAPSED",
    );
  });

  test("a refresher booked before the shift restores currency from the day it is taken", () => {
    service.bookRefresher({
      bookingId: "ref-01",
      volunteerId: "vol-priya",
      competencyId: "comp-first-aid",
      scheduledFor: new Date("2029-03-10T09:00:00.000Z"),
    });

    const resolution = service.resolveCurrency("vol-priya", "comp-first-aid", SHIFT_START);
    expect(resolution.status).toBe("CURRENT");
    expect(resolution.restoredByBookingId).toBe("ref-01");
  });

  test("a refresher booked after the shift does not make the shift compliant", () => {
    service.bookRefresher({
      bookingId: "ref-02",
      volunteerId: "vol-priya",
      competencyId: "comp-first-aid",
      scheduledFor: new Date("2029-03-20T09:00:00.000Z"),
    });

    expect(service.resolveCurrency("vol-priya", "comp-first-aid", SHIFT_START).status).toBe(
      "LAPSED",
    );
  });

  test("a grace period lets a lapsed steward work and the absence of one does not", () => {
    service.recordAward({
      awardId: "awd-02",
      volunteerId: "vol-sam",
      competencyId: "comp-stewarding",
      awardedOn: new Date("2027-03-01T00:00:00.000Z"),
      verified: true,
    });

    expect(service.resolveCurrency("vol-sam", "comp-stewarding", SHIFT_START).status).toBe(
      "IN_GRACE",
    );
    // Same dates, a competency whose grace period is zero.
    expect(service.resolveCurrency("vol-priya", "comp-first-aid", SHIFT_START).status).toBe(
      "LAPSED",
    );
  });

  test("a competency never awarded is distinguishable from one that has lapsed", () => {
    const resolution = service.resolveCurrency("vol-noor", "comp-first-aid", SHIFT_START);
    expect(resolution.status).toBe("NEVER_HELD");
    expect(resolution.expiresOn).toBeNull();
  });

  test("the latest award supersedes the original rather than sitting alongside it", () => {
    service.recordAward({
      awardId: "awd-03",
      volunteerId: "vol-priya",
      competencyId: "comp-first-aid",
      awardedOn: new Date("2028-06-01T00:00:00.000Z"),
      verified: true,
    });

    const resolution = service.resolveCurrency("vol-priya", "comp-first-aid", SHIFT_START);
    expect(resolution.status).toBe("CURRENT");
    expect(resolution.expiresOn).toEqual(new Date("2031-06-01T00:00:00.000Z"));
  });

  test("validity in calendar months clamps at the end of a short month", () => {
    expect(addMonths(new Date("2028-08-31T00:00:00.000Z"), 6)).toEqual(
      new Date("2029-02-28T00:00:00.000Z"),
    );
    expect(addMonths(new Date("2028-01-31T00:00:00.000Z"), 12)).toEqual(
      new Date("2029-01-31T00:00:00.000Z"),
    );
  });
});

describe("requirements as a floor and a ratio at once", () => {
  let service: VolunteerCompetencyService;

  beforeEach(() => {
    service = build();
  });

  test("a large crowd needs the ratio", () => {
    const requirement = service.requirementsForRole("role-fixture")[0];
    expect(service.requiredCountFor(requirement, 250)).toBe(3);
  });

  test("a small crowd still needs the floor", () => {
    const requirement = service.requirementsForRole("role-fixture")[0];
    expect(service.requiredCountFor(requirement, 40)).toBe(1);
    expect(service.requiredCountFor(requirement, 0)).toBe(1);
  });

  test("a requirement that does not scale ignores attendance entirely", () => {
    const requirement = service.requirementsForRole("role-bar")[0];
    expect(service.requiredCountFor(requirement, 900)).toBe(1);
  });
});

describe("supervision substitution", () => {
  let service: VolunteerCompetencyService;

  beforeEach(() => {
    service = build();
    service.recordAward({
      awardId: "awd-lead",
      volunteerId: "vol-lead",
      competencyId: "comp-stewarding",
      awardedOn: new Date("2028-06-01T00:00:00.000Z"),
      verified: true,
    });
    for (const volunteerId of [
      "vol-a",
      "vol-b",
      "vol-c",
      "vol-d",
      "vol-e",
      "vol-f",
      "vol-g",
      "vol-h",
      "vol-i",
    ]) {
      service.recordAward({
        awardId: `awd-${volunteerId}`,
        volunteerId,
        competencyId: "comp-stewarding",
        awardedOn: new Date("2026-01-01T00:00:00.000Z"),
        verified: true,
      });
    }
  });

  test("lapsed stewards inside the supervisor's ratio are covered", () => {
    const compliance = service.assessShift(
      shift({
        roleId: "role-door",
        expectedAttendance: 50,
        assignments: [assign("vol-lead", true), assign("vol-a"), assign("vol-b"), assign("vol-c")],
      }),
    );

    const finding = findingFor(compliance, "comp-stewarding");
    expect(finding.requiredCount).toBe(2);
    expect(finding.outrightCount).toBe(1);
    expect(finding.supervisedCount).toBe(3);
    expect(compliance.compliant).toBe(true);
  });

  test("lapsed stewards beyond the ratio are uncovered, and the remedy is another supervisor", () => {
    const compliance = service.assessShift(
      shift({
        roleId: "role-door",
        expectedAttendance: 400,
        assignments: [
          assign("vol-lead", true),
          ...["vol-a", "vol-b", "vol-c", "vol-d", "vol-e", "vol-f", "vol-g", "vol-h", "vol-i"].map(
            (id) => assign(id),
          ),
        ],
      }),
    );

    const finding = findingFor(compliance, "comp-stewarding");
    expect(finding.requiredCount).toBe(8);
    expect(finding.supervisedCount).toBe(5);
    expect(finding.shortfall).toBe(2);
    expect(finding.remedy).toBe("ADD_SUPERVISOR");
    expect(finding.remedyDetail).toContain("supervision ratio");
  });

  test("a supervisor who has lapsed themselves creates no supervision capacity", () => {
    const compliance = service.assessShift(
      shift({
        roleId: "role-door",
        expectedAttendance: 50,
        assignments: [assign("vol-a", true), assign("vol-b"), assign("vol-c")],
      }),
    );

    const finding = findingFor(compliance, "comp-stewarding");
    expect(finding.outrightCount).toBe(0);
    expect(finding.supervisedCount).toBe(0);
    expect(finding.remedy).toBe("BOOK_REFRESHER");
  });

  test("a fixture whose only first aider is lapsed is a gap, whoever else is on the shift", () => {
    service.recordAward({
      awardId: "awd-fa",
      volunteerId: "vol-priya",
      competencyId: "comp-first-aid",
      awardedOn: new Date("2026-01-01T00:00:00.000Z"),
      verified: true,
    });

    const compliance = service.assessShift(
      shift({
        roleId: "role-fixture",
        expectedAttendance: 60,
        assignments: [assign("vol-lead", true), assign("vol-priya")],
      }),
    );

    const finding = findingFor(compliance, "comp-first-aid");
    expect(finding.shortfall).toBe(1);
    expect(finding.supervisedCount).toBe(0);
    expect(compliance.compliant).toBe(false);
  });

  test("supervision does not reach a floor that exists so that somebody actually holds it", () => {
    service.recordAward({
      awardId: "awd-fa-current",
      volunteerId: "vol-lead",
      competencyId: "comp-first-aid",
      awardedOn: new Date("2028-06-01T00:00:00.000Z"),
      verified: true,
    });
    for (const volunteerId of ["vol-a", "vol-b", "vol-c"]) {
      service.recordAward({
        awardId: `awd-fa-${volunteerId}`,
        volunteerId,
        competencyId: "comp-first-aid",
        awardedOn: new Date("2026-01-01T00:00:00.000Z"),
        verified: true,
      });
    }

    const compliance = service.assessShift(
      shift({
        roleId: "role-major-fixture",
        expectedAttendance: 100,
        assignments: [assign("vol-lead", true), assign("vol-a"), assign("vol-b"), assign("vol-c")],
      }),
    );

    const finding = findingFor(compliance, "comp-first-aid");
    expect(finding.requiredCount).toBe(2);
    expect(finding.outrightCount).toBe(1);
    expect(finding.supervisedCount).toBe(3);
    // Four people counted and the requirement is still not met, because two of
    // them have to hold it outright.
    expect(finding.met).toBe(false);
    expect(finding.shortfall).toBe(1);
    expect(finding.remedy).toBe("BOOK_REFRESHER");
  });

  test("the same shape passes where supervision is allowed to reach the floor", () => {
    const compliance = service.assessShift(
      shift({
        roleId: "role-door",
        expectedAttendance: 50,
        assignments: [assign("vol-lead", true), assign("vol-a")],
      }),
    );

    expect(findingFor(compliance, "comp-stewarding").met).toBe(true);
  });
});

describe("verified and self-declared evidence", () => {
  let service: VolunteerCompetencyService;

  beforeEach(() => {
    service = build();
  });

  test("a role that accepts self-declared evidence counts it", () => {
    for (const volunteerId of ["vol-a", "vol-b"]) {
      service.recordAward({
        awardId: `awd-${volunteerId}`,
        volunteerId,
        competencyId: "comp-stewarding",
        awardedOn: new Date("2028-06-01T00:00:00.000Z"),
        verified: false,
      });
    }

    const compliance = service.assessShift(
      shift({
        roleId: "role-door",
        expectedAttendance: 50,
        assignments: [assign("vol-a"), assign("vol-b")],
      }),
    );

    expect(compliance.compliant).toBe(true);
    expect(findingFor(compliance, "comp-stewarding").outrightCount).toBe(2);
  });

  test("a role that does not accept it reports verification as the cheapest way to close the gap", () => {
    service.recordAward({
      awardId: "awd-food",
      volunteerId: "vol-a",
      competencyId: "comp-food-hygiene",
      awardedOn: new Date("2028-06-01T00:00:00.000Z"),
      verified: false,
    });

    const compliance = service.assessShift(
      shift({ roleId: "role-bar", expectedAttendance: 200, assignments: [assign("vol-a")] }),
    );

    const finding = findingFor(compliance, "comp-food-hygiene");
    expect(finding.outrightCount).toBe(0);
    expect(finding.unverifiedCount).toBe(1);
    expect(finding.remedy).toBe("VERIFY_EVIDENCE");
  });
});

describe("ranking and the roster sweep", () => {
  let service: VolunteerCompetencyService;

  beforeEach(() => {
    service = build();
  });

  test("a safety-critical gap is reported ahead of an administrative one", () => {
    const compliance = service.assessShift(
      shift({ roleId: "role-welfare", expectedAttendance: 80, assignments: [] }),
    );

    expect(compliance.findings.map((finding) => finding.competencyId)).toEqual([
      "comp-safeguarding",
      "comp-food-hygiene",
    ]);
    expect(compliance.findings[0].remedy).toBe("ROSTER_CURRENT_HOLDER");
  });

  test("the roster sweep keeps only the shifts needing something doing, worst and soonest first", () => {
    service.recordAward({
      awardId: "awd-food",
      volunteerId: "vol-a",
      competencyId: "comp-food-hygiene",
      awardedOn: new Date("2028-06-01T00:00:00.000Z"),
      verified: true,
    });

    const compliant = shift({
      shiftId: "sh-bar",
      roleId: "role-bar",
      expectedAttendance: 100,
      assignments: [assign("vol-a")],
    });
    const laterCritical = shift({
      shiftId: "sh-welfare-late",
      roleId: "role-welfare",
      startsAt: new Date("2029-04-01T18:00:00.000Z"),
      assignments: [],
    });
    const soonerCritical = shift({
      shiftId: "sh-welfare-soon",
      roleId: "role-welfare",
      startsAt: new Date("2029-03-20T18:00:00.000Z"),
      assignments: [],
    });

    const sweep = service.assessRoster([compliant, laterCritical, soonerCritical]);
    expect(sweep.map((entry) => entry.shiftId)).toEqual(["sh-welfare-soon", "sh-welfare-late"]);
  });

  test("expiries inside a window come back in the order they will bite", () => {
    service.recordAward({
      awardId: "awd-1",
      volunteerId: "vol-a",
      competencyId: "comp-safeguarding",
      awardedOn: new Date("2028-05-01T00:00:00.000Z"),
      verified: true,
    });
    service.recordAward({
      awardId: "awd-2",
      volunteerId: "vol-b",
      competencyId: "comp-safeguarding",
      awardedOn: new Date("2028-03-01T00:00:00.000Z"),
      verified: true,
    });
    service.recordAward({
      awardId: "awd-3",
      volunteerId: "vol-c",
      competencyId: "comp-stewarding",
      awardedOn: new Date("2028-06-01T00:00:00.000Z"),
      verified: true,
    });

    const expiring = service.expiringBetween(
      new Date("2029-01-01T00:00:00.000Z"),
      new Date("2029-06-01T00:00:00.000Z"),
    );

    expect(expiring.map((entry) => entry.volunteerId)).toEqual(["vol-b", "vol-a"]);
  });
});
