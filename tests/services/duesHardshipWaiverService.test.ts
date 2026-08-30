/**
 * Test suite: Club Dues Hardship Waiver & Sliding-Scale Assessment (#4388)
 * File: tests/services/duesHardshipWaiverService.test.ts
 *
 * Two properties carry the feature and are tested hardest: the scale is
 * deterministic (identical bands, identical outcome, every time) and the review
 * path never surfaces an applicant identity.
 */

import { describe, test, expect, beforeEach } from "vitest";
import {
  DuesHardshipWaiverService,
  MAX_WAIVER_BASIS_POINTS,
  type HardshipIndicators,
  type SubmitRequest,
} from "../../src/services/duesHardshipWaiverService";

const CLUB = "club-robotics-8891";
const CYCLE = "cycle-2026-autumn";
const TREASURER = "user-treasurer";
const SUBMITTED_AT = new Date("2026-08-01T10:00:00.000Z");
const DECIDED_AT = new Date("2026-08-03T14:30:00.000Z");

/** Full dues of 2000.00 in minor units. */
const FULL_DUES_MINOR = 200_000;
const MINIMUM_CONTRIBUTION_MINOR = 20_000;

function indicators(overrides: Partial<HardshipIndicators> = {}): HardshipIndicators {
  return {
    aidBand: "PARTIAL",
    dependantBand: "NONE",
    exceptionalCircumstance: false,
    ...overrides,
  };
}

function request(overrides: Partial<SubmitRequest> = {}): SubmitRequest {
  return {
    applicantUserId: "user-applicant",
    clubId: CLUB,
    duesCycleId: CYCLE,
    indicators: indicators(),
    fullDuesMinor: FULL_DUES_MINOR,
    minimumContributionMinor: MINIMUM_CONTRIBUTION_MINOR,
    submittedAt: SUBMITTED_AT,
    ...overrides,
  };
}

describe("DuesHardshipWaiverService (#4388)", () => {
  let service: DuesHardshipWaiverService;

  beforeEach(() => {
    service = new DuesHardshipWaiverService();
  });

  describe("the published scale", () => {
    test("a student with no indicators receives nothing", () => {
      expect(
        service.assessWaiverBasisPoints(indicators({ aidBand: "NONE", dependantBand: "NONE" })),
      ).toBe(0);
    });

    test("bands add together", () => {
      // 5500 aid + 2500 dependants + 1000 exceptional = 9000.
      expect(
        service.assessWaiverBasisPoints({
          aidBand: "FULL",
          dependantBand: "THREE_PLUS",
          exceptionalCircumstance: true,
        }),
      ).toBe(9000);
    });

    test("the waiver is capped short of the full amount", () => {
      const maxed = service.assessWaiverBasisPoints({
        aidBand: "FULL",
        dependantBand: "THREE_PLUS",
        exceptionalCircumstance: true,
      });

      expect(maxed).toBeLessThanOrEqual(MAX_WAIVER_BASIS_POINTS);
      expect(maxed).toBeLessThan(10000);
    });

    test("identical bands always produce an identical assessment", () => {
      const bands = indicators({ aidBand: "FULL", dependantBand: "ONE_TO_TWO" });

      const first = service.assessWaiverBasisPoints(bands);
      const second = service.assessWaiverBasisPoints({ ...bands });

      expect(first).toBe(second);
    });

    test("rejects an unknown aid band", () => {
      expect(() =>
        service.assessWaiverBasisPoints(
          indicators({ aidBand: "GENEROUS" as HardshipIndicators["aidBand"] }),
        ),
      ).toThrow(/unknown aid band/i);
    });

    test("rejects an unknown dependant band", () => {
      expect(() =>
        service.assessWaiverBasisPoints(
          indicators({ dependantBand: "MANY" as HardshipIndicators["dependantBand"] }),
        ),
      ).toThrow(/unknown dependant band/i);
    });

    test("rejects a non-boolean exceptional circumstance", () => {
      expect(() =>
        service.assessWaiverBasisPoints(
          indicators({
            exceptionalCircumstance: "yes" as unknown as boolean,
          }),
        ),
      ).toThrow(/must be a boolean/i);
    });

    test("the scale is publishable for the club handbook", () => {
      const lines = service.describeScale();

      expect(lines.join("\n")).toContain("Financial aid FULL: 5500");
      expect(lines.join("\n")).toContain("Maximum waiver: 9000");
    });
  });

  describe("tier assignment", () => {
    test.each([
      [9000, "T4"],
      [7500, "T4"],
      [7499, "T3"],
      [5500, "T3"],
      [5499, "T2"],
      [3000, "T2"],
      [2999, "T1"],
      [1000, "T1"],
      [999, "T0"],
      [0, "T0"],
    ])("%s basis points is tier %s", (points, expected) => {
      expect(service.tierFor(points as number)).toBe(expected);
    });
  });

  describe("assessment arithmetic", () => {
    test("applies the waiver to the full dues", () => {
      // 3000 bp off 200000 leaves 140000.
      const result = service.assessAmount(FULL_DUES_MINOR, 3000, 0);

      expect(result.assessedAmountMinor).toBe(140_000);
      expect(result.waivedAmountMinor).toBe(60_000);
    });

    test("assessed plus waived always equals the full dues", () => {
      for (const points of [0, 1000, 3000, 4444, 5500, 7500, 9000]) {
        const result = service.assessAmount(FULL_DUES_MINOR, points, 0);
        expect(result.assessedAmountMinor + result.waivedAmountMinor).toBe(FULL_DUES_MINOR);
      }
    });

    test("never falls below the club's minimum contribution", () => {
      // 9000 bp would leave 20000, but the floor here is higher.
      const result = service.assessAmount(FULL_DUES_MINOR, 9000, 50_000);

      expect(result.assessedAmountMinor).toBe(50_000);
      expect(result.waivedAmountMinor).toBe(150_000);
    });

    test("reports the amount actually forgone, not what the scale alone implied", () => {
      const floored = service.assessAmount(FULL_DUES_MINOR, 9000, 50_000);
      const unfloored = service.assessAmount(FULL_DUES_MINOR, 9000, 0);

      expect(floored.waivedAmountMinor).toBeLessThan(unfloored.waivedAmountMinor);
    });

    test("never produces a negative or above-full assessment", () => {
      for (const points of [0, 4500, 9000]) {
        const result = service.assessAmount(FULL_DUES_MINOR, points, 0);
        expect(result.assessedAmountMinor).toBeGreaterThanOrEqual(0);
        expect(result.assessedAmountMinor).toBeLessThanOrEqual(FULL_DUES_MINOR);
        expect(result.waivedAmountMinor).toBeGreaterThanOrEqual(0);
      }
    });

    test("stays in whole minor units on an amount that does not divide evenly", () => {
      // 3333 bp off 99999 does not land on a whole unit.
      const result = service.assessAmount(99_999, 3333, 0);

      expect(Number.isInteger(result.assessedAmountMinor)).toBe(true);
      expect(Number.isInteger(result.waivedAmountMinor)).toBe(true);
      expect(result.assessedAmountMinor + result.waivedAmountMinor).toBe(99_999);
    });

    test("rounds the assessment up so the club is not shorted", () => {
      // 66667 exactly would be 66666.333; the club keeps the extra unit.
      const result = service.assessAmount(100_000, 3333, 0);
      expect(result.assessedAmountMinor).toBe(66_670);
    });

    test("rejects a fractional dues amount", () => {
      expect(() => service.assessAmount(200_000.5, 3000, 0)).toThrow(
        /integer number of minor units/i,
      );
    });

    test("rejects a negative dues amount", () => {
      expect(() => service.assessAmount(-1, 3000, 0)).toThrow(/cannot be negative/i);
    });

    test("rejects a floor above the full dues", () => {
      expect(() => service.assessAmount(100_000, 3000, 200_000)).toThrow(
        /cannot exceed the full dues/i,
      );
    });

    test("rejects a waiver beyond the cap", () => {
      expect(() => service.assessAmount(FULL_DUES_MINOR, 9500, 0)).toThrow(
        /between 0 and 9000 basis points/i,
      );
    });
  });

  describe("submission", () => {
    test("returns an opaque case reference carrying no applicant identity", () => {
      const submitted = service.submitRequest(request({ applicantUserId: "user-alice-1234" }));

      expect(submitted.caseReference).toMatch(/^HW-[A-Z0-9]{1,4}-\d{4}$/);
      expect(submitted.caseReference).not.toContain("alice");
      expect(submitted.caseReference).not.toContain("1234");
      expect(Object.keys(submitted)).not.toContain("applicantUserId");
    });

    test("case references are sequential within a club", () => {
      const first = service.submitRequest(request({ applicantUserId: "user-a" }));
      const second = service.submitRequest(request({ applicantUserId: "user-b" }));

      expect(first.caseReference).toContain("-0001");
      expect(second.caseReference).toContain("-0002");
    });

    test("computes the tier and amounts at submission", () => {
      const submitted = service.submitRequest(
        request({ indicators: indicators({ aidBand: "FULL", dependantBand: "THREE_PLUS" }) }),
      );

      expect(submitted.waiverBasisPoints).toBe(8000);
      expect(submitted.tier).toBe("T4");
      expect(submitted.assessedAmountMinor + submitted.waivedAmountMinor).toBe(FULL_DUES_MINOR);
      expect(submitted.status).toBe("PENDING");
    });

    test("blocks a duplicate open request for the same cycle", () => {
      service.submitRequest(request());
      expect(() => service.submitRequest(request())).toThrow(/already exists/i);
    });

    test("allows a fresh request for a different dues cycle", () => {
      service.submitRequest(request());
      const next = service.submitRequest(request({ duesCycleId: "cycle-2027-spring" }));

      expect(next.status).toBe("PENDING");
    });

    test("allows a fresh request once the previous one is resolved", () => {
      const first = service.submitRequest(request());
      service.decide(
        first.caseReference,
        "DECLINED",
        "Bands did not qualify.",
        TREASURER,
        DECIDED_AT,
      );

      expect(() => service.submitRequest(request())).not.toThrow();
    });

    test("rejects a request with no applicant", () => {
      expect(() => service.submitRequest(request({ applicantUserId: "" }))).toThrow(
        /requires an applicant/i,
      );
    });

    test("rejects a request with no dues cycle", () => {
      expect(() => service.submitRequest(request({ duesCycleId: "" }))).toThrow(
        /club and a dues cycle/i,
      );
    });
  });

  describe("the treasurer's view", () => {
    test("the queue exposes no applicant identity on any case", () => {
      service.submitRequest(request({ applicantUserId: "user-alice" }));
      service.submitRequest(request({ applicantUserId: "user-bob" }));

      const queue = service.getReviewQueue(CLUB);
      const serialized = JSON.stringify(queue);

      expect(queue).toHaveLength(2);
      expect(serialized).not.toContain("alice");
      expect(serialized).not.toContain("bob");
    });

    test("the queue exposes no raw bands, only the computed tier", () => {
      service.submitRequest(request({ indicators: indicators({ aidBand: "FULL" }) }));

      const serialized = JSON.stringify(service.getReviewQueue(CLUB));
      expect(serialized).not.toContain("aidBand");
      expect(serialized).not.toContain("dependantBand");
      expect(serialized).toContain("tier");
    });

    test("orders the deepest need first", () => {
      service.submitRequest(
        request({ applicantUserId: "user-low", indicators: indicators({ aidBand: "NONE" }) }),
      );
      service.submitRequest(
        request({
          applicantUserId: "user-high",
          indicators: indicators({ aidBand: "FULL", dependantBand: "THREE_PLUS" }),
        }),
      );

      const queue = service.getReviewQueue(CLUB);
      expect(queue[0].tier).toBe("T4");
      expect(queue[1].tier).toBe("T0");
    });

    test("breaks a need tie by age, oldest first", () => {
      service.submitRequest(
        request({
          applicantUserId: "user-late",
          submittedAt: new Date(SUBMITTED_AT.getTime() + 86_400_000),
        }),
      );
      service.submitRequest(request({ applicantUserId: "user-early", submittedAt: SUBMITTED_AT }));

      const queue = service.getReviewQueue(CLUB);
      expect(queue[0].submittedAt).toEqual(SUBMITTED_AT);
    });

    test("shows only pending cases", () => {
      const submitted = service.submitRequest(request());
      service.decide(
        submitted.caseReference,
        "APPROVED",
        "Meets the published scale.",
        TREASURER,
        DECIDED_AT,
      );

      expect(service.getReviewQueue(CLUB)).toHaveLength(0);
    });

    test("can be scoped to one dues cycle", () => {
      service.submitRequest(request({ applicantUserId: "user-a" }));
      service.submitRequest(request({ applicantUserId: "user-b", duesCycleId: "cycle-other" }));

      expect(service.getReviewQueue(CLUB, CYCLE)).toHaveLength(1);
    });

    test("does not leak cases from another club", () => {
      service.submitRequest(request({ clubId: "club-chess" }));
      expect(service.getReviewQueue(CLUB)).toHaveLength(0);
    });

    test("returns copies, so a caller cannot mutate stored state", () => {
      const submitted = service.submitRequest(request());
      const [queued] = service.getReviewQueue(CLUB);
      queued.assessedAmountMinor = 1;

      expect(service.getCase(submitted.caseReference)?.assessedAmountMinor).not.toBe(1);
    });
  });

  describe("identity resolution", () => {
    test("the billing side can still resolve the applicant", () => {
      const submitted = service.submitRequest(request({ applicantUserId: "user-alice" }));
      expect(service.resolveApplicant(submitted.caseReference)).toBe("user-alice");
    });

    test("a student sees their own cases", () => {
      service.submitRequest(request({ applicantUserId: "user-alice" }));
      service.submitRequest(request({ applicantUserId: "user-bob" }));

      const mine = service.getCasesForApplicant("user-alice");
      expect(mine).toHaveLength(1);
    });

    test("resolving an unknown case returns nothing rather than throwing", () => {
      expect(service.resolveApplicant("HW-NOPE-0001")).toBeUndefined();
    });
  });

  describe("decisions", () => {
    let caseReference: string;

    beforeEach(() => {
      caseReference = service.submitRequest(request()).caseReference;
    });

    test("approving records the decision and resolves the case", () => {
      const decision = service.decide(
        caseReference,
        "APPROVED",
        "Bands verified against the published scale.",
        TREASURER,
        DECIDED_AT,
      );

      expect(decision.outcome).toBe("APPROVED");
      expect(service.getCase(caseReference)?.status).toBe("APPROVED");
      expect(service.getCase(caseReference)?.decidedAt).toEqual(DECIDED_AT);
    });

    test("a case resolves exactly once", () => {
      service.decide(caseReference, "APPROVED", "Meets the scale.", TREASURER, DECIDED_AT);

      expect(() =>
        service.decide(caseReference, "DECLINED", "Changed my mind.", TREASURER, DECIDED_AT),
      ).toThrow(/already resolved as APPROVED/i);
    });

    test("a decline needs a reason too, not just an approval", () => {
      expect(() => service.decide(caseReference, "DECLINED", "no", TREASURER, DECIDED_AT)).toThrow(
        /at least 8 characters/i,
      );
    });

    test("rejects a decision with no reviewer", () => {
      expect(() =>
        service.decide(caseReference, "APPROVED", "Meets the scale.", "", DECIDED_AT),
      ).toThrow(/reviewer's identity/i);
    });

    test("a reviewer cannot decide their own request", () => {
      const own = service.submitRequest(
        request({ applicantUserId: TREASURER, duesCycleId: "cycle-own" }),
      );

      expect(() =>
        service.decide(own.caseReference, "APPROVED", "Approving myself.", TREASURER, DECIDED_AT),
      ).toThrow(/cannot decide their own/i);
    });

    test("rejects a decision on an unknown case", () => {
      expect(() =>
        service.decide("HW-NOPE-0001", "APPROVED", "Meets the scale.", TREASURER, DECIDED_AT),
      ).toThrow(/unknown hardship case/i);
    });

    test("the decision trail survives and is readable", () => {
      service.decide(
        caseReference,
        "DECLINED",
        "Bands do not qualify this cycle.",
        TREASURER,
        DECIDED_AT,
      );

      const decision = service.getDecision(caseReference);
      expect(decision?.reason).toBe("Bands do not qualify this cycle.");
      expect(decision?.decidedBy).toBe(TREASURER);
    });
  });

  describe("withdrawal", () => {
    test("an applicant may withdraw their own pending request", () => {
      const submitted = service.submitRequest(request({ applicantUserId: "user-alice" }));
      service.withdraw(submitted.caseReference, "user-alice", DECIDED_AT);

      expect(service.getCase(submitted.caseReference)?.status).toBe("WITHDRAWN");
      expect(service.getReviewQueue(CLUB)).toHaveLength(0);
    });

    test("nobody else may withdraw it", () => {
      const submitted = service.submitRequest(request({ applicantUserId: "user-alice" }));

      expect(() => service.withdraw(submitted.caseReference, TREASURER, DECIDED_AT)).toThrow(
        /only the applicant/i,
      );
    });

    test("a resolved case cannot be withdrawn", () => {
      const submitted = service.submitRequest(request({ applicantUserId: "user-alice" }));
      service.decide(
        submitted.caseReference,
        "APPROVED",
        "Meets the scale.",
        TREASURER,
        DECIDED_AT,
      );

      expect(() => service.withdraw(submitted.caseReference, "user-alice", DECIDED_AT)).toThrow(
        /already resolved/i,
      );
    });
  });

  describe("redacted club summary", () => {
    test("aggregates approved relief per tier with no applicant detail", () => {
      const high = service.submitRequest(
        request({
          applicantUserId: "user-alice",
          indicators: indicators({ aidBand: "FULL", dependantBand: "THREE_PLUS" }),
        }),
      );
      const low = service.submitRequest(
        request({ applicantUserId: "user-bob", indicators: indicators({ aidBand: "NONE" }) }),
      );

      service.decide(high.caseReference, "APPROVED", "Meets the scale.", TREASURER, DECIDED_AT);
      service.decide(low.caseReference, "DECLINED", "Does not qualify.", TREASURER, DECIDED_AT);

      const summary = service.buildRedactedSummary(CLUB, CYCLE);

      expect(summary.totalCases).toBe(2);
      expect(summary.approvedCases).toBe(1);
      expect(summary.totalWaivedMinor).toBe(high.waivedAmountMinor);
      expect(JSON.stringify(summary)).not.toContain("alice");
      expect(JSON.stringify(summary)).not.toContain("bob");
    });

    test("counts only approved cases toward waived and assessed totals", () => {
      service.submitRequest(request({ indicators: indicators({ aidBand: "FULL" }) }));

      const summary = service.buildRedactedSummary(CLUB, CYCLE);
      expect(summary.pendingCases).toBe(1);
      expect(summary.totalWaivedMinor).toBe(0);
    });

    test("reports every tier even when empty, so the shape is stable", () => {
      const summary = service.buildRedactedSummary(CLUB, CYCLE);

      expect(summary.byTier.map((rollup) => rollup.tier)).toEqual(["T0", "T1", "T2", "T3", "T4"]);
      expect(summary.totalCases).toBe(0);
    });

    test("does not mix in another dues cycle", () => {
      service.submitRequest(request({ applicantUserId: "user-a" }));
      service.submitRequest(request({ applicantUserId: "user-b", duesCycleId: "cycle-other" }));

      expect(service.buildRedactedSummary(CLUB, CYCLE).totalCases).toBe(1);
    });
  });
});
