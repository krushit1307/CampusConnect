import { describe, it, expect } from "vitest";
import {
  isLegalTransition,
  buildRoster,
  applyMark,
  applyMarkBatch,
  calculateTally,
  prioritiseRoster,
  outstandingAttendees,
  buildIncidentReport,
  canCloseIncident,
  UNKNOWN_ZONE_ID,
  type AttendanceRecord,
  type RollCallEntry,
} from "./emergencyRollCall";

const DECLARED_AT = "2026-08-12T14:00:00.000Z";

const records: AttendanceRecord[] = [
  {
    userId: "u_1",
    userName: "Alice",
    checkedInAt: "2026-08-12T13:00:00.000Z",
    lastKnownZoneId: "zone_hall",
  },
  {
    userId: "u_2",
    userName: "Bob",
    checkedInAt: "2026-08-12T13:15:00.000Z",
    lastKnownZoneId: "zone_hall",
    requiresMobilityAssistance: true,
  },
  {
    userId: "u_3",
    userName: "Charlie",
    checkedInAt: "2026-08-12T13:30:00.000Z",
    lastKnownZoneId: "zone_lab",
  },
  // Already left before the alarm - must not be counted as inside.
  {
    userId: "u_4",
    userName: "Dana",
    checkedInAt: "2026-08-12T12:00:00.000Z",
    checkedOutAt: "2026-08-12T13:45:00.000Z",
    lastKnownZoneId: "zone_hall",
  },
  // Arrived after the incident was declared.
  {
    userId: "u_5",
    userName: "Eve",
    checkedInAt: "2026-08-12T14:30:00.000Z",
    lastKnownZoneId: "zone_hall",
  },
];

function mark(
  userId: string,
  status: RollCallEntry["status"],
  markedAt: string,
  markedBy = "marshal_1",
) {
  return { userId, status, markedAt, markedBy };
}

describe("Emergency Roll-Call & Evacuation Headcount (#3136)", () => {
  describe("roster construction", () => {
    it("includes only people who were inside when the incident was declared", () => {
      const roster = buildRoster(records, DECLARED_AT);
      expect(roster.map((e) => e.userId)).toEqual(["u_1", "u_2", "u_3"]);
    });

    it("excludes an attendee who had already checked out", () => {
      const roster = buildRoster(records, DECLARED_AT);
      expect(roster.find((e) => e.userId === "u_4")).toBeUndefined();
    });

    it("excludes an attendee who arrived after the declaration", () => {
      const roster = buildRoster(records, DECLARED_AT);
      expect(roster.find((e) => e.userId === "u_5")).toBeUndefined();
    });

    it("starts everyone as unaccounted with no marshal attribution", () => {
      const roster = buildRoster(records, DECLARED_AT);
      expect(roster.every((e) => e.status === "UNACCOUNTED")).toBe(true);
      expect(roster.every((e) => e.markedBy === null && e.markedAt === null)).toBe(true);
    });

    it("falls back to an unassigned zone when the last location is unknown", () => {
      const roster = buildRoster(
        [{ userId: "u_9", userName: "Frank", checkedInAt: "2026-08-12T13:00:00.000Z" }],
        DECLARED_AT,
      );
      expect(roster[0].zoneId).toBe(UNKNOWN_ZONE_ID);
    });
  });

  describe("status transitions", () => {
    it("permits the documented transitions out of unaccounted", () => {
      expect(isLegalTransition("UNACCOUNTED", "SAFE")).toBe(true);
      expect(isLegalTransition("UNACCOUNTED", "ASSISTED")).toBe(true);
      expect(isLegalTransition("UNACCOUNTED", "MISSING")).toBe(true);
    });

    it("permits the correction path back out of safe", () => {
      expect(isLegalTransition("SAFE", "UNACCOUNTED")).toBe(true);
    });

    it("rejects a jump from safe straight to missing", () => {
      expect(isLegalTransition("SAFE", "MISSING")).toBe(false);
    });

    it("treats re-marking the same status as a no-op rather than an error", () => {
      expect(isLegalTransition("SAFE", "SAFE")).toBe(true);
    });
  });

  describe("applying marks", () => {
    it("records the marshal and timestamp on a successful mark", () => {
      const roster = buildRoster(records, DECLARED_AT);
      const outcome = applyMark(
        roster,
        mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z", "marshal_a"),
      );

      expect(outcome.applied).toBe(true);
      expect(outcome.entry.status).toBe("SAFE");
      expect(outcome.entry.markedBy).toBe("marshal_a");
      expect(roster.find((e) => e.userId === "u_1")?.status).toBe("SAFE");
    });

    it("rejects an illegal transition without mutating the roster", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));

      const outcome = applyMark(roster, mark("u_1", "MISSING", "2026-08-12T14:10:00.000Z"));
      expect(outcome.applied).toBe(false);
      expect(outcome.reason).toBe("ILLEGAL_TRANSITION");
      expect(roster.find((e) => e.userId === "u_1")?.status).toBe("SAFE");
    });

    it("rejects a mark for somebody not on the roster", () => {
      const roster = buildRoster(records, DECLARED_AT);
      const outcome = applyMark(roster, mark("u_ghost", "SAFE", "2026-08-12T14:05:00.000Z"));
      expect(outcome.applied).toBe(false);
      expect(outcome.reason).toBe("UNKNOWN_ATTENDEE");
    });

    it("lets a later marshal correct an earlier mark", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z", "marshal_a"));

      const outcome = applyMark(
        roster,
        mark("u_1", "UNACCOUNTED", "2026-08-12T14:09:00.000Z", "marshal_b"),
      );
      expect(outcome.applied).toBe(true);
      expect(outcome.entry.markedBy).toBe("marshal_b");
    });

    it("does not let a stale queued write clobber a confirmed safe mark", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:08:00.000Z", "marshal_b"));

      // An UNACCOUNTED write queued at 14:02 finally drains after the SAFE mark.
      const outcome = applyMark(
        roster,
        mark("u_1", "UNACCOUNTED", "2026-08-12T14:02:00.000Z", "marshal_a"),
      );

      expect(outcome.applied).toBe(false);
      expect(outcome.reason).toBe("STALE_WRITE");
      expect(roster.find((e) => e.userId === "u_1")?.status).toBe("SAFE");
    });

    it("replays an offline batch in timestamp order regardless of queue order", () => {
      const roster = buildRoster(records, DECLARED_AT);
      const result = applyMarkBatch(roster, [
        mark("u_1", "UNACCOUNTED", "2026-08-12T14:02:00.000Z", "marshal_a"),
        mark("u_1", "SAFE", "2026-08-12T14:08:00.000Z", "marshal_b"),
        mark("u_2", "ASSISTED", "2026-08-12T14:06:00.000Z", "marshal_a"),
      ]);

      expect(roster.find((e) => e.userId === "u_1")?.status).toBe("SAFE");
      expect(roster.find((e) => e.userId === "u_2")?.status).toBe("ASSISTED");
      expect(result.applied).toBeGreaterThanOrEqual(2);
    });
  });

  describe("tallies", () => {
    it("counts safe and assisted as accounted for", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));
      applyMark(roster, mark("u_2", "ASSISTED", "2026-08-12T14:06:00.000Z"));

      const tally = calculateTally(roster);
      expect(tally.total).toBe(3);
      expect(tally.accounted).toBe(2);
      expect(tally.unaccounted).toBe(1);
      expect(tally.assisted).toBe(1);
      expect(tally.isComplete).toBe(false);
    });

    it("partitions counts by assembly zone", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));

      const tally = calculateTally(roster);
      const hall = tally.zones.find((z) => z.zoneId === "zone_hall");
      const lab = tally.zones.find((z) => z.zoneId === "zone_lab");

      expect(hall?.total).toBe(2);
      expect(hall?.accounted).toBe(1);
      expect(lab?.total).toBe(1);
      expect(lab?.unaccounted).toBe(1);
    });

    it("flags a zone nobody has reported from as silent", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));

      const tally = calculateTally(roster);
      expect(tally.zones.find((z) => z.zoneId === "zone_hall")?.isSilent).toBe(false);
      expect(tally.zones.find((z) => z.zoneId === "zone_lab")?.isSilent).toBe(true);
    });

    it("reports completion only once everyone is accounted for", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));
      applyMark(roster, mark("u_2", "SAFE", "2026-08-12T14:06:00.000Z"));
      applyMark(roster, mark("u_3", "ASSISTED", "2026-08-12T14:07:00.000Z"));

      expect(calculateTally(roster).isComplete).toBe(true);
    });
  });

  describe("sweep prioritisation", () => {
    it("puts anyone flagged missing at the top of the list", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_3", "MISSING", "2026-08-12T14:07:00.000Z"));

      expect(prioritiseRoster(roster)[0].userId).toBe("u_3");
    });

    it("ranks an attendee with a mobility accommodation above other unaccounted people", () => {
      const roster = buildRoster(records, DECLARED_AT);
      const ordered = prioritiseRoster(roster).filter((e) => e.status === "UNACCOUNTED");
      expect(ordered[0].userId).toBe("u_2");
      expect(ordered[0].requiresMobilityAssistance).toBe(true);
    });

    it("drops accounted-for attendees out of the outstanding list", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));

      const outstanding = outstandingAttendees(roster);
      expect(outstanding.map((e) => e.userId)).not.toContain("u_1");
      expect(outstanding).toHaveLength(2);
    });
  });

  describe("incident closure", () => {
    it("blocks closure while anyone is outstanding, naming who", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));

      const outcome = canCloseIncident(roster);
      expect(outcome.canClose).toBe(false);
      expect(outcome.blockers).toHaveLength(2);
      expect(outcome.blockers.join(" ")).toContain("Bob");
    });

    it("allows closure once everyone is accounted for", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z"));
      applyMark(roster, mark("u_2", "SAFE", "2026-08-12T14:06:00.000Z"));
      applyMark(roster, mark("u_3", "SAFE", "2026-08-12T14:07:00.000Z"));

      expect(canCloseIncident(roster).canClose).toBe(true);
    });

    it("refuses to close an empty roster", () => {
      expect(canCloseIncident([]).canClose).toBe(false);
    });
  });

  describe("incident report", () => {
    it("records who signed off on each attendee and when", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_1", "SAFE", "2026-08-12T14:05:00.000Z", "marshal_a"));
      applyMark(roster, mark("u_2", "ASSISTED", "2026-08-12T14:06:00.000Z", "marshal_b"));

      const report = buildIncidentReport("inc_1", DECLARED_AT, roster, "2026-08-12T14:30:00.000Z");

      expect(report.incidentId).toBe("inc_1");
      expect(report.closedAt).toBe("2026-08-12T14:30:00.000Z");
      expect(report.auditTrail).toHaveLength(3);

      const alice = report.auditTrail.find((row) => row.userName === "Alice");
      expect(alice?.finalStatus).toBe("SAFE");
      expect(alice?.markedBy).toBe("marshal_a");

      const charlie = report.auditTrail.find((row) => row.userName === "Charlie");
      expect(charlie?.finalStatus).toBe("UNACCOUNTED");
      expect(charlie?.markedBy).toBeNull();
    });

    it("carries the outstanding list in sweep priority order", () => {
      const roster = buildRoster(records, DECLARED_AT);
      applyMark(roster, mark("u_3", "MISSING", "2026-08-12T14:07:00.000Z"));

      const report = buildIncidentReport("inc_2", DECLARED_AT, roster);
      expect(report.outstanding[0].userId).toBe("u_3");
      expect(report.tally.missing).toBe(1);
      expect(report.closedAt).toBeNull();
    });
  });
});
