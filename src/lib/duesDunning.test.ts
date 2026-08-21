import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  describeStanding,
  isInGoodStanding,
  nextDunningStep,
  outstandingCents,
  pendingDunningSteps,
  periodBoundsFor,
  prorateAmount,
  standingFor,
  summariseCollections,
  type DuesInvoice,
  type DuesPlan,
} from "./duesDunning";

const DUNNING_STEPS = [
  { key: "reminder", offsetDays: -3, channel: "email" as const, template: "dues-reminder" },
  { key: "overdue", offsetDays: 1, channel: "email" as const, template: "dues-overdue" },
  { key: "final", offsetDays: 14, channel: "email" as const, template: "dues-final-notice" },
];

function plan(overrides: Partial<DuesPlan> = {}): DuesPlan {
  return {
    id: "plan-1",
    clubId: "club-1",
    amountCents: 4_000,
    billingPeriod: "semester",
    cycleAnchor: "2026-01-01",
    graceDays: 7,
    suspendAfterDays: 30,
    proration: "daily",
    dunningSteps: DUNNING_STEPS,
    ...overrides,
  };
}

function invoice(overrides: Partial<DuesInvoice> = {}): DuesInvoice {
  return {
    id: "inv-1",
    memberId: "member-1",
    planId: "plan-1",
    periodStart: "2026-01-01",
    periodEnd: "2026-06-30",
    dueDate: "2026-01-15",
    amountDueCents: 4_000,
    amountPaidCents: 0,
    status: "issued",
    sentStepKeys: [],
    ...overrides,
  };
}

describe("club dues", () => {
  describe("date helpers", () => {
    it("counts whole days between dates", () => {
      expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
      expect(daysBetween("2026-01-31", "2026-01-01")).toBe(-30);
    });

    it("clamps the day of month when adding months", () => {
      expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
      expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
      expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
    });

    it("crosses month and year boundaries when adding days", () => {
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });
  });

  describe("billing periods", () => {
    it("finds the annual period containing a date", () => {
      const bounds = periodBoundsFor(plan({ billingPeriod: "annual" }), "2026-08-14");
      expect(bounds).toEqual({ periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    });

    it("finds the semester period containing a date", () => {
      expect(periodBoundsFor(plan(), "2026-08-14")).toEqual({
        periodStart: "2026-07-01",
        periodEnd: "2026-12-31",
      });
    });

    it("finds the monthly period containing a date", () => {
      expect(periodBoundsFor(plan({ billingPeriod: "monthly" }), "2026-08-14")).toEqual({
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
      });
    });

    it("respects an anchor part way through a month", () => {
      const bounds = periodBoundsFor(
        plan({ billingPeriod: "monthly", cycleAnchor: "2026-01-15" }),
        "2026-03-03",
      );
      expect(bounds).toEqual({ periodStart: "2026-02-15", periodEnd: "2026-03-14" });
    });

    it("falls back to the first cycle for dates before the anchor", () => {
      const bounds = periodBoundsFor(plan({ billingPeriod: "annual" }), "2025-06-01");
      expect(bounds).toEqual({ periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    });
  });

  describe("proration", () => {
    const semester = plan();

    it("charges the full amount to a member who was there from the start", () => {
      expect(prorateAmount(semester, "2026-01-01", "2026-01-01", "2026-06-30")).toBe(4_000);
    });

    it("charges nothing for a join date after the period ends", () => {
      expect(prorateAmount(semester, "2026-07-05", "2026-01-01", "2026-06-30")).toBe(0);
    });

    it("charges by the day for a mid-cycle joiner", () => {
      // 181 days in the period, 91 of them remaining from 1 April.
      const amount = prorateAmount(semester, "2026-04-01", "2026-01-01", "2026-06-30");
      expect(amount).toBe(Math.round((4_000 * 91) / 181));
      expect(amount).toBeLessThan(4_000);
    });

    it("ignores proration entirely when the policy says so", () => {
      const flat = plan({ proration: "none" });
      expect(prorateAmount(flat, "2026-06-29", "2026-01-01", "2026-06-30")).toBe(4_000);
    });

    it("halves the fee after the midpoint under a half cycle policy", () => {
      const half = plan({ proration: "half_cycle" });
      expect(prorateAmount(half, "2026-02-01", "2026-01-01", "2026-06-30")).toBe(4_000);
      expect(prorateAmount(half, "2026-05-01", "2026-01-01", "2026-06-30")).toBe(2_000);
    });

    it("never returns more than the plan amount or less than zero", () => {
      const odd = plan({ amountCents: 3_333 });
      for (const day of ["2026-01-01", "2026-03-15", "2026-06-30", "2026-12-31"]) {
        const amount = prorateAmount(odd, day, "2026-01-01", "2026-06-30");
        expect(amount).toBeGreaterThanOrEqual(0);
        expect(amount).toBeLessThanOrEqual(3_333);
        expect(Number.isInteger(amount)).toBe(true);
      }
    });
  });

  describe("outstanding balance", () => {
    it("subtracts payments from the amount due", () => {
      expect(outstandingCents(invoice({ amountPaidCents: 1_500 }))).toBe(2_500);
    });

    it("treats an overpayment as settled rather than as credit", () => {
      expect(outstandingCents(invoice({ amountPaidCents: 9_000 }))).toBe(0);
    });

    it("treats waived and void invoices as owing nothing", () => {
      expect(outstandingCents(invoice({ status: "waived" }))).toBe(0);
      expect(outstandingCents(invoice({ status: "void" }))).toBe(0);
    });
  });

  describe("standing", () => {
    const semester = plan();

    it("is pending before the due date", () => {
      expect(standingFor(semester, invoice(), "2026-01-10")).toBe("pending");
    });

    it("is paid once the balance reaches zero", () => {
      expect(standingFor(semester, invoice({ amountPaidCents: 4_000 }), "2026-03-01")).toBe("paid");
    });

    it("keeps a partial payer in arrears", () => {
      expect(standingFor(semester, invoice({ amountPaidCents: 3_999 }), "2026-03-01")).toBe(
        "suspended",
      );
    });

    it("moves through grace, arrears and suspension as time passes", () => {
      const inv = invoice();
      expect(standingFor(semester, inv, "2026-01-16")).toBe("grace");
      expect(standingFor(semester, inv, "2026-01-22")).toBe("grace");
      expect(standingFor(semester, inv, "2026-01-23")).toBe("delinquent");
      expect(standingFor(semester, inv, "2026-02-14")).toBe("delinquent");
      expect(standingFor(semester, inv, "2026-02-15")).toBe("suspended");
    });

    it("never suspends a waived member", () => {
      expect(standingFor(semester, invoice({ status: "waived" }), "2027-01-01")).toBe("waived");
    });

    it("counts paid, waived and pending as good standing, but not arrears", () => {
      expect(isInGoodStanding("pending")).toBe(true);
      expect(isInGoodStanding("waived")).toBe(true);
      expect(isInGoodStanding("grace")).toBe(false);
      expect(isInGoodStanding("delinquent")).toBe(false);
    });

    it("describes the standing for the roster", () => {
      expect(describeStanding(semester, invoice(), "2026-01-25").label).toBe(
        "In arrears (10 days)",
      );
      expect(describeStanding(semester, invoice({ amountPaidCents: 4_000 }), "2026-03-01")).toEqual(
        {
          standing: "paid",
          label: "Paid",
        },
      );
    });
  });

  describe("dunning", () => {
    const semester = plan();

    it("sends the pre-due reminder three days before the due date", () => {
      expect(nextDunningStep(semester, invoice(), "2026-01-12")?.key).toBe("reminder");
    });

    it("sends nothing before the first step is due", () => {
      expect(nextDunningStep(semester, invoice(), "2026-01-05")).toBeNull();
    });

    it("sends the latest applicable step rather than the whole backlog", () => {
      expect(nextDunningStep(semester, invoice(), "2026-02-20")?.key).toBe("final");
    });

    it("never repeats a step that has already gone out", () => {
      const chased = invoice({ sentStepKeys: ["reminder", "overdue", "final"] });
      expect(nextDunningStep(semester, chased, "2026-03-01")).toBeNull();
    });

    it("falls back to the next unsent step when the latest has been sent", () => {
      const chased = invoice({ sentStepKeys: ["final"] });
      expect(nextDunningStep(semester, chased, "2026-03-01")?.key).toBe("overdue");
    });

    it("never chases a member who has paid or been waived", () => {
      expect(
        nextDunningStep(semester, invoice({ amountPaidCents: 4_000 }), "2026-03-01"),
      ).toBeNull();
      expect(nextDunningStep(semester, invoice({ status: "waived" }), "2026-03-01")).toBeNull();
    });

    it("lists every outstanding reminder, latest first", () => {
      const steps = pendingDunningSteps(semester, invoice(), "2026-02-20");
      expect(steps.map((step) => step.key)).toEqual(["final", "overdue", "reminder"]);
    });
  });

  describe("collection summary", () => {
    const semester = plan();
    const invoices: DuesInvoice[] = [
      invoice({ id: "a", amountPaidCents: 4_000 }),
      invoice({ id: "b", amountPaidCents: 1_000 }),
      invoice({ id: "c", amountPaidCents: 0 }),
      invoice({ id: "d", status: "waived" }),
      invoice({ id: "e", status: "void" }),
    ];

    it("totals what has been collected and what is still owed", () => {
      const summary = summariseCollections(semester, invoices, "2026-02-01");
      expect(summary.collectedCents).toBe(5_000);
      expect(summary.outstandingCents).toBe(7_000);
    });

    it("keeps waived and void invoices out of the billed total", () => {
      const summary = summariseCollections(semester, invoices, "2026-02-01");
      expect(summary.waivedCount).toBe(1);
      expect(summary.collectionRate).toBeCloseTo(5_000 / 12_000, 5);
    });

    it("counts members by how far behind they are", () => {
      const summary = summariseCollections(semester, invoices, "2026-02-01");
      expect(summary.delinquentCount).toBe(2);
      expect(summary.suspendedCount).toBe(0);

      const later = summariseCollections(semester, invoices, "2026-03-01");
      expect(later.suspendedCount).toBe(2);
    });

    it("reports full collection when nothing has been billed", () => {
      const summary = summariseCollections(semester, [], "2026-02-01");
      expect(summary.collectionRate).toBe(1);
      expect(summary.outstandingCents).toBe(0);
    });
  });
});
