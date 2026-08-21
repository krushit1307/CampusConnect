import { describe, it, expect } from "vitest";
import {
  calculateProportionalRevenueSplits,
  calculateProportionalRefundSplits,
  formatRevenueSplitAuditSummary,
  type RevenueSplitConfig,
  type TransferSplitResult,
} from "./cohostRevenueSplitter";

describe("Event Co-Host Revenue Sharing Splitter - Senior Engine (#3182)", () => {
  describe("Proportional Integer Cent Revenue Splits", () => {
    it("calculates clean percentage splits for even amounts", () => {
      const configs: RevenueSplitConfig[] = [
        { clubId: "club_a", stripeAccountId: "acct_a", pct: 60, isPrimary: true },
        { clubId: "club_b", stripeAccountId: "acct_b", pct: 40, isPrimary: false },
      ];

      const splits = calculateProportionalRevenueSplits(10000, configs); // $100.00 = 10,000 cents

      expect(splits[0].amountCents).toBe(6000); // $60.00
      expect(splits[1].amountCents).toBe(4000); // $40.00
      expect(splits.reduce((s, r) => s + r.amountCents, 0)).toBe(10000);
    });

    it("assigns penny rounding remainder to the primary host on odd cent amounts", () => {
      const configs: RevenueSplitConfig[] = [
        { clubId: "club_a", stripeAccountId: "acct_a", pct: 50, isPrimary: true },
        { clubId: "club_b", stripeAccountId: "acct_b", pct: 50, isPrimary: false },
      ];

      // $9.99 = 999 cents. 50% of 999 is 499.5 cents.
      // Base floored: 499 cents each. Remainder 1 cent goes to Primary Host (Club A -> 500 cents).
      const splits = calculateProportionalRevenueSplits(999, configs);

      expect(splits[0].amountCents).toBe(500); // Primary host gets 500 cents
      expect(splits[1].amountCents).toBe(499); // Co-host gets 499 cents
      expect(splits.reduce((s, r) => s + r.amountCents, 0)).toBe(999);
    });

    it("handles 3-way co-host splits accurately (60/20/20)", () => {
      const configs: RevenueSplitConfig[] = [
        { clubId: "club_a", stripeAccountId: "acct_a", pct: 60, isPrimary: true },
        { clubId: "club_b", stripeAccountId: "acct_b", pct: 20, isPrimary: false },
        { clubId: "club_c", stripeAccountId: "acct_c", pct: 20, isPrimary: false },
      ];

      const splits = calculateProportionalRevenueSplits(10001, configs); // 10,001 cents

      expect(splits[0].amountCents).toBe(6001); // 6,000 base + 1 remainder
      expect(splits[1].amountCents).toBe(2000);
      expect(splits[2].amountCents).toBe(2000);
      expect(splits.reduce((s, r) => s + r.amountCents, 0)).toBe(10001);
    });

    it("throws error if total split percentage does not equal 100%", () => {
      const invalidConfigs: RevenueSplitConfig[] = [
        { clubId: "club_a", stripeAccountId: "acct_a", pct: 50, isPrimary: true },
        { clubId: "club_b", stripeAccountId: "acct_b", pct: 40, isPrimary: false },
      ];

      expect(() => calculateProportionalRevenueSplits(1000, invalidConfigs)).toThrow(
        "must equal 100%",
      );
    });
  });

  describe("Proportional Refund Reversals", () => {
    it("calculates exact proportional refund clawbacks for Stripe Connect accounts", () => {
      const originalSplits: TransferSplitResult[] = [
        {
          clubId: "club_a",
          stripeAccountId: "acct_a",
          pct: 60,
          amountCents: 6000,
          isPrimary: true,
        },
        {
          clubId: "club_b",
          stripeAccountId: "acct_b",
          pct: 40,
          amountCents: 4000,
          isPrimary: false,
        },
      ];

      const refunds = calculateProportionalRefundSplits(originalSplits, 5000); // $50.00 refund = 5,000 cents

      expect(refunds[0].refundAmountCents).toBe(3000); // $30.00
      expect(refunds[1].refundAmountCents).toBe(2000); // $20.00
      expect(refunds.reduce((s, r) => s + r.refundAmountCents, 0)).toBe(5000);
    });
  });

  describe("Revenue Split Audit Dashboard Summary", () => {
    it("formats audit dashboard summary metrics and lines", () => {
      const transfers: TransferSplitResult[] = [
        {
          clubId: "club_a",
          stripeAccountId: "acct_a",
          pct: 60,
          amountCents: 6000,
          isPrimary: true,
        },
        {
          clubId: "club_b",
          stripeAccountId: "acct_b",
          pct: 40,
          amountCents: 4000,
          isPrimary: false,
        },
      ];

      const summary = formatRevenueSplitAuditSummary(transfers);

      expect(summary.totalDistributedFormatted).toBe("$100.00");
      expect(summary.summaryLines[0]).toContain("Primary Host (60%): $60.00");
      expect(summary.summaryLines[1]).toContain("Co-Host (40%): $40.00");
    });
  });
});
