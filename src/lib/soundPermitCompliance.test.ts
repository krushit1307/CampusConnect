import { describe, it, expect } from "vitest";
import type { AcademicPeriod } from "./academicCalendarGuard";
import {
  ZONE_PROFILES,
  ALL_ZONES,
  zoneForDistance,
  classifyDay,
  permittedWindow,
  localDateKey,
  localMinuteOfDay,
  evaluateHours,
  attenuate,
  compliantDistance,
  evaluateLevel,
  permitDeadline,
  evaluatePermit,
  evaluateSoundCompliance,
  soundPermitTask,
  type SoundEvent,
} from "./soundPermitCompliance";

// 2026-09-15 is a Tuesday, 2026-09-18 a Friday, 2026-09-19 a Saturday.
const NOW = "2026-09-01T00:00:00.000Z";

const EXAM_PERIOD: AcademicPeriod = {
  id: "p_exam",
  name: "Autumn examinations",
  type: "EXAM_PERIOD",
  startDate: "2026-09-14",
  endDate: "2026-09-25",
};

function soundEvent(overrides: Partial<SoundEvent> = {}): SoundEvent {
  return {
    eventId: "e_1",
    startsAt: "2026-09-15T18:00:00.000Z",
    endsAt: "2026-09-15T23:30:00.000Z",
    zone: "OPEN_FIELD",
    amplified: true,
    ...overrides,
  };
}

describe("Amplified Sound Permit & Noise Curfew Compliance (#3399)", () => {
  describe("zones from distance", () => {
    it("puts a stage next to a residence hall in the residential zone", () => {
      expect(zoneForDistance(20, "RESIDENCE")).toBe("RESIDENTIAL_ADJACENT");
    });

    it("treats anything far from a receptor as open field", () => {
      expect(zoneForDistance(150, "RESIDENCE")).toBe("OPEN_FIELD");
      expect(zoneForDistance(10, "NONE")).toBe("OPEN_FIELD");
    });

    it("routes a library receptor to the library zone at any close distance", () => {
      expect(zoneForDistance(15, "LIBRARY")).toBe("LIBRARY_ADJACENT");
      expect(zoneForDistance(80, "LIBRARY")).toBe("LIBRARY_ADJACENT");
    });

    it("routes teaching space to the academic zone", () => {
      expect(zoneForDistance(25, "ACADEMIC_BUILDING")).toBe("ACADEMIC_ADJACENT");
    });
  });

  describe("day classification", () => {
    it("treats a Tuesday as a weeknight", () => {
      expect(classifyDay("2026-09-15")).toBe("WEEKNIGHT");
    });

    it("treats Friday and Saturday as the weekend", () => {
      expect(classifyDay("2026-09-18")).toBe("WEEKEND");
      expect(classifyDay("2026-09-19")).toBe("WEEKEND");
    });

    it("treats Sunday as a weeknight, since Monday morning follows it", () => {
      expect(classifyDay("2026-09-20")).toBe("WEEKNIGHT");
    });

    it("takes exam periods from the academic calendar rather than restating them", () => {
      // A Saturday inside the exam period is not a weekend for noise purposes.
      expect(classifyDay("2026-09-19", [EXAM_PERIOD])).toBe("EXAM_PERIOD");
    });

    it("ignores a period that does not cover the date", () => {
      expect(classifyDay("2026-09-10", [EXAM_PERIOD])).toBe("WEEKNIGHT");
    });

    it("counts reading week alongside the exam period by default", () => {
      const reading: AcademicPeriod = {
        id: "p_read",
        name: "Reading week",
        type: "READING_WEEK",
        startDate: "2026-09-07",
        endDate: "2026-09-11",
      };
      expect(classifyDay("2026-09-09", [reading])).toBe("EXAM_PERIOD");
      expect(classifyDay("2026-09-09", [reading], false)).toBe("WEEKNIGHT");
    });
  });

  describe("permitted windows", () => {
    it("gives an open field a later finish at the weekend", () => {
      expect(permittedWindow("OPEN_FIELD", "WEEKNIGHT")?.endMinute).toBe(22 * 60);
      expect(permittedWindow("OPEN_FIELD", "WEEKEND")?.endMinute).toBe(23 * 60);
    });

    it("keeps a residential zone stricter than an open field on the same night", () => {
      const residential = permittedWindow("RESIDENTIAL_ADJACENT", "WEEKNIGHT");
      const field = permittedWindow("OPEN_FIELD", "WEEKNIGHT");
      expect(residential!.endMinute).toBeLessThan(field!.endMinute);
    });

    it("restricts the library zone all day rather than only at night", () => {
      // The case a single evening curfew gets wrong.
      expect(permittedWindow("LIBRARY_ADJACENT", "WEEKNIGHT")).toBeNull();
    });

    it("holds back amplification next to teaching space until the evening", () => {
      expect(permittedWindow("ACADEMIC_ADJACENT", "WEEKNIGHT")?.startMinute).toBe(17 * 60);
    });

    it("prohibits outdoor amplification entirely during exams", () => {
      for (const zone of ALL_ZONES) {
        if (zone === "INDOOR_ISOLATED") continue;
        expect(permittedWindow(zone, "EXAM_PERIOD")).toBeNull();
      }
    });

    it("still permits an isolated indoor venue during exams", () => {
      expect(permittedWindow("INDOOR_ISOLATED", "EXAM_PERIOD")).not.toBeNull();
    });
  });

  describe("hours overlap", () => {
    it("reports the minutes over rather than a bare yes or no", () => {
      // 18:00-23:30 on a Tuesday against a 22:00 curfew.
      const finding = evaluateHours(soundEvent());

      expect(finding.nonCompliantMinutes).toBe(90);
      expect(finding.latestCompliantEnd).toBe("2026-09-15T22:00:00.000Z");
    });

    it("gives back the extra weekend hour", () => {
      const finding = evaluateHours(
        soundEvent({
          startsAt: "2026-09-18T18:00:00.000Z",
          endsAt: "2026-09-18T23:30:00.000Z",
        }),
      );

      expect(finding.nonCompliantMinutes).toBe(30);
    });

    it("reports a fully compliant event as clear", () => {
      const finding = evaluateHours(
        soundEvent({
          startsAt: "2026-09-15T18:00:00.000Z",
          endsAt: "2026-09-15T21:00:00.000Z",
        }),
      );

      expect(finding.nonCompliantMinutes).toBe(0);
      expect(finding.latestCompliantEnd).toBe("2026-09-15T21:00:00.000Z");
    });

    it("handles an event running past midnight day by day", () => {
      const finding = evaluateHours(
        soundEvent({
          startsAt: "2026-09-18T22:00:00.000Z",
          endsAt: "2026-09-19T01:00:00.000Z",
        }),
      );

      // One hour inside Friday's window, then two hours after the curfew.
      expect(finding.nonCompliantMinutes).toBe(120);
      expect(finding.latestCompliantEnd).toBe("2026-09-18T23:00:00.000Z");
    });

    it("does not let a permitted island after a gap excuse the earlier hours", () => {
      // Starts before the window opens; the compliant end cannot run past the
      // start, because the event was already over the line by then.
      const finding = evaluateHours(
        soundEvent({
          startsAt: "2026-09-15T06:00:00.000Z",
          endsAt: "2026-09-15T10:00:00.000Z",
        }),
      );

      expect(finding.nonCompliantMinutes).toBe(120);
    });

    it("counts the whole event when no window exists for that day", () => {
      const finding = evaluateHours(soundEvent({ zone: "LIBRARY_ADJACENT" }));

      expect(finding.permitted).toBeNull();
      expect(finding.nonCompliantMinutes).toBe(330);
    });

    it("applies the exam-period restriction from the calendar", () => {
      const finding = evaluateHours(soundEvent(), [EXAM_PERIOD]);
      expect(finding.dayType).toBe("EXAM_PERIOD");
      expect(finding.nonCompliantMinutes).toBe(330);
    });
  });

  describe("local time handling", () => {
    it("resolves the local date and minute in the institution's timezone", () => {
      expect(localDateKey("2026-09-15T23:00:00.000Z", "America/New_York")).toBe("2026-09-15");
      expect(localMinuteOfDay("2026-09-15T23:00:00.000Z", "America/New_York")).toBe(19 * 60);
    });

    it("rolls the local date back for an instant before local midnight", () => {
      expect(localDateKey("2026-09-16T02:00:00.000Z", "America/New_York")).toBe("2026-09-15");
    });

    it("measures the curfew in local time, not UTC", () => {
      // 21:00-23:30 New York on a Tuesday is 01:00-03:30 UTC the next day.
      // Measured in UTC this looks like an early morning event; measured
      // locally it is ninety minutes past a 22:00 curfew.
      const finding = evaluateHours(
        soundEvent({
          startsAt: "2026-09-16T01:00:00.000Z",
          endsAt: "2026-09-16T03:30:00.000Z",
        }),
        [],
        "America/New_York",
      );

      expect(finding.nonCompliantMinutes).toBe(90);
    });
  });

  describe("sound levels", () => {
    it("loses six decibels per doubling of distance", () => {
      expect(attenuate(100, 10, 20)).toBeCloseTo(93.98, 1);
      expect(attenuate(100, 10, 40)).toBeCloseTo(87.96, 1);
    });

    it("gains the same amount moving closer", () => {
      expect(attenuate(80, 20, 10)).toBeCloseTo(86.02, 1);
    });

    it("returns the source level unchanged for a nonsensical distance", () => {
      expect(attenuate(100, 0, 20)).toBe(100);
    });

    it("computes the distance at which a level would comply", () => {
      // 100 dBA at 10 m needs 25 dB of attenuation to reach a 75 dBA ceiling.
      expect(compliantDistance(100, 10, 75)).toBeCloseTo(177.8, 0);
    });

    it("reports the excess at the receptor for the zone", () => {
      const level = evaluateLevel(soundEvent({ sourceLevelDb: 100 }));

      expect(level?.levelAtReceptorDb).toBeCloseTo(86, 0);
      expect(level?.excessDb).toBeCloseTo(11, 0);
    });

    it("passes a level that is quiet enough at the receptor", () => {
      const level = evaluateLevel(soundEvent({ sourceLevelDb: 85 }));
      expect(level?.excessDb).toBe(0);
    });

    it("honours a site-specific receptor distance over the zone default", () => {
      const near = evaluateLevel(soundEvent({ sourceLevelDb: 100, receptorDistanceMetres: 10 }));
      const far = evaluateLevel(soundEvent({ sourceLevelDb: 100, receptorDistanceMetres: 200 }));

      expect(near!.levelAtReceptorDb).toBeGreaterThan(far!.levelAtReceptorDb);
    });

    it("returns nothing when no source level was given", () => {
      expect(evaluateLevel(soundEvent())).toBeNull();
    });
  });

  describe("permits", () => {
    it("sets the deadline the stated number of days before the event", () => {
      expect(permitDeadline("2026-09-15T18:00:00.000Z", 10)).toBe("2026-09-05T18:00:00.000Z");
    });

    it("requires no permit for an isolated indoor venue", () => {
      const permit = evaluatePermit(soundEvent({ zone: "INDOOR_ISOLATED" }), NOW);
      expect(permit.status).toBe("NOT_REQUIRED");
      expect(permit.deadline).toBeNull();
    });

    it("requires no permit for an unamplified event", () => {
      expect(evaluatePermit(soundEvent({ amplified: false }), NOW).status).toBe("NOT_REQUIRED");
    });

    it("reports an outstanding application while there is still time", () => {
      expect(evaluatePermit(soundEvent(), NOW).status).toBe("NOT_SUBMITTED");
    });

    it("reports the deadline as passed once it has", () => {
      expect(evaluatePermit(soundEvent(), "2026-09-10T00:00:00.000Z").status).toBe(
        "DEADLINE_PASSED",
      );
    });

    it("accepts an application filed before the deadline", () => {
      const permit = evaluatePermit(
        soundEvent({ permitSubmittedAt: "2026-09-01T00:00:00.000Z" }),
        "2026-09-10T00:00:00.000Z",
      );
      expect(permit.status).toBe("SUBMITTED_IN_TIME");
    });

    it("does not accept an application filed after the deadline", () => {
      const permit = evaluatePermit(
        soundEvent({ permitSubmittedAt: "2026-09-10T00:00:00.000Z" }),
        "2026-09-11T00:00:00.000Z",
      );
      expect(permit.status).toBe("DEADLINE_PASSED");
    });

    it("gives a residential site a longer lead time than an open field", () => {
      expect(ZONE_PROFILES.RESIDENTIAL_ADJACENT.permitLeadDays).toBeGreaterThan(
        ZONE_PROFILES.OPEN_FIELD.permitLeadDays,
      );
    });
  });

  describe("the whole check", () => {
    it("passes a compliant event", () => {
      const result = evaluateSoundCompliance({
        event: soundEvent({
          endsAt: "2026-09-15T21:00:00.000Z",
          sourceLevelDb: 85,
          permitSubmittedAt: "2026-08-20T00:00:00.000Z",
        }),
        now: NOW,
      });

      expect(result.verdict).toBe("COMPLIANT");
      expect(result.compliant).toBe(true);
    });

    it("ignores everything for an event with no amplification", () => {
      const result = evaluateSoundCompliance({
        event: soundEvent({ amplified: false, zone: "LIBRARY_ADJACENT" }),
        now: "2026-09-14T00:00:00.000Z",
      });

      expect(result.verdict).toBe("COMPLIANT");
    });

    it("puts the missed permit deadline above every other failure", () => {
      // The event is also over its hours and too loud, but those can be fixed
      // by changing the event and last week cannot.
      const result = evaluateSoundCompliance({
        event: soundEvent({ sourceLevelDb: 110 }),
        now: "2026-09-10T00:00:00.000Z",
      });

      expect(result.verdict).toBe("PERMIT_DEADLINE_MISSED");
      expect(result.remedies.join(" ")).toContain("unamplified");
    });

    it("reports an exam-period event as prohibited rather than merely over", () => {
      const result = evaluateSoundCompliance({
        event: soundEvent({ permitSubmittedAt: "2026-08-20T00:00:00.000Z" }),
        periods: [EXAM_PERIOD],
        now: NOW,
      });

      expect(result.verdict).toBe("PROHIBITED_PERIOD");
      expect(result.reasons[0]).toContain("exam period");
    });

    it("hands back a concrete end time when the event runs over", () => {
      const result = evaluateSoundCompliance({
        event: soundEvent({ permitSubmittedAt: "2026-08-20T00:00:00.000Z" }),
        now: NOW,
      });

      expect(result.verdict).toBe("EXCEEDS_PERMITTED_HOURS");
      expect(result.remedies[0]).toContain("2026-09-15T22:00:00.000Z");
    });

    it("hands back both a level and a distance when it is too loud", () => {
      const result = evaluateSoundCompliance({
        event: soundEvent({
          endsAt: "2026-09-15T21:00:00.000Z",
          sourceLevelDb: 100,
          permitSubmittedAt: "2026-08-20T00:00:00.000Z",
        }),
        now: NOW,
      });

      expect(result.verdict).toBe("EXCEEDS_SOUND_LIMIT");
      expect(result.remedies[0]).toContain("Reduce the source level");
      expect(result.remedies[1]).toContain("m from the receptor");
    });

    it("reminds an otherwise-compliant event to file the permit", () => {
      const result = evaluateSoundCompliance({
        event: soundEvent({ endsAt: "2026-09-15T21:00:00.000Z" }),
        now: NOW,
      });

      expect(result.compliant).toBe(true);
      expect(result.remedies[0]).toContain("Submit the amplified sound permit");
    });

    it("always says what to do rather than only what is wrong", () => {
      const failures = [
        soundEvent({ sourceLevelDb: 110 }),
        soundEvent({ zone: "LIBRARY_ADJACENT", permitSubmittedAt: "2026-08-01T00:00:00.000Z" }),
        soundEvent({ permitSubmittedAt: "2026-08-01T00:00:00.000Z" }),
      ];

      for (const event of failures) {
        const result = evaluateSoundCompliance({ event, now: "2026-09-10T00:00:00.000Z" });
        expect(result.compliant).toBe(false);
        expect(result.remedies.length).toBeGreaterThan(0);
      }
    });
  });

  describe("logistics task", () => {
    it("emits a permit task in the shape the rule engine already uses", () => {
      const task = soundPermitTask(soundEvent());

      expect(task?.ruleKey).toBe("amplified_sound_permit");
      expect(task?.isCritical).toBe(true);
      expect(task?.daysPriorToEvent).toBe(ZONE_PROFILES.OPEN_FIELD.permitLeadDays);
    });

    it("scales the notice period to the zone", () => {
      expect(soundPermitTask(soundEvent({ zone: "RESIDENTIAL_ADJACENT" }))?.daysPriorToEvent).toBe(
        14,
      );
    });

    it("emits nothing where no permit is needed", () => {
      expect(soundPermitTask(soundEvent({ amplified: false }))).toBeNull();
      expect(soundPermitTask(soundEvent({ zone: "INDOOR_ISOLATED" }))).toBeNull();
    });
  });

  describe("profile invariants", () => {
    it("keys every profile by its own zone", () => {
      for (const zone of ALL_ZONES) {
        expect(ZONE_PROFILES[zone].zone).toBe(zone);
      }
    });

    it("orders every window start before its end", () => {
      for (const zone of ALL_ZONES) {
        for (const window of Object.values(ZONE_PROFILES[zone].windows)) {
          if (!window) continue;
          expect(window.startMinute).toBeLessThan(window.endMinute);
          expect(window.endMinute).toBeLessThanOrEqual(24 * 60);
        }
      }
    });

    it("never allows a weeknight to run later than the same zone's weekend", () => {
      for (const zone of ALL_ZONES) {
        const weeknight = ZONE_PROFILES[zone].windows.WEEKNIGHT;
        const weekend = ZONE_PROFILES[zone].windows.WEEKEND;
        if (!weeknight || !weekend) continue;
        expect(weeknight.endMinute).toBeLessThanOrEqual(weekend.endMinute);
      }
    });

    it("gives a closer receptor a lower ceiling", () => {
      expect(ZONE_PROFILES.RESIDENTIAL_ADJACENT.ceilingDb).toBeLessThan(
        ZONE_PROFILES.OPEN_FIELD.ceilingDb,
      );
      expect(ZONE_PROFILES.LIBRARY_ADJACENT.ceilingDb).toBeLessThan(
        ZONE_PROFILES.RESIDENTIAL_ADJACENT.ceilingDb,
      );
    });
  });
});
