import { describe, it, expect } from "vitest";
import {
  CATEGORY_REQUIREMENTS,
  ALL_COVERAGE_LINES,
  UMBRELLA_APPLIES_TO,
  requirementsFor,
  effectiveCoverage,
  operationalWindow,
  evaluateCertificate,
  canConfirmVendor,
  findExpiringCertificates,
  auditEventVendors,
  type InsuranceCertificate,
  type EventWindow,
  type VendorCategory,
} from "./vendorInsurance";

const NOW = "2026-08-01T00:00:00.000Z";

const EVENT: EventWindow = {
  eventId: "e_1",
  startsAt: "2026-09-12T16:00:00.000Z",
  endsAt: "2026-09-12T23:00:00.000Z",
  loadInHours: 12,
  teardownHours: 12,
};

function certificate(overrides: Partial<InsuranceCertificate> = {}): InsuranceCertificate {
  return {
    id: "coi_1",
    vendorId: "v_1",
    issuer: "Fictional Mutual",
    policyNumber: "GL-0001",
    limits: { GENERAL_LIABILITY: 2_000_000, AUTO_LIABILITY: 1_000_000, WORKERS_COMP: 500_000 },
    endorsements: ["ADDITIONAL_INSURED", "WAIVER_OF_SUBROGATION"],
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    effectiveUntil: "2026-12-31T00:00:00.000Z",
    ...overrides,
  };
}

function evaluate(
  overrides: Partial<InsuranceCertificate> | null,
  categories: VendorCategory[] = ["FOOD_TRUCK_PROPANE"],
  now = NOW,
  event = EVENT,
) {
  return evaluateCertificate({
    certificate: overrides === null ? null : certificate(overrides),
    categories,
    event,
    vendorId: "v_1",
    now,
  });
}

describe("Vendor Certificate of Insurance compliance (#3397)", () => {
  describe("requirements by category", () => {
    it("holds a photographer to a lower limit than an inflatable operator", () => {
      const photo = requirementsFor(["PHOTOGRAPHY_MEDIA"]).limits.GENERAL_LIABILITY ?? 0;
      const amusement = requirementsFor(["AMUSEMENT_INFLATABLE"]).limits.GENERAL_LIABILITY ?? 0;
      expect(amusement).toBeGreaterThan(photo);
    });

    it("takes the higher limit on every shared line when a vendor wears two hats", () => {
      const merged = requirementsFor(["CATERING_COLD", "AMUSEMENT_INFLATABLE"]);

      expect(merged.limits.GENERAL_LIABILITY).toBe(5_000_000);
      expect(merged.limits.AUTO_LIABILITY).toBe(1_000_000);
    });

    it("takes the union of the endorsements rather than the first match", () => {
      const merged = requirementsFor(["PHOTOGRAPHY_MEDIA", "AMUSEMENT_INFLATABLE"]);

      expect(merged.endorsements).toContain("ADDITIONAL_INSURED");
      expect(merged.endorsements).toContain("WAIVER_OF_SUBROGATION");
      expect(merged.endorsements).toContain("PRIMARY_NON_CONTRIBUTORY");
    });

    it("requires liquor liability only where alcohol is served", () => {
      expect(requirementsFor(["CATERING_HOT_FOOD"]).limits.LIQUOR_LIABILITY).toBeUndefined();
      expect(requirementsFor(["ALCOHOL_SERVICE"]).limits.LIQUOR_LIABILITY).toBe(2_000_000);
    });

    it("returns nothing for an empty category list", () => {
      expect(requirementsFor([])).toEqual({ limits: {}, endorsements: [] });
    });

    it("orders endorsements deterministically", () => {
      const a = requirementsFor(["AMUSEMENT_INFLATABLE", "ALCOHOL_SERVICE"]).endorsements;
      const b = requirementsFor(["ALCOHOL_SERVICE", "AMUSEMENT_INFLATABLE"]).endorsements;
      expect(a).toEqual(b);
    });
  });

  describe("umbrella aggregation", () => {
    it("adds an excess policy to the underlying line", () => {
      const effective = effectiveCoverage(
        certificate({ limits: { GENERAL_LIABILITY: 1_000_000, UMBRELLA_EXCESS: 4_000_000 } }),
      );
      expect(effective.GENERAL_LIABILITY).toBe(5_000_000);
    });

    it("passes a vendor whose umbrella closes the gap", () => {
      const result = evaluate(
        {
          limits: {
            GENERAL_LIABILITY: 1_000_000,
            AUTO_LIABILITY: 1_000_000,
            WORKERS_COMP: 500_000,
            UMBRELLA_EXCESS: 4_000_000,
          },
        },
        ["FOOD_TRUCK_PROPANE"],
      );
      expect(result.status).toBe("COMPLIANT");
    });

    it("does not let an umbrella conjure cover on a line with no primary policy", () => {
      // An excess policy sits above an underlying one. With nothing underneath
      // there is nothing for it to sit above.
      const effective = effectiveCoverage(
        certificate({ limits: { GENERAL_LIABILITY: 2_000_000, UMBRELLA_EXCESS: 5_000_000 } }),
      );
      expect(effective.LIQUOR_LIABILITY).toBe(0);
    });

    it("does not apply an umbrella to statutory workers' compensation", () => {
      expect(UMBRELLA_APPLIES_TO).not.toContain("WORKERS_COMP");

      const effective = effectiveCoverage(
        certificate({ limits: { WORKERS_COMP: 100_000, UMBRELLA_EXCESS: 5_000_000 } }),
      );
      expect(effective.WORKERS_COMP).toBe(100_000);
    });

    it("reports the primary limit alongside the aggregated one", () => {
      const result = evaluate({
        limits: {
          GENERAL_LIABILITY: 1_000_000,
          AUTO_LIABILITY: 1_000_000,
          WORKERS_COMP: 500_000,
          UMBRELLA_EXCESS: 4_000_000,
        },
      });
      const gl = result.findings.find((f) => f.line === "GENERAL_LIABILITY");

      expect(gl?.primary).toBe(1_000_000);
      expect(gl?.provided).toBe(5_000_000);
    });
  });

  describe("the operational window", () => {
    it("widens the event by load-in and teardown", () => {
      const window = operationalWindow(EVENT);
      expect(window.from).toBe("2026-09-12T04:00:00.000Z");
      expect(window.to).toBe("2026-09-13T11:00:00.000Z");
    });

    it("applies a default buffer when none is given", () => {
      const window = operationalWindow({
        eventId: "e_2",
        startsAt: "2026-09-12T16:00:00.000Z",
        endsAt: "2026-09-12T23:00:00.000Z",
      });
      expect(new Date(window.from).getTime()).toBeLessThan(new Date(EVENT.startsAt).getTime());
    });

    it("rejects a policy that lapses before teardown completes", () => {
      // Cover runs to midnight on the event day; the vendor is still on site
      // at 11:00 the following morning.
      const result = evaluate({ effectiveUntil: "2026-09-13T00:00:00.000Z" });

      expect(result.status).toBe("LAPSES_BEFORE_EVENT");
      expect(result.reasons[0]).toContain("before teardown completes");
    });

    it("rejects a policy that starts after the vendor is already on site", () => {
      const result = evaluate({ effectiveFrom: "2026-09-12T12:00:00.000Z" });
      expect(result.status).toBe("NOT_YET_EFFECTIVE");
    });

    it("accepts a policy that covers the widened window exactly", () => {
      const window = operationalWindow(EVENT);
      const result = evaluate({ effectiveFrom: window.from, effectiveUntil: window.to });
      expect(result.status).toBe("COMPLIANT");
    });
  });

  describe("expiry", () => {
    it("reports an already-lapsed certificate as expired", () => {
      const result = evaluate({ effectiveUntil: "2026-07-01T00:00:00.000Z" });

      expect(result.status).toBe("EXPIRED");
      expect(result.reasons[0]).toContain("no longer evidence");
    });

    it("prefers expiry over a coverage shortfall in the reported status", () => {
      // Both are true; the lapsed policy is the more fundamental problem and
      // chasing a limit increase on a dead policy would be wasted effort.
      const result = evaluate({
        effectiveUntil: "2026-07-01T00:00:00.000Z",
        limits: { GENERAL_LIABILITY: 10_000 },
      });
      expect(result.status).toBe("EXPIRED");
    });

    it("lists certificates lapsing inside the window, most urgent first", () => {
      const certificates = [
        certificate({ id: "coi_late", effectiveUntil: "2026-09-20T00:00:00.000Z" }),
        certificate({ id: "coi_soon", effectiveUntil: "2026-08-15T00:00:00.000Z" }),
        certificate({ id: "coi_far", effectiveUntil: "2027-01-01T00:00:00.000Z" }),
      ];

      const expiring = findExpiringCertificates(certificates, NOW, 60);
      expect(expiring.map((entry) => entry.certificate.id)).toEqual(["coi_soon", "coi_late"]);
    });

    it("excludes certificates that have already lapsed", () => {
      const certificates = [
        certificate({ id: "coi_dead", effectiveUntil: "2026-07-01T00:00:00.000Z" }),
      ];
      expect(findExpiringCertificates(certificates, NOW, 60)).toEqual([]);
    });

    it("reports the remaining days", () => {
      const certificates = [certificate({ effectiveUntil: "2026-08-11T00:00:00.000Z" })];
      expect(findExpiringCertificates(certificates, NOW, 60)[0].daysRemaining).toBe(10);
    });

    it("breaks ties on the same expiry date by id", () => {
      const shared = "2026-08-15T00:00:00.000Z";
      const certificates = [
        certificate({ id: "coi_b", effectiveUntil: shared }),
        certificate({ id: "coi_a", effectiveUntil: shared }),
      ];
      expect(findExpiringCertificates(certificates, NOW, 60).map((e) => e.certificate.id)).toEqual([
        "coi_a",
        "coi_b",
      ]);
    });
  });

  describe("coverage shortfalls", () => {
    it("names the deficient line and the exact gap", () => {
      const result = evaluate({
        limits: { GENERAL_LIABILITY: 2_000_000, AUTO_LIABILITY: 500_000, WORKERS_COMP: 500_000 },
      });

      expect(result.status).toBe("INSUFFICIENT_COVERAGE");
      const auto = result.findings.find((f) => f.line === "AUTO_LIABILITY");
      expect(auto?.shortfall).toBe(500_000);
      expect(result.reasons.join(" ")).toContain("$500,000");
    });

    it("treats an absent line as no cover rather than as unlimited", () => {
      const result = evaluate({ limits: { GENERAL_LIABILITY: 2_000_000 } }, ["FOOD_TRUCK_PROPANE"]);

      expect(result.status).toBe("INSUFFICIENT_COVERAGE");
      expect(result.findings.find((f) => f.line === "AUTO_LIABILITY")?.provided).toBe(0);
    });

    it("only reports lines the vendor's categories actually require", () => {
      const result = evaluate({}, ["PHOTOGRAPHY_MEDIA"]);
      expect(result.findings.map((f) => f.line)).toEqual(["GENERAL_LIABILITY"]);
    });

    it("passes a limit that exactly meets the requirement", () => {
      const result = evaluate(
        { limits: { GENERAL_LIABILITY: 1_000_000 }, endorsements: ["ADDITIONAL_INSURED"] },
        ["PHOTOGRAPHY_MEDIA"],
      );
      expect(result.status).toBe("COMPLIANT");
    });

    it("requires liquor liability from a caterer who also runs the bar", () => {
      const result = evaluate({}, ["CATERING_HOT_FOOD", "ALCOHOL_SERVICE"]);

      expect(result.status).toBe("INSUFFICIENT_COVERAGE");
      expect(result.findings.some((f) => f.line === "LIQUOR_LIABILITY" && !f.satisfied)).toBe(true);
    });
  });

  describe("endorsements", () => {
    it("fails closed when the additional insured endorsement is absent", () => {
      const result = evaluate({ endorsements: ["WAIVER_OF_SUBROGATION"] });

      expect(result.status).toBe("MISSING_ENDORSEMENT");
      expect(result.missingEndorsements).toEqual(["ADDITIONAL_INSURED"]);
    });

    it("does not infer an endorsement from a generous limit", () => {
      const result = evaluate({
        limits: {
          GENERAL_LIABILITY: 50_000_000,
          AUTO_LIABILITY: 50_000_000,
          WORKERS_COMP: 50_000_000,
        },
        endorsements: [],
      });
      expect(result.compliant).toBe(false);
    });

    it("reports coverage shortfalls before endorsements", () => {
      // Both fail. The limit is the harder thing to fix, so it leads.
      const result = evaluate({ limits: { GENERAL_LIABILITY: 100 }, endorsements: [] });
      expect(result.status).toBe("INSUFFICIENT_COVERAGE");
    });

    it("still surfaces the missing endorsements alongside a coverage failure", () => {
      const result = evaluate({ limits: { GENERAL_LIABILITY: 100 }, endorsements: [] });
      expect(result.missingEndorsements.length).toBeGreaterThan(0);
    });
  });

  describe("the confirmation gate", () => {
    it("refuses a vendor with no certificate at all", () => {
      const gate = canConfirmVendor({
        certificate: null,
        categories: ["FOOD_TRUCK_PROPANE"],
        event: EVENT,
        vendorId: "v_1",
        now: NOW,
      });

      expect(gate.allowed).toBe(false);
      expect(gate.status).toBe("NO_CERTIFICATE");
      expect(gate.reasons[0]).toContain("No certificate");
    });

    it("allows a fully compliant vendor", () => {
      const gate = canConfirmVendor({
        certificate: certificate(),
        categories: ["FOOD_TRUCK_PROPANE"],
        event: EVENT,
        vendorId: "v_1",
        now: NOW,
      });

      expect(gate.allowed).toBe(true);
      expect(gate.reasons).toEqual([]);
    });

    it("returns actionable reasons rather than a bare refusal", () => {
      const gate = canConfirmVendor({
        certificate: certificate({ limits: { GENERAL_LIABILITY: 500_000 } }),
        categories: ["FOOD_TRUCK_PROPANE"],
        event: EVENT,
        vendorId: "v_1",
        now: NOW,
      });

      expect(gate.allowed).toBe(false);
      expect(gate.reasons.join(" ")).toContain("requires $2,000,000");
    });

    it("still reports the required endorsements when nothing is on file", () => {
      const gate = evaluate(null, ["AMUSEMENT_INFLATABLE"]);
      expect(gate.missingEndorsements).toContain("PRIMARY_NON_CONTRIBUTORY");
    });
  });

  describe("whole-event audit", () => {
    it("separates the blocking vendors from the clear ones", () => {
      const audit = auditEventVendors(
        [
          { vendorId: "v_ok", categories: ["PHOTOGRAPHY_MEDIA"], certificate: certificate() },
          {
            vendorId: "v_bad",
            categories: ["AMUSEMENT_INFLATABLE"],
            certificate: certificate({ id: "coi_2" }),
          },
          { vendorId: "v_none", categories: ["PERFORMER"], certificate: null },
        ],
        EVENT,
        NOW,
      );

      expect(audit.allClear).toBe(false);
      expect(audit.blocking.map((r) => r.vendorId)).toEqual(["v_bad", "v_none"]);
    });

    it("reports all clear when every vendor passes", () => {
      const audit = auditEventVendors(
        [{ vendorId: "v_ok", categories: ["PHOTOGRAPHY_MEDIA"], certificate: certificate() }],
        EVENT,
        NOW,
      );
      expect(audit.allClear).toBe(true);
      expect(audit.blocking).toEqual([]);
    });

    it("orders results deterministically by vendor", () => {
      const bookings = [
        {
          vendorId: "v_c",
          categories: ["PERFORMER" as VendorCategory],
          certificate: certificate(),
        },
        {
          vendorId: "v_a",
          categories: ["PERFORMER" as VendorCategory],
          certificate: certificate(),
        },
        {
          vendorId: "v_b",
          categories: ["PERFORMER" as VendorCategory],
          certificate: certificate(),
        },
      ];

      expect(auditEventVendors(bookings, EVENT, NOW).results.map((r) => r.vendorId)).toEqual([
        "v_a",
        "v_b",
        "v_c",
      ]);
    });

    it("is trivially clear for an event with no vendors", () => {
      expect(auditEventVendors([], EVENT, NOW).allClear).toBe(true);
    });
  });

  describe("requirement table invariants", () => {
    it("keys every requirement by its own category", () => {
      for (const [key, requirement] of Object.entries(CATEGORY_REQUIREMENTS)) {
        expect(requirement.category).toBe(key);
      }
    });

    it("requires the institution to be named as additional insured everywhere", () => {
      for (const requirement of Object.values(CATEGORY_REQUIREMENTS)) {
        expect(requirement.endorsements).toContain("ADDITIONAL_INSURED");
      }
    });

    it("requires general liability of every category", () => {
      for (const requirement of Object.values(CATEGORY_REQUIREMENTS)) {
        expect(requirement.limits.GENERAL_LIABILITY ?? 0).toBeGreaterThan(0);
      }
    });

    it("never requires an umbrella policy directly", () => {
      // The umbrella is a way of meeting a limit, not a limit in itself.
      for (const requirement of Object.values(CATEGORY_REQUIREMENTS)) {
        expect(requirement.limits.UMBRELLA_EXCESS).toBeUndefined();
      }
    });

    it("gives every category a rationale an officer can quote to a vendor", () => {
      for (const requirement of Object.values(CATEGORY_REQUIREMENTS)) {
        expect(requirement.rationale.length).toBeGreaterThan(20);
      }
    });

    it("covers every declared line in the aggregation table", () => {
      for (const line of ALL_COVERAGE_LINES) {
        const effective = effectiveCoverage(certificate({ limits: { [line]: 1_000 } }));
        expect(effective[line]).toBe(1_000);
      }
    });
  });
});
