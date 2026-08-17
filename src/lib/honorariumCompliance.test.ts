import { describe, it, expect } from "vitest";
import {
  BACKUP_WITHHOLDING_RATE_PERCENT,
  REPORTING_THRESHOLD_CENTS,
  STATUTORY_FOREIGN_RATE_PERCENT,
  buildYearEndPack,
  describeBlockReason,
  evaluatePayment,
  formExpiryDate,
  formatCents,
  isFormValidOn,
  releaseDecision,
  requiredFormFor,
  summarisePayeeYear,
  withholdingFor,
  type HonorariumPayee,
  type HonorariumPayment,
} from "./honorariumCompliance";

function payee(overrides: Partial<HonorariumPayee> = {}): HonorariumPayee {
  return {
    id: "payee-1",
    fullName: "Dr Ada Okafor",
    residency: "domestic",
    formType: "w9",
    formSignedOn: "2026-01-15",
    ...overrides,
  };
}

function payment(overrides: Partial<HonorariumPayment> = {}): HonorariumPayment {
  return {
    id: "pay-1",
    payeeId: "payee-1",
    clubId: "club-1",
    grossCents: 25_000,
    engagementDate: "2026-03-04",
    status: "approved",
    ...overrides,
  };
}

describe("honorarium tax compliance", () => {
  describe("required forms", () => {
    it("asks domestic payees for a W-9 and everyone else for a W-8BEN", () => {
      expect(requiredFormFor("domestic")).toBe("w9");
      expect(requiredFormFor("foreign_treaty")).toBe("w8ben");
      expect(requiredFormFor("foreign_non_treaty")).toBe("w8ben");
    });
  });

  describe("form validity", () => {
    it("treats a W-9 as valid indefinitely", () => {
      expect(formExpiryDate(payee())).toBeNull();
      expect(isFormValidOn(payee(), "2035-06-01")).toBe(true);
    });

    it("expires a W-8BEN at the end of the third year after signing", () => {
      const speaker = payee({
        residency: "foreign_non_treaty",
        formType: "w8ben",
        formSignedOn: "2024-05-01",
      });
      expect(formExpiryDate(speaker)).toBe("2027-12-31");
      expect(isFormValidOn(speaker, "2027-12-31")).toBe(true);
      expect(isFormValidOn(speaker, "2028-01-01")).toBe(false);
    });

    it("rejects a form of the wrong type for the payee's residency", () => {
      const speaker = payee({ residency: "foreign_treaty", formType: "w9" });
      expect(isFormValidOn(speaker, "2026-03-04")).toBe(false);
    });

    it("rejects a payee with no form on file", () => {
      expect(isFormValidOn(payee({ formType: "none", formSignedOn: null }), "2026-03-04")).toBe(
        false,
      );
    });
  });

  describe("withholding", () => {
    it("withholds nothing from a documented domestic payee", () => {
      expect(withholdingFor(payee(), "2026-03-04")).toEqual({ ratePercent: 0, reason: "none" });
    });

    it("applies backup withholding while a domestic W-9 is outstanding", () => {
      const result = withholdingFor(payee({ formType: "none", formSignedOn: null }), "2026-03-04");
      expect(result).toEqual({
        ratePercent: BACKUP_WITHHOLDING_RATE_PERCENT,
        reason: "backup_withholding",
      });
    });

    it("applies the statutory rate to a foreign payee without treaty relief", () => {
      const speaker = payee({
        residency: "foreign_non_treaty",
        formType: "w8ben",
        formSignedOn: "2026-01-02",
      });
      expect(withholdingFor(speaker, "2026-03-04")).toEqual({
        ratePercent: STATUTORY_FOREIGN_RATE_PERCENT,
        reason: "statutory_foreign",
      });
    });

    it("honours a treaty rate backed by a valid W-8BEN", () => {
      const speaker = payee({
        residency: "foreign_treaty",
        formType: "w8ben",
        formSignedOn: "2026-01-02",
        treatyRatePercent: 15,
      });
      expect(withholdingFor(speaker, "2026-03-04")).toEqual({
        ratePercent: 15,
        reason: "treaty_rate",
      });
    });

    it("falls back to the statutory rate when the treaty claim has expired", () => {
      const speaker = payee({
        residency: "foreign_treaty",
        formType: "w8ben",
        formSignedOn: "2021-06-01",
        treatyRatePercent: 15,
      });
      expect(withholdingFor(speaker, "2026-03-04")).toEqual({
        ratePercent: STATUTORY_FOREIGN_RATE_PERCENT,
        reason: "statutory_foreign",
      });
    });
  });

  describe("release decisions", () => {
    it("clears a payment backed by valid paperwork", () => {
      expect(releaseDecision(payee(), payment())).toEqual({
        releasable: true,
        blockReason: null,
      });
    });

    it("blocks a payment with no form on file", () => {
      const decision = releaseDecision(payee({ formType: "none", formSignedOn: null }), payment());
      expect(decision).toEqual({ releasable: false, blockReason: "missing_form" });
    });

    it("blocks a payment where the wrong form was returned", () => {
      const decision = releaseDecision(payee({ residency: "foreign_treaty" }), payment());
      expect(decision.blockReason).toBe("form_mismatch");
    });

    it("blocks a payment whose supporting form had expired by the engagement date", () => {
      const speaker = payee({
        residency: "foreign_non_treaty",
        formType: "w8ben",
        formSignedOn: "2020-02-01",
      });
      expect(releaseDecision(speaker, payment()).blockReason).toBe("form_expired");
    });

    it("blocks a cancelled payment outright", () => {
      expect(releaseDecision(payee(), payment({ status: "cancelled" })).blockReason).toBe(
        "payment_cancelled",
      );
    });
  });

  describe("payment evaluation", () => {
    it("computes gross, withholding and net for a clean domestic payment", () => {
      const evaluation = evaluatePayment(payee(), payment());
      expect(evaluation).toMatchObject({
        grossCents: 25_000,
        withholdingCents: 0,
        netCents: 25_000,
        releasable: true,
      });
      expect(evaluation.explanation).toBe("No withholding due.");
    });

    it("rounds withholding to the nearest cent on an awkward amount", () => {
      const speaker = payee({
        residency: "foreign_non_treaty",
        formType: "w8ben",
        formSignedOn: "2026-01-02",
      });
      // 30% of $333.33 is $99.999, which has to land on a whole cent.
      const evaluation = evaluatePayment(speaker, payment({ grossCents: 33_333 }));
      expect(evaluation.withholdingCents).toBe(10_000);
      expect(evaluation.netCents).toBe(23_333);
      expect(evaluation.grossCents).toBe(evaluation.withholdingCents + evaluation.netCents);
    });

    it("still computes withholding for a blocked payment so the treasurer can plan", () => {
      const evaluation = evaluatePayment(
        payee({ formType: "none", formSignedOn: null }),
        payment(),
      );
      expect(evaluation.withholdingCents).toBe(6_000);
      expect(evaluation.releasable).toBe(false);
      expect(evaluation.explanation).toContain("W9");
    });

    it("never withholds more than the gross and never goes negative", () => {
      const speaker = payee({
        residency: "foreign_treaty",
        formType: "w8ben",
        formSignedOn: "2026-01-02",
        treatyRatePercent: 400,
      });
      const evaluation = evaluatePayment(speaker, payment({ grossCents: 10_000 }));
      expect(evaluation.withholdingCents).toBe(10_000);
      expect(evaluation.netCents).toBe(0);
    });

    it("treats a negative gross as zero rather than paying money back", () => {
      const evaluation = evaluatePayment(payee(), payment({ grossCents: -5_000 }));
      expect(evaluation.grossCents).toBe(0);
      expect(evaluation.netCents).toBe(0);
    });
  });

  describe("year to date totals", () => {
    const speaker = payee();
    const payments: HonorariumPayment[] = [
      payment({ id: "p1", grossCents: 30_000, engagementDate: "2026-02-01" }),
      payment({ id: "p2", grossCents: 30_000, engagementDate: "2026-09-14", clubId: "club-2" }),
      payment({ id: "p3", grossCents: 90_000, engagementDate: "2025-11-02" }),
      payment({ id: "p4", grossCents: 50_000, engagementDate: "2026-10-01", status: "cancelled" }),
    ];

    it("rolls up every club a payee was booked by", () => {
      const summary = summarisePayeeYear(speaker, payments, 2026);
      expect(summary.paymentCount).toBe(2);
      expect(summary.grossCents).toBe(60_000);
    });

    it("flags a payee once the reporting threshold is reached", () => {
      const summary = summarisePayeeYear(speaker, payments, 2026);
      expect(summary.grossCents).toBe(REPORTING_THRESHOLD_CENTS);
      expect(summary.requiresInformationReturn).toBe(true);
    });

    it("keeps a payee below the threshold out of the reporting list", () => {
      const summary = summarisePayeeYear(speaker, [payments[0]], 2026);
      expect(summary.requiresInformationReturn).toBe(false);
    });

    it("ignores cancelled payments and other tax years", () => {
      const summary = summarisePayeeYear(speaker, payments, 2025);
      expect(summary.paymentCount).toBe(1);
      expect(summary.grossCents).toBe(90_000);
    });

    it("does not raise an information return for a foreign payee", () => {
      const foreign = payee({
        id: "payee-2",
        residency: "foreign_non_treaty",
        formType: "w8ben",
        formSignedOn: "2026-01-02",
      });
      const summary = summarisePayeeYear(
        foreign,
        [payment({ payeeId: "payee-2", grossCents: 200_000 })],
        2026,
      );
      expect(summary.requiresInformationReturn).toBe(false);
      expect(summary.withheldCents).toBe(60_000);
    });
  });

  describe("year end pack", () => {
    const domestic = payee({ id: "d1" });
    const undocumented = payee({ id: "d2", formType: "none", formSignedOn: null });
    const foreign = payee({
      id: "f1",
      residency: "foreign_non_treaty",
      formType: "w8ben",
      formSignedOn: "2026-02-01",
    });

    const payments: HonorariumPayment[] = [
      payment({ id: "a", payeeId: "d1", grossCents: 80_000, clubId: "club-1" }),
      payment({ id: "b", payeeId: "d2", grossCents: 20_000, clubId: "club-2" }),
      payment({ id: "c", payeeId: "f1", grossCents: 100_000, clubId: "club-1" }),
      payment({ id: "d", payeeId: "d1", grossCents: 10_000, engagementDate: "2025-04-04" }),
    ];

    it("totals gross and withheld across the year", () => {
      const pack = buildYearEndPack([domestic, undocumented, foreign], payments, 2026);
      expect(pack.totalGrossCents).toBe(200_000);
      expect(pack.totalWithheldCents).toBe(4_800 + 30_000);
    });

    it("lists payees who were paid without valid paperwork", () => {
      const pack = buildYearEndPack([domestic, undocumented, foreign], payments, 2026);
      expect(pack.payeesMissingForms).toEqual(["d2"]);
    });

    it("lists domestic payees who crossed the reporting threshold", () => {
      const pack = buildYearEndPack([domestic, undocumented, foreign], payments, 2026);
      expect(pack.payeesOverThreshold).toEqual(["d1"]);
    });

    it("breaks the spend down by club, heaviest first", () => {
      const pack = buildYearEndPack([domestic, undocumented, foreign], payments, 2026);
      expect(pack.grossByClubCents).toEqual([
        { clubId: "club-1", grossCents: 180_000 },
        { clubId: "club-2", grossCents: 20_000 },
      ]);
    });

    it("leaves payees with no activity out of the pack entirely", () => {
      const idle = payee({ id: "idle" });
      const pack = buildYearEndPack([domestic, idle], payments, 2026);
      expect(pack.payeeSummaries.map((row) => row.payeeId)).toEqual(["d1"]);
    });
  });

  describe("presentation helpers", () => {
    it("formats cents as currency", () => {
      expect(formatCents(125_050)).toBe("$1,250.50");
      expect(formatCents(5)).toBe("$0.05");
      expect(formatCents(-2_500)).toBe("-$25.00");
    });

    it("explains why a payment is held", () => {
      expect(describeBlockReason("form_expired")).toBe("Tax form has expired");
      expect(describeBlockReason(null)).toBe("Cleared for release");
    });
  });
});
