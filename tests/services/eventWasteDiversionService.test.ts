/**
 * Test suite: Event Waste Diversion Audit & Contamination Scorecard (#4387)
 * File: tests/services/eventWasteDiversionService.test.ts
 *
 * The cases that matter most here are the contamination reclassification and
 * the per-attendee normalisation, because those are the two places where a
 * plausible-looking implementation quietly reports a flattering number.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  EventWasteDiversionService,
  CONTAMINATION_CRITICAL_PERCENT,
  HIGH_INTENSITY_KG_PER_ATTENDEE,
  type WasteStreamRecord,
} from "../../src/services/eventWasteDiversionService";

const RECORDER = "user-sustainability-lead";
const RECORDED_AT = new Date("2026-04-11T18:00:00.000Z");

function stream(overrides: Partial<WasteStreamRecord> = {}): WasteStreamRecord {
  return {
    streamType: "RECYCLING",
    grossWeightKg: 40,
    contaminationPercent: 0,
    containerCount: 4,
    recordedBy: RECORDER,
    recordedAt: RECORDED_AT,
    ...overrides,
  };
}

const FEST = {
  eventId: "event-spring-fest",
  clubId: "club-eco",
  eventName: "Spring Fest",
  attendance: 800,
};

describe("EventWasteDiversionService (#4387)", () => {
  let service: EventWasteDiversionService;

  beforeEach(() => {
    service = new EventWasteDiversionService();
  });

  describe("stream validation", () => {
    test("rejects a negative weight", () => {
      expect(() => service.recordStream(FEST.eventId, stream({ grossWeightKg: -5 }))).toThrow(
        /non-negative number/i,
      );
    });

    test("rejects a non-finite weight", () => {
      expect(() =>
        service.recordStream(FEST.eventId, stream({ grossWeightKg: Number.NaN })),
      ).toThrow(/non-negative number/i);
    });

    test.each([-1, 101, Number.NaN])("rejects a contamination of %s", (value) => {
      expect(() =>
        service.recordStream(FEST.eventId, stream({ contaminationPercent: value as number })),
      ).toThrow(/between 0 and 100/i);
    });

    test("rejects a fractional container count", () => {
      expect(() => service.recordStream(FEST.eventId, stream({ containerCount: 2.5 }))).toThrow(
        /whole number/i,
      );
    });

    test("rejects contamination on a landfill stream", () => {
      expect(() =>
        service.recordStream(
          FEST.eventId,
          stream({ streamType: "LANDFILL", contaminationPercent: 10 }),
        ),
      ).toThrow(/landfill stream cannot carry a contamination/i);
    });

    test("rejects a blank event id", () => {
      expect(() => service.recordStream("   ", stream())).toThrow(/event id/i);
    });

    test("accepts a clean landfill stream", () => {
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL" }));
      expect(service.getStreams(FEST.eventId)).toHaveLength(1);
    });
  });

  describe("contamination reclassification", () => {
    test("a 40 kg recycling stream at 25% gives 30 kg diverted and 10 kg landfill", () => {
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "RECYCLING", grossWeightKg: 40, contaminationPercent: 25 }),
      );

      const [breakdown] = service.buildStreamBreakdown(FEST.eventId);
      expect(breakdown.effectiveDivertedKg).toBe(30);
      expect(breakdown.reclassifiedToLandfillKg).toBe(10);
    });

    test("a clean stream diverts its full mass", () => {
      service.recordStream(FEST.eventId, stream({ grossWeightKg: 40, contaminationPercent: 0 }));

      const [breakdown] = service.buildStreamBreakdown(FEST.eventId);
      expect(breakdown.effectiveDivertedKg).toBe(40);
      expect(breakdown.reclassifiedToLandfillKg).toBe(0);
    });

    test("a fully contaminated stream diverts nothing", () => {
      service.recordStream(FEST.eventId, stream({ grossWeightKg: 40, contaminationPercent: 100 }));

      const [breakdown] = service.buildStreamBreakdown(FEST.eventId);
      expect(breakdown.effectiveDivertedKg).toBe(0);
      expect(breakdown.reclassifiedToLandfillKg).toBe(40);
    });

    test("a landfill stream never counts toward diversion", () => {
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "LANDFILL", grossWeightKg: 60, contaminationPercent: 0 }),
      );

      const [breakdown] = service.buildStreamBreakdown(FEST.eventId);
      expect(breakdown.effectiveDivertedKg).toBe(0);
      expect(breakdown.reclassifiedToLandfillKg).toBe(60);
    });

    test("repeated skips of one type merge with mass-weighted contamination", () => {
      // A 100 kg skip at 5% next to a 2 kg bin at 90% must not average to 47.5%.
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "COMPOST", grossWeightKg: 100, contaminationPercent: 5 }),
      );
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "COMPOST", grossWeightKg: 2, contaminationPercent: 90 }),
      );

      const [breakdown] = service.buildStreamBreakdown(FEST.eventId);
      expect(breakdown.grossWeightKg).toBe(102);
      // (5 + 1.8) / 102 = 6.67%
      expect(breakdown.contaminationPercent).toBeCloseTo(6.67, 1);
      expect(breakdown.containerCount).toBe(8);
    });

    test("breakdown is ordered by mass, heaviest first", () => {
      service.recordStream(FEST.eventId, stream({ streamType: "RECYCLING", grossWeightKg: 10 }));
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 90 }));

      const breakdown = service.buildStreamBreakdown(FEST.eventId);
      expect(breakdown[0].streamType).toBe("LANDFILL");
    });
  });

  describe("audit computation", () => {
    test("computes an honest rate below the naive one when contaminated", () => {
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "RECYCLING", grossWeightKg: 40, contaminationPercent: 25 }),
      );
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 60 }));

      const audit = service.computeAudit(FEST);

      expect(audit.totalWasteKg).toBe(100);
      expect(audit.divertedKg).toBe(30);
      expect(audit.landfillKg).toBe(70);
      expect(audit.diversionRate).toBe(0.3);
      // The bins read 40% before contamination was applied.
      expect(audit.naiveDiversionRate).toBe(0.4);
      expect(audit.naiveDiversionRate).toBeGreaterThan(audit.diversionRate);
    });

    test("diverted plus landfill always equals the total", () => {
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "COMPOST", grossWeightKg: 33.5, contaminationPercent: 12 }),
      );
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "DONATED", grossWeightKg: 7.25, contaminationPercent: 3 }),
      );
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 19.25 }));

      const audit = service.computeAudit(FEST);
      expect(audit.divertedKg + audit.landfillKg).toBeCloseTo(audit.totalWasteKg, 3);
    });

    test("rejects a negative attendance", () => {
      expect(() => service.computeAudit({ ...FEST, attendance: -1 })).toThrow(
        /non-negative whole number/i,
      );
    });

    test("normalises intensity by attendance", () => {
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 400 }));

      const fest = service.computeAudit({ ...FEST, attendance: 800 });
      expect(fest.intensityKgPerAttendee).toBe(0.5);
    });

    test("a small workshop and a large fest with the same intensity score alike", () => {
      service.recordStream("event-fest", stream({ streamType: "LANDFILL", grossWeightKg: 400 }));
      service.recordStream("event-workshop", stream({ streamType: "LANDFILL", grossWeightKg: 15 }));

      const fest = service.computeAudit({ ...FEST, eventId: "event-fest", attendance: 800 });
      const workshop = service.computeAudit({
        ...FEST,
        eventId: "event-workshop",
        eventName: "Workshop",
        attendance: 30,
      });

      expect(fest.intensityKgPerAttendee).toBe(0.5);
      expect(workshop.intensityKgPerAttendee).toBe(0.5);
    });

    test("an event with no attendance reports zero intensity rather than dividing by zero", () => {
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 10 }));

      const audit = service.computeAudit({ ...FEST, attendance: 0 });
      expect(audit.intensityKgPerAttendee).toBe(0);
      expect(Number.isFinite(audit.intensityKgPerAttendee)).toBe(true);
    });

    test("an unmeasured event reports zero rather than NaN and is flagged", () => {
      const audit = service.computeAudit(FEST);

      expect(audit.totalWasteKg).toBe(0);
      expect(audit.diversionRate).toBe(0);
      expect(audit.flags).toContain("NO_MEASUREMENT");
    });
  });

  describe("grading", () => {
    test.each([
      [0.95, "A"],
      [0.8, "A"],
      [0.79, "B"],
      [0.65, "B"],
      [0.64, "C"],
      [0.5, "C"],
      [0.49, "D"],
      [0.3, "D"],
      [0.29, "F"],
      [0, "F"],
    ])("a rate of %s grades %s", (rate, expected) => {
      expect(service.gradeFor(rate as number)).toBe(expected);
    });
  });

  describe("flags", () => {
    test("raises CONTAMINATION_CRITICAL above the threshold", () => {
      service.recordStream(
        FEST.eventId,
        stream({
          streamType: "RECYCLING",
          grossWeightKg: 50,
          contaminationPercent: CONTAMINATION_CRITICAL_PERCENT + 5,
        }),
      );
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 10 }));

      expect(service.computeAudit(FEST).flags).toContain("CONTAMINATION_CRITICAL");
    });

    test("stays quiet at exactly the threshold", () => {
      service.recordStream(
        FEST.eventId,
        stream({
          streamType: "RECYCLING",
          grossWeightKg: 50,
          contaminationPercent: CONTAMINATION_CRITICAL_PERCENT,
        }),
      );

      expect(service.computeAudit(FEST).flags).not.toContain("CONTAMINATION_CRITICAL");
    });

    test("contamination is flagged independently of a good overall rate", () => {
      // 90% of mass is clean compost, so the rate is strong, but the recycling
      // stream is still a signage problem someone should fix.
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "COMPOST", grossWeightKg: 180, contaminationPercent: 0 }),
      );
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "RECYCLING", grossWeightKg: 20, contaminationPercent: 60 }),
      );

      const audit = service.computeAudit(FEST);
      expect(audit.grade).toBe("A");
      expect(audit.flags).toContain("CONTAMINATION_CRITICAL");
    });

    test("raises HIGH_INTENSITY when waste per attendee is excessive", () => {
      service.recordStream(
        FEST.eventId,
        stream({
          streamType: "LANDFILL",
          grossWeightKg: (HIGH_INTENSITY_KG_PER_ATTENDEE + 0.5) * 100,
        }),
      );

      const audit = service.computeAudit({ ...FEST, attendance: 100 });
      expect(audit.flags).toContain("HIGH_INTENSITY");
    });
  });

  describe("finalisation", () => {
    beforeEach(() => {
      service.recordStream(FEST.eventId, stream({ grossWeightKg: 40 }));
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 60 }));
      service.computeAudit(FEST);
    });

    test("locks the audit and stamps the time", () => {
      const finalizedAt = new Date("2026-04-12T09:00:00.000Z");
      const audit = service.finalizeAudit(FEST.eventId, finalizedAt);

      expect(audit.finalized).toBe(true);
      expect(audit.finalizedAt).toEqual(finalizedAt);
    });

    test("blocks a stream edit once finalized", () => {
      service.finalizeAudit(FEST.eventId, RECORDED_AT);

      expect(() => service.recordStream(FEST.eventId, stream({ grossWeightKg: 5 }))).toThrow(
        /finalized/i,
      );
    });

    test("blocks a second finalisation", () => {
      service.finalizeAudit(FEST.eventId, RECORDED_AT);
      expect(() => service.finalizeAudit(FEST.eventId, RECORDED_AT)).toThrow(/already finalized/i);
    });

    test("recomputing a finalized audit returns the locked figures unchanged", () => {
      const locked = service.finalizeAudit(FEST.eventId, RECORDED_AT);
      const recomputed = service.computeAudit({ ...FEST, attendance: 5 });

      expect(recomputed.attendance).toBe(locked.attendance);
      expect(recomputed.diversionRate).toBe(locked.diversionRate);
    });

    test("refuses to finalize an audit with nothing weighed", () => {
      service.computeAudit({ ...FEST, eventId: "event-empty" });
      expect(() => service.finalizeAudit("event-empty", RECORDED_AT)).toThrow(/no measured waste/i);
    });

    test("refuses to finalize an audit that was never computed", () => {
      expect(() => service.finalizeAudit("event-unknown", RECORDED_AT)).toThrow(
        /no audit has been computed/i,
      );
    });
  });

  describe("club trend", () => {
    function addFinalizedAudit(eventId: string, divertedKg: number, dayOffset: number): void {
      service.recordStream(
        eventId,
        stream({ streamType: "RECYCLING", grossWeightKg: divertedKg, contaminationPercent: 0 }),
      );
      service.recordStream(
        eventId,
        stream({ streamType: "LANDFILL", grossWeightKg: 100 - divertedKg }),
      );
      service.computeAudit({ ...FEST, eventId, eventName: eventId });
      service.finalizeAudit(eventId, new Date(RECORDED_AT.getTime() + dayOffset * 86_400_000));
    }

    test("reports an empty trend for a club with no finalized audits", () => {
      const trend = service.buildClubTrend("club-none");

      expect(trend.auditCount).toBe(0);
      expect(trend.points).toHaveLength(0);
      expect(trend.trendDirection).toBe("FLAT");
    });

    test("excludes draft audits from the trend", () => {
      service.recordStream("event-draft", stream({ grossWeightKg: 40 }));
      service.computeAudit({ ...FEST, eventId: "event-draft" });

      expect(service.buildClubTrend(FEST.clubId).auditCount).toBe(0);
    });

    test("computes the delta against the club's own previous audit", () => {
      addFinalizedAudit("event-1", 30, 0);
      addFinalizedAudit("event-2", 50, 1);

      const trend = service.buildClubTrend(FEST.clubId);
      expect(trend.points[0].deltaVsPrevious).toBeNull();
      expect(trend.points[1].deltaVsPrevious).toBeCloseTo(0.2, 3);
    });

    test("detects an improving club", () => {
      addFinalizedAudit("event-1", 20, 0);
      addFinalizedAudit("event-2", 25, 1);
      addFinalizedAudit("event-3", 70, 2);
      addFinalizedAudit("event-4", 80, 3);

      expect(service.buildClubTrend(FEST.clubId).trendDirection).toBe("IMPROVING");
    });

    test("detects a declining club", () => {
      addFinalizedAudit("event-1", 80, 0);
      addFinalizedAudit("event-2", 75, 1);
      addFinalizedAudit("event-3", 25, 2);
      addFinalizedAudit("event-4", 20, 3);

      expect(service.buildClubTrend(FEST.clubId).trendDirection).toBe("DECLINING");
    });

    test("reports FLAT rather than inventing a direction from one audit", () => {
      addFinalizedAudit("event-1", 45, 0);
      expect(service.buildClubTrend(FEST.clubId).trendDirection).toBe("FLAT");
    });

    test("honours the window limit, keeping the most recent audits", () => {
      addFinalizedAudit("event-1", 10, 0);
      addFinalizedAudit("event-2", 20, 1);
      addFinalizedAudit("event-3", 30, 2);

      const trend = service.buildClubTrend(FEST.clubId, 2);
      expect(trend.auditCount).toBe(2);
      expect(trend.points.map((point) => point.eventId)).toEqual(["event-2", "event-3"]);
    });

    test("reports best, worst and average across the window", () => {
      addFinalizedAudit("event-1", 20, 0);
      addFinalizedAudit("event-2", 60, 1);

      const trend = service.buildClubTrend(FEST.clubId);
      expect(trend.bestDiversionRate).toBeCloseTo(0.6, 3);
      expect(trend.worstDiversionRate).toBeCloseTo(0.2, 3);
      expect(trend.averageDiversionRate).toBeCloseTo(0.4, 3);
    });
  });

  describe("summary", () => {
    test("states the honest rate, the grade and the intensity", () => {
      service.recordStream(FEST.eventId, stream({ grossWeightKg: 80, contaminationPercent: 0 }));
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 20 }));
      service.computeAudit(FEST);

      const summary = service.buildSummary(FEST.eventId);
      expect(summary).toContain("Spring Fest");
      expect(summary).toContain("80%");
      expect(summary).toContain("grade A");
      expect(summary).toContain("kg per attendee");
    });

    test("spells out what contamination cost", () => {
      service.recordStream(FEST.eventId, stream({ grossWeightKg: 40, contaminationPercent: 50 }));
      service.recordStream(FEST.eventId, stream({ streamType: "LANDFILL", grossWeightKg: 60 }));
      service.computeAudit(FEST);

      const summary = service.buildSummary(FEST.eventId);
      expect(summary).toContain("Contamination cost 20 percentage points");
      expect(summary).toContain("the bins read 40%");
    });

    test("names the worst stream when contamination is critical", () => {
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "COMPOST", grossWeightKg: 100, contaminationPercent: 5 }),
      );
      service.recordStream(
        FEST.eventId,
        stream({ streamType: "RECYCLING", grossWeightKg: 30, contaminationPercent: 70 }),
      );
      service.computeAudit(FEST);

      const summary = service.buildSummary(FEST.eventId);
      expect(summary).toContain("Action: the RECYCLING stream");
      expect(summary).toContain("not a volume problem");
    });

    test("says so plainly when nothing was weighed", () => {
      service.computeAudit(FEST);
      expect(service.buildSummary(FEST.eventId)).toContain("no waste was weighed");
    });

    test("refuses to summarise an audit that was never computed", () => {
      expect(() => service.buildSummary("event-unknown")).toThrow(/no audit has been computed/i);
    });
  });
});
