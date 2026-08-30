import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeDynamicCoHostRevenueSplit,
  getCoHostFinancialLedger,
} from "../cohostFinancialSplitterService";
import type { RevenueSplitConfig } from "@/lib/cohostRevenueSplitter";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("Dynamic Event Co-Hosting Financial Splitter Service (#3889)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeDynamicCoHostRevenueSplit", () => {
    it("executes 50/50 revenue split on $10.00 ticket ($1,000 total) and updates both clubs' ledgers", async () => {
      const splitsConfig: RevenueSplitConfig[] = [
        { clubId: "club-tech-1", stripeAccountId: "acct_tech_123", pct: 50, isPrimary: true },
        { clubId: "club-biz-2", stripeAccountId: "acct_biz_456", pct: 50, isPrimary: false },
      ];

      mockRpc.mockResolvedValue({
        data: [
          {
            success: true,
            message: "Co-host revenue split updated successfully.",
            audit_id: "audit-999",
          },
        ],
        error: null,
      });

      const result = await executeDynamicCoHostRevenueSplit(
        "evt-gala-1",
        "ch_stripe_999",
        1000, // $10.00 = 1000 cents
        splitsConfig,
      );

      expect(mockRpc).toHaveBeenCalledWith("process_cohost_revenue_split", {
        p_event_id: "evt-gala-1",
        p_charge_id: "ch_stripe_999",
        p_total_amount_cents: 1000,
        p_transfers: expect.arrayContaining([
          expect.objectContaining({
            club_id: "club-tech-1",
            stripe_account_id: "acct_tech_123",
            pct: 50,
            amount_cents: 500, // $5.00
          }),
          expect.objectContaining({
            club_id: "club-biz-2",
            stripe_account_id: "acct_biz_456",
            pct: 50,
            amount_cents: 500, // $5.00
          }),
        ]),
      });

      expect(result.success).toBe(true);
      expect(result.audit_id).toBe("audit-999");
      expect(result.transfers).toHaveLength(2);
      expect(result.transfers![0].amount_cents).toBe(500);
      expect(result.transfers![1].amount_cents).toBe(500);
    });

    it("assigns penny-rounding remainder to the primary host on odd cent amounts ($9.99 = 999 cents)", async () => {
      const splitsConfig: RevenueSplitConfig[] = [
        { clubId: "club-tech-1", stripeAccountId: "acct_tech_123", pct: 50, isPrimary: true },
        { clubId: "club-biz-2", stripeAccountId: "acct_biz_456", pct: 50, isPrimary: false },
      ];

      mockRpc.mockResolvedValue({
        data: [{ success: true, message: "Success", audit_id: "audit-888" }],
        error: null,
      });

      const result = await executeDynamicCoHostRevenueSplit(
        "evt-gala-1",
        "ch_stripe_888",
        999, // 999 cents
        splitsConfig,
      );

      expect(result.transfers![0].amount_cents).toBe(500); // Tech Club (Primary) gets 500 cents ($5.00)
      expect(result.transfers![1].amount_cents).toBe(499); // Biz Club gets 499 cents ($4.99)
      expect(result.transfers![0].amount_cents + result.transfers![1].amount_cents).toBe(999);
    });

    it("throws an error if split percentages do not total 100%", async () => {
      const invalidConfig: RevenueSplitConfig[] = [
        { clubId: "club-tech-1", stripeAccountId: "acct_tech_123", pct: 50, isPrimary: true },
        { clubId: "club-biz-2", stripeAccountId: "acct_biz_456", pct: 30, isPrimary: false },
      ];

      await expect(
        executeDynamicCoHostRevenueSplit("evt-gala-1", "ch_123", 1000, invalidConfig),
      ).rejects.toThrow("must equal 100%");
    });
  });

  describe("getCoHostFinancialLedger", () => {
    it("fetches recorded revenue split transfers for an event", async () => {
      const mockTransfers = [
        {
          id: "tr-1",
          event_id: "evt-gala-1",
          club_id: "club-tech-1",
          stripe_account_id: "acct_tech_123",
          amount_cents: 500,
          pct: 50,
          transfer_id: "tr_stripe_1",
          status: "completed",
        },
      ];

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const orderMock = vi.fn().mockResolvedValue({ data: mockTransfers, error: null });

      mockFrom.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ order: orderMock });

      const result = await getCoHostFinancialLedger("evt-gala-1");

      expect(mockFrom).toHaveBeenCalledWith("event_revenue_transfers");
      expect(result).toHaveLength(1);
      expect(result[0].amount_cents).toBe(500);
    });
  });
});
