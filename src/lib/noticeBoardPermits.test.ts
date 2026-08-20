import { describe, it, expect } from "vitest";
import {
  DEFAULT_PERMIT_POLICY,
  buildOccupancy,
  clubTakedownRecords,
  durationDays,
  evaluatePermitRequest,
  findEarliestFit,
  formatDay,
  overdueTakedowns,
  parseDay,
  peakOccupancyWindow,
  permitsOverlap,
  takedownStateLabel,
  takedownStatus,
  toDayString,
  utilisationRate,
  type NoticeBoard,
  type PosterPermit,
} from "./noticeBoardPermits";

const BOARD: NoticeBoard = {
  id: "b1",
  name: "Canteen board",
  building: "Main block",
  locationDetail: "Outside the servery",
  slotCapacity: 3,
  isActive: true,
  requiresApproval: true,
};

function permit(
  id: string,
  startsOn: string,
  endsOn: string,
  overrides: Partial<PosterPermit> = {},
): PosterPermit {
  return {
    id,
    boardId: "b1",
    clubId: "club-a",
    clubName: "Debate Society",
    title: `Poster ${id}`,
    startsOn,
    endsOn,
    slotsRequested: 1,
    status: "approved",
    takedownOwnerName: "Meera Iyer",
    takenDownAt: null,
    ...overrides,
  };
}

const day = (iso: string) => parseDay(iso);

describe("durationDays", () => {
  it("counts a single-day permit as one day", () => {
    expect(durationDays("2026-06-05", "2026-06-05")).toBe(1);
  });

  it("counts both end days inclusively", () => {
    expect(durationDays("2026-06-05", "2026-06-12")).toBe(8);
  });

  it("returns zero for unreadable dates", () => {
    expect(durationDays("nope", "2026-06-12")).toBe(0);
  });
});

describe("permitsOverlap", () => {
  it("detects a straightforward overlap", () => {
    expect(
      permitsOverlap(
        permit("a", "2026-06-05", "2026-06-12"),
        permit("b", "2026-06-10", "2026-06-15"),
      ),
    ).toBe(true);
  });

  it("treats a shared end/start day as an overlap — both posters are up", () => {
    // `endsOn` is the last day the poster is on the board, so a permit
    // ending on the 12th and one starting on the 12th both occupy it.
    expect(
      permitsOverlap(
        permit("a", "2026-06-05", "2026-06-12"),
        permit("b", "2026-06-12", "2026-06-18"),
      ),
    ).toBe(true);
  });

  it("does not overlap when a full day separates them", () => {
    expect(
      permitsOverlap(
        permit("a", "2026-06-05", "2026-06-12"),
        permit("b", "2026-06-13", "2026-06-18"),
      ),
    ).toBe(false);
  });

  it("detects containment in both directions", () => {
    const outer = permit("a", "2026-06-01", "2026-06-30");
    const inner = permit("b", "2026-06-10", "2026-06-12");
    expect(permitsOverlap(outer, inner)).toBe(true);
    expect(permitsOverlap(inner, outer)).toBe(true);
  });
});

describe("buildOccupancy", () => {
  it("reports zero usage on an empty board", () => {
    const occupancy = buildOccupancy(BOARD, [], "2026-06-05", "2026-06-07");
    expect(occupancy).toHaveLength(3);
    expect(occupancy.every((d) => d.slotsUsed === 0)).toBe(true);
  });

  it("counts a permit on every day it spans, inclusively", () => {
    const occupancy = buildOccupancy(
      BOARD,
      [permit("p1", "2026-06-05", "2026-06-07")],
      "2026-06-04",
      "2026-06-08",
    );
    expect(occupancy.map((d) => d.slotsUsed)).toEqual([0, 1, 1, 1, 0]);
  });

  it("sums slots when several permits share a day", () => {
    const occupancy = buildOccupancy(
      BOARD,
      [
        permit("p1", "2026-06-05", "2026-06-07", { slotsRequested: 2 }),
        permit("p2", "2026-06-06", "2026-06-06", { slotsRequested: 1 }),
      ],
      "2026-06-05",
      "2026-06-07",
    );
    expect(occupancy.map((d) => d.slotsUsed)).toEqual([2, 3, 2]);
  });

  it("ignores pending, rejected and taken-down permits", () => {
    const occupancy = buildOccupancy(
      BOARD,
      [
        permit("p1", "2026-06-05", "2026-06-07", { status: "pending" }),
        permit("p2", "2026-06-05", "2026-06-07", { status: "rejected" }),
        permit("p3", "2026-06-05", "2026-06-07", { status: "taken_down" }),
        permit("p4", "2026-06-05", "2026-06-07", { status: "withdrawn" }),
      ],
      "2026-06-05",
      "2026-06-07",
    );
    expect(occupancy.every((d) => d.slotsUsed === 0)).toBe(true);
  });

  it("ignores permits belonging to a different board", () => {
    const occupancy = buildOccupancy(
      BOARD,
      [permit("p1", "2026-06-05", "2026-06-07", { boardId: "other" })],
      "2026-06-05",
      "2026-06-07",
    );
    expect(occupancy.every((d) => d.slotsUsed === 0)).toBe(true);
  });

  it("returns nothing for an inverted range", () => {
    expect(buildOccupancy(BOARD, [], "2026-06-07", "2026-06-05")).toEqual([]);
  });
});

describe("evaluatePermitRequest", () => {
  const request = {
    clubId: "club-b",
    startsOn: "2026-06-05",
    endsOn: "2026-06-12",
    slotsRequested: 1,
  };

  it("grants a request on an empty board", () => {
    const decision = evaluatePermitRequest(BOARD, [], request);
    expect(decision.grantable).toBe(true);
    expect(decision.reason).toBeNull();
    expect(decision.conflictingDays).toEqual([]);
  });

  it("grants a request that fits alongside existing permits", () => {
    const decision = evaluatePermitRequest(
      BOARD,
      [permit("p1", "2026-06-05", "2026-06-12", { slotsRequested: 2 })],
      request,
    );
    expect(decision.grantable).toBe(true);
    expect(decision.peakUsage).toBe(3);
  });

  it("refuses when a single day inside the range is full", () => {
    // The board is full only on the 8th, but that is enough to refuse.
    const decision = evaluatePermitRequest(
      BOARD,
      [permit("p1", "2026-06-08", "2026-06-08", { slotsRequested: 3 })],
      request,
    );
    expect(decision.grantable).toBe(false);
    expect(decision.reason).toBe("insufficient_capacity");
    expect(decision.conflictingDays).toEqual([day("2026-06-08")]);
    expect(decision.message).toMatch(/full on 1 of the 8 requested days/);
  });

  it("reports every conflicting day, not just the first", () => {
    const decision = evaluatePermitRequest(
      BOARD,
      [permit("p1", "2026-06-06", "2026-06-09", { slotsRequested: 3 })],
      request,
    );
    expect(decision.conflictingDays).toHaveLength(4);
  });

  it("suggests the earliest date the request would fit", () => {
    const decision = evaluatePermitRequest(
      BOARD,
      [permit("p1", "2026-06-05", "2026-06-12", { slotsRequested: 3 })],
      request,
    );
    expect(decision.grantable).toBe(false);
    expect(decision.earliestAlternativeStart).toBe("2026-06-13");
  });

  it("refuses a request for more slots than the board physically has", () => {
    const decision = evaluatePermitRequest(BOARD, [], {
      ...request,
      slotsRequested: 5,
    });
    expect(decision.reason).toBe("slots_exceed_board");
    expect(decision.message).toMatch(/only 3 slots/);
  });

  it("refuses a permit longer than the policy allows", () => {
    const decision = evaluatePermitRequest(BOARD, [], {
      ...request,
      endsOn: "2026-08-01",
    });
    expect(decision.reason).toBe("exceeds_max_duration");
  });

  it("enforces the per-club concurrent permit cap", () => {
    const existing = [
      permit("p1", "2026-06-05", "2026-06-08", { clubId: "club-b" }),
      permit("p2", "2026-06-09", "2026-06-12", { clubId: "club-b" }),
    ];
    const decision = evaluatePermitRequest(BOARD, existing, request);
    expect(decision.reason).toBe("exceeds_club_concurrent_cap");
    expect(decision.message).toMatch(/limit is 2/);
  });

  it("does not count another club's permits toward the cap", () => {
    const existing = [
      permit("p1", "2026-06-05", "2026-06-08", { clubId: "club-z" }),
      permit("p2", "2026-06-09", "2026-06-12", { clubId: "club-z" }),
    ];
    const decision = evaluatePermitRequest(BOARD, existing, request);
    expect(decision.grantable).toBe(true);
  });

  it("does not count a club's non-overlapping permits toward the cap", () => {
    const existing = [
      permit("p1", "2026-01-05", "2026-01-08", { clubId: "club-b" }),
      permit("p2", "2026-02-09", "2026-02-12", { clubId: "club-b" }),
    ];
    const decision = evaluatePermitRequest(BOARD, existing, request);
    expect(decision.grantable).toBe(true);
  });

  it("refuses a request against an inactive board", () => {
    const decision = evaluatePermitRequest({ ...BOARD, isActive: false }, [], request);
    expect(decision.reason).toBe("board_inactive");
  });

  it("refuses a permit that ends before it begins", () => {
    const decision = evaluatePermitRequest(BOARD, [], {
      ...request,
      startsOn: "2026-06-12",
      endsOn: "2026-06-05",
    });
    expect(decision.reason).toBe("end_before_start");
  });

  it("refuses unreadable dates rather than guessing", () => {
    const decision = evaluatePermitRequest(BOARD, [], {
      ...request,
      startsOn: "not-a-date",
    });
    expect(decision.reason).toBe("invalid_dates");
  });
});

describe("findEarliestFit", () => {
  it("returns null when the board never frees up inside the horizon", () => {
    const blocking = permit("p1", "2026-06-05", "2026-12-31", {
      slotsRequested: 3,
    });
    const found = findEarliestFit(
      BOARD,
      [blocking],
      { startsOn: "2026-06-05", slotsRequested: 1 },
      8,
      30,
    );
    expect(found).toBeNull();
  });

  it("finds the first date the whole duration fits", () => {
    const found = findEarliestFit(
      BOARD,
      [permit("p1", "2026-06-05", "2026-06-10", { slotsRequested: 3 })],
      { startsOn: "2026-06-05", slotsRequested: 1 },
      3,
      30,
    );
    expect(found).toBe("2026-06-11");
  });
});

describe("peakOccupancyWindow", () => {
  it("returns null for an empty range", () => {
    expect(peakOccupancyWindow([])).toBeNull();
  });

  it("identifies the busiest contiguous stretch", () => {
    const occupancy = buildOccupancy(
      BOARD,
      [
        permit("p1", "2026-06-05", "2026-06-10", { slotsRequested: 1 }),
        permit("p2", "2026-06-07", "2026-06-08", { slotsRequested: 2 }),
      ],
      "2026-06-05",
      "2026-06-10",
    );
    const peak = peakOccupancyWindow(occupancy)!;
    expect(peak.slotsUsed).toBe(3);
    expect(peak.startMs).toBe(day("2026-06-07"));
    expect(peak.endMs).toBe(day("2026-06-08"));
  });
});

describe("takedownStatus", () => {
  const today = new Date("2026-06-10T09:00:00.000Z");

  it("reports a future permit as scheduled", () => {
    const status = takedownStatus(permit("p1", "2026-06-15", "2026-06-20"), today);
    expect(status.state).toBe("scheduled");
    expect(status.message).toMatch(/Goes up on 2026-06-15/);
  });

  it("reports a permit with plenty of time left as active", () => {
    const status = takedownStatus(permit("p1", "2026-06-05", "2026-06-20"), today);
    expect(status.state).toBe("active");
    expect(status.daysRemaining).toBe(10);
  });

  it("reports a permit inside the reminder horizon as due soon", () => {
    const status = takedownStatus(permit("p1", "2026-06-05", "2026-06-11"), today);
    expect(status.state).toBe("due_soon");
    expect(status.message).toMatch(/Comes down in 1 day — Meera Iyer/);
  });

  it("says a permit ending today comes down today", () => {
    const status = takedownStatus(permit("p1", "2026-06-05", "2026-06-10"), today);
    expect(status.state).toBe("due_soon");
    expect(status.message).toMatch(/Comes down today/);
  });

  it("reports an expired permit as overdue and names the owner", () => {
    const status = takedownStatus(permit("p1", "2026-05-25", "2026-06-05"), today);
    expect(status.state).toBe("overdue");
    expect(status.daysRemaining).toBe(-5);
    expect(status.message).toMatch(/Expired 5 days ago — Meera Iyer to remove/);
  });

  it("calls out an overdue permit that nobody owns", () => {
    const status = takedownStatus(
      permit("p1", "2026-05-25", "2026-06-05", { takedownOwnerName: null }),
      today,
    );
    expect(status.message).toMatch(/nobody is assigned to remove it/);
  });

  it("reports a removed permit as completed", () => {
    const status = takedownStatus(
      permit("p1", "2026-05-25", "2026-06-05", {
        takenDownAt: "2026-06-05T10:00:00.000Z",
        status: "taken_down",
      }),
      today,
    );
    expect(status.state).toBe("completed");
  });
});

describe("overdueTakedowns", () => {
  const today = new Date("2026-06-10T09:00:00.000Z");

  it("lists only expired permits, worst offender first", () => {
    const overdue = overdueTakedowns(
      [
        permit("fresh", "2026-06-09", "2026-06-20"),
        permit("late", "2026-05-01", "2026-06-08"),
        permit("very-late", "2026-04-01", "2026-05-01"),
        permit("gone", "2026-04-01", "2026-05-01", {
          takenDownAt: "2026-05-01T10:00:00.000Z",
        }),
      ],
      today,
    );

    expect(overdue.map((s) => s.permitId)).toEqual(["very-late", "late"]);
  });

  it("returns nothing when every poster is current", () => {
    expect(overdueTakedowns([permit("p1", "2026-06-05", "2026-06-20")], today)).toEqual([]);
  });
});

describe("clubTakedownRecords", () => {
  const today = new Date("2026-06-10T09:00:00.000Z");

  it("credits a club that removes its posters on time", () => {
    const records = clubTakedownRecords(
      [
        permit("p1", "2026-05-01", "2026-05-10", {
          clubId: "good",
          clubName: "Chess Club",
          takenDownAt: "2026-05-10T10:00:00.000Z",
        }),
        permit("p2", "2026-05-11", "2026-05-20", {
          clubId: "good",
          clubName: "Chess Club",
          takenDownAt: "2026-05-20T10:00:00.000Z",
        }),
      ],
      today,
    );
    expect(records[0].complianceRate).toBe(1);
    expect(records[0].lateTakedowns).toBe(0);
  });

  it("penalises a club that leaves posters up past expiry", () => {
    const records = clubTakedownRecords(
      [
        permit("p1", "2026-05-01", "2026-05-10", {
          clubId: "bad",
          clubName: "Film Society",
          takenDownAt: "2026-05-25T10:00:00.000Z",
        }),
        permit("p2", "2026-04-01", "2026-04-10", {
          clubId: "bad",
          clubName: "Film Society",
        }),
      ],
      today,
    );
    expect(records[0].lateTakedowns).toBe(1);
    expect(records[0].currentlyOverdue).toBe(1);
    expect(records[0].complianceRate).toBe(0);
  });

  it("puts the least compliant club first", () => {
    const records = clubTakedownRecords(
      [
        permit("p1", "2026-05-01", "2026-05-10", {
          clubId: "good",
          clubName: "Chess Club",
          takenDownAt: "2026-05-10T10:00:00.000Z",
        }),
        permit("p2", "2026-04-01", "2026-04-10", {
          clubId: "bad",
          clubName: "Film Society",
        }),
      ],
      today,
    );
    expect(records[0].clubId).toBe("bad");
  });

  it("ignores pending and rejected requests entirely", () => {
    const records = clubTakedownRecords(
      [
        permit("p1", "2026-05-01", "2026-05-10", { status: "pending" }),
        permit("p2", "2026-05-01", "2026-05-10", { status: "rejected" }),
      ],
      today,
    );
    expect(records).toEqual([]);
  });

  it("reports no rate for a club with nothing yet judgeable", () => {
    const records = clubTakedownRecords(
      [permit("p1", "2026-06-20", "2026-06-25", { clubId: "new" })],
      today,
    );
    expect(records[0].complianceRate).toBeNull();
  });
});

describe("utilisationRate", () => {
  it("reports zero for an empty board", () => {
    const occupancy = buildOccupancy(BOARD, [], "2026-06-05", "2026-06-07");
    expect(utilisationRate(occupancy)).toBe(0);
  });

  it("reports full utilisation for a saturated board", () => {
    const occupancy = buildOccupancy(
      BOARD,
      [permit("p1", "2026-06-05", "2026-06-07", { slotsRequested: 3 })],
      "2026-06-05",
      "2026-06-07",
    );
    expect(utilisationRate(occupancy)).toBe(1);
  });

  it("reports zero rather than dividing by zero on an empty range", () => {
    expect(utilisationRate([])).toBe(0);
  });
});

describe("presentation helpers", () => {
  it("formats a day without shifting it across a timezone", () => {
    expect(formatDay(parseDay("2026-06-05"))).toMatch(/5/);
  });

  it("round-trips a day string", () => {
    expect(toDayString(parseDay("2026-06-05"))).toBe("2026-06-05");
  });

  it("labels every takedown state", () => {
    expect(takedownStateLabel("overdue")).toBe("Overdue");
    expect(takedownStateLabel("active")).toBe("On the board");
    expect(takedownStateLabel("completed")).toBe("Removed");
  });

  it("exposes sane policy defaults", () => {
    expect(DEFAULT_PERMIT_POLICY.maxDurationDays).toBeGreaterThan(0);
    expect(DEFAULT_PERMIT_POLICY.maxConcurrentPerClub).toBeGreaterThan(0);
  });
});
