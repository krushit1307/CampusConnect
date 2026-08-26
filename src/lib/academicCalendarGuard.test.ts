import { describe, it, expect } from "vitest";
import {
  zonedParts,
  inclusiveDayCount,
  shiftDate,
  intersectsQuietHours,
  enforcementFor,
  findOverlappingPeriods,
  suggestAlternatives,
  evaluateEventWindow,
  DEFAULT_ENFORCEMENT,
  type AcademicPeriod,
} from "./academicCalendarGuard";

const TZ = "America/New_York";

const examPeriod: AcademicPeriod = {
  id: "per_exams",
  name: "Spring Examinations",
  type: "EXAM_PERIOD",
  startDate: "2026-05-04",
  endDate: "2026-05-15",
  quietHours: { startHour: 22, endHour: 8 },
};

const readingWeek: AcademicPeriod = {
  id: "per_reading",
  name: "Reading Week",
  type: "READING_WEEK",
  startDate: "2026-04-20",
  endDate: "2026-04-26",
};

const term: AcademicPeriod = {
  id: "per_term",
  name: "Spring Term",
  type: "TERM",
  startDate: "2026-01-12",
  endDate: "2026-06-05",
};

const closure: AcademicPeriod = {
  id: "per_closure",
  name: "Campus Closure",
  type: "CLOSURE",
  startDate: "2026-05-25",
  endDate: "2026-05-25",
};

describe("Academic Calendar Blackout Guard (#3137)", () => {
  describe("timezone-aware date handling", () => {
    it("reads the calendar date as observed in the institution's timezone", () => {
      // 02:00 UTC on 4 May is still 22:00 on 3 May in New York.
      expect(zonedParts("2026-05-04T02:00:00.000Z", TZ)).toEqual({ date: "2026-05-03", hour: 22 });
    });

    it("defaults to UTC when no timezone is supplied", () => {
      expect(zonedParts("2026-05-04T02:00:00.000Z")).toEqual({ date: "2026-05-04", hour: 2 });
    });

    it("rejects an unparseable timestamp", () => {
      expect(() => zonedParts("not-a-date", TZ)).toThrow(RangeError);
    });

    it("counts inclusive day spans", () => {
      expect(inclusiveDayCount("2026-05-04", "2026-05-04")).toBe(1);
      expect(inclusiveDayCount("2026-05-04", "2026-05-06")).toBe(3);
      expect(inclusiveDayCount("2026-05-06", "2026-05-04")).toBe(0);
    });

    it("shifts calendar dates across month boundaries", () => {
      expect(shiftDate("2026-05-01", -1)).toBe("2026-04-30");
      expect(shiftDate("2026-05-31", 1)).toBe("2026-06-01");
    });
  });

  describe("quiet hours", () => {
    it("detects an event running inside a window that wraps midnight", () => {
      expect(intersectsQuietHours(2, 4, { startHour: 22, endHour: 8 })).toBe(true);
      expect(intersectsQuietHours(23, 1, { startHour: 22, endHour: 8 })).toBe(true);
    });

    it("clears a daytime event against an overnight quiet window", () => {
      expect(intersectsQuietHours(12, 14, { startHour: 22, endHour: 8 })).toBe(false);
    });
  });

  describe("enforcement defaults", () => {
    it("blocks exams and closures, warns on reading week, informs on term time", () => {
      expect(DEFAULT_ENFORCEMENT.EXAM_PERIOD).toBe("BLOCKED");
      expect(DEFAULT_ENFORCEMENT.CLOSURE).toBe("BLOCKED");
      expect(DEFAULT_ENFORCEMENT.READING_WEEK).toBe("WARN");
      expect(DEFAULT_ENFORCEMENT.TERM).toBe("INFO");
    });

    it("lets a period override its type default", () => {
      expect(enforcementFor({ ...readingWeek, enforcement: "BLOCKED" })).toBe("BLOCKED");
      expect(enforcementFor(readingWeek)).toBe("WARN");
    });
  });

  describe("overlap detection", () => {
    it("catches an event that starts before a period and runs into it", () => {
      const conflicts = findOverlappingPeriods(
        { startsAt: "2026-05-03T14:00:00.000Z", endsAt: "2026-05-05T22:00:00.000Z" },
        [examPeriod],
        { timeZone: TZ },
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].overlapStartDate).toBe("2026-05-04");
      expect(conflicts[0].overlapEndDate).toBe("2026-05-05");
      expect(conflicts[0].overlapDays).toBe(2);
    });

    it("does not flag an event that ends the local evening before the period", () => {
      // 23:00-02:00 UTC is 19:00-22:00 on 3 May in New York.
      const conflicts = findOverlappingPeriods(
        { startsAt: "2026-05-03T23:00:00.000Z", endsAt: "2026-05-04T02:00:00.000Z" },
        [examPeriod],
        { timeZone: TZ },
      );
      expect(conflicts).toHaveLength(0);
    });

    it("flags the same window when the calendar is read in UTC", () => {
      const conflicts = findOverlappingPeriods(
        { startsAt: "2026-05-03T23:00:00.000Z", endsAt: "2026-05-04T02:00:00.000Z" },
        [examPeriod],
      );
      expect(conflicts).toHaveLength(1);
    });

    it("sorts the most severe conflict first", () => {
      const conflicts = findOverlappingPeriods(
        { startsAt: "2026-05-06T16:00:00.000Z", endsAt: "2026-05-06T20:00:00.000Z" },
        [term, examPeriod],
        { timeZone: TZ },
      );

      expect(conflicts.map((c) => c.enforcement)).toEqual(["BLOCKED", "INFO"]);
      expect(conflicts[0].periodId).toBe("per_exams");
    });

    it("escalates a warn period to blocked when quiet hours are broken", () => {
      const lateNight = findOverlappingPeriods(
        { startsAt: "2026-04-22T06:00:00.000Z", endsAt: "2026-04-22T08:00:00.000Z" },
        [{ ...readingWeek, quietHours: { startHour: 22, endHour: 8 } }],
        { timeZone: TZ },
      );

      // 06:00-08:00 UTC is 02:00-04:00 in New York, inside the quiet window.
      expect(lateNight[0].violatesQuietHours).toBe(true);
      expect(lateNight[0].enforcement).toBe("BLOCKED");
      expect(lateNight[0].message).toContain("quiet hours");
    });
  });

  describe("evaluation", () => {
    it("allows a window clear of every period", () => {
      const result = evaluateEventWindow(
        { startsAt: "2026-07-01T16:00:00.000Z", endsAt: "2026-07-01T20:00:00.000Z" },
        [examPeriod, readingWeek, term, closure],
        { timeZone: TZ },
      );

      expect(result.decision).toBe("ALLOWED");
      expect(result.conflicts).toHaveLength(0);
      expect(result.alternatives).toHaveLength(0);
      expect(result.summary).toBe("No academic calendar conflicts.");
    });

    it("blocks a social scheduled inside the exam period", () => {
      const result = evaluateEventWindow(
        {
          startsAt: "2026-05-06T23:00:00.000Z",
          endsAt: "2026-05-07T02:00:00.000Z",
          category: "social",
        },
        [examPeriod],
        { timeZone: TZ },
      );

      expect(result.decision).toBe("BLOCKED");
      expect(result.summary).toContain("Spring Examinations");
      expect(result.exemptionApplied).toBe(false);
    });

    it("warns rather than blocks during reading week", () => {
      const result = evaluateEventWindow(
        { startsAt: "2026-04-22T16:00:00.000Z", endsAt: "2026-04-22T20:00:00.000Z" },
        [readingWeek],
        { timeZone: TZ },
      );

      expect(result.decision).toBe("WARN");
      expect(result.summary).toContain("discouraged");
    });

    it("treats term time as informational only", () => {
      const result = evaluateEventWindow(
        { startsAt: "2026-03-10T16:00:00.000Z", endsAt: "2026-03-10T20:00:00.000Z" },
        [term],
        { timeZone: TZ },
      );

      expect(result.decision).toBe("ALLOWED");
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].enforcement).toBe("INFO");
    });

    it("lets an exempt category run during exam week and says why", () => {
      const result = evaluateEventWindow(
        {
          startsAt: "2026-05-06T16:00:00.000Z",
          endsAt: "2026-05-06T20:00:00.000Z",
          category: "study-session",
        },
        [examPeriod],
        { timeZone: TZ },
      );

      expect(result.decision).toBe("ALLOWED");
      expect(result.exemptionApplied).toBe(true);
      expect(result.conflicts[0].enforcement).toBe("INFO");
      expect(result.conflicts[0].message).toContain("exempt category");
    });

    it("matches exempt categories case-insensitively", () => {
      const result = evaluateEventWindow(
        {
          startsAt: "2026-05-06T16:00:00.000Z",
          endsAt: "2026-05-06T20:00:00.000Z",
          category: "Wellbeing",
        },
        [examPeriod],
        { timeZone: TZ },
      );
      expect(result.decision).toBe("ALLOWED");
    });

    it("still blocks an exempt category that breaks quiet hours", () => {
      const result = evaluateEventWindow(
        {
          startsAt: "2026-05-06T06:00:00.000Z",
          endsAt: "2026-05-06T08:00:00.000Z",
          category: "study-session",
        },
        [examPeriod],
        { timeZone: TZ, exemptCategories: [] },
      );

      expect(result.decision).toBe("BLOCKED");
      expect(result.conflicts[0].violatesQuietHours).toBe(true);
    });

    it("honours a caller-supplied exemption list", () => {
      const result = evaluateEventWindow(
        {
          startsAt: "2026-05-06T16:00:00.000Z",
          endsAt: "2026-05-06T20:00:00.000Z",
          category: "careers-fair",
        },
        [examPeriod],
        { timeZone: TZ, exemptCategories: ["careers-fair"] },
      );
      expect(result.decision).toBe("ALLOWED");
      expect(result.exemptionApplied).toBe(true);
    });
  });

  describe("suggested alternatives", () => {
    it("offers the clear days either side of the blocking period", () => {
      const window = { startsAt: "2026-05-06T18:00:00.000Z", endsAt: "2026-05-06T21:00:00.000Z" };
      const alternatives = suggestAlternatives(window, [examPeriod]);

      expect(alternatives).toHaveLength(2);
      expect(alternatives[0].startsAt).toBe("2026-05-03T18:00:00.000Z");
      expect(alternatives[1].startsAt).toBe("2026-05-16T18:00:00.000Z");
    });

    it("preserves the original duration", () => {
      const window = { startsAt: "2026-05-06T18:00:00.000Z", endsAt: "2026-05-06T21:00:00.000Z" };
      const [before] = suggestAlternatives(window, [examPeriod]);

      const duration = new Date(before.endsAt).getTime() - new Date(before.startsAt).getTime();
      expect(duration).toBe(3 * 60 * 60 * 1000);
    });

    it("returns nothing when there is no blocking period", () => {
      expect(
        suggestAlternatives(
          { startsAt: "2026-05-06T18:00:00.000Z", endsAt: "2026-05-06T21:00:00.000Z" },
          [],
        ),
      ).toEqual([]);
    });

    it("is surfaced on a blocked evaluation", () => {
      const result = evaluateEventWindow(
        { startsAt: "2026-05-06T18:00:00.000Z", endsAt: "2026-05-06T21:00:00.000Z" },
        [examPeriod],
        { timeZone: TZ },
      );

      expect(result.decision).toBe("BLOCKED");
      expect(result.alternatives).toHaveLength(2);
      expect(result.alternatives[0].label).toContain("before");
      expect(result.alternatives[1].label).toContain("after");
    });

    it("spans every blocking period when more than one applies", () => {
      const window = { startsAt: "2026-05-06T18:00:00.000Z", endsAt: "2026-05-06T21:00:00.000Z" };
      const wideExam: AcademicPeriod = { ...examPeriod, quietHours: undefined };
      const alternatives = suggestAlternatives(window, [wideExam, closure]);

      // Earliest blocked start is 4 May, latest blocked end is 25 May.
      expect(alternatives[0].startsAt.slice(0, 10)).toBe("2026-05-03");
      expect(alternatives[1].startsAt.slice(0, 10)).toBe("2026-05-26");
    });
  });
});
