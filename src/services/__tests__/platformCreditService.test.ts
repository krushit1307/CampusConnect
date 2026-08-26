// =============================================================================
// Tests: PlatformCreditService
// Issue: #4522 - Automated "Event Cancellation" Credit Issuance
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateCancellationCredit,
  getUserPlatformBalance,
  getPlatformCreditLedger,
  getPendingCancellationClaims,
  resolveRefundChoice,
  applyCreditToCheckout,
} from "../platformCreditService";

const mockInvoke = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    functions: {
      invoke: mockInvoke,
    },
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

describe("platformCreditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "usr-test-123", email: "student@campus.edu" } },
      error: null,
    });
  });

  describe("calculateCancellationCredit", () => {
    it("calculates 10% bonus for a $50.00 (5000 cents) ticket", () => {
      const result = calculateCancellationCredit(5000, 10);
      expect(result.originalAmountCents).toBe(5000);
      expect(result.bonusPercentage).toBe(10);
      expect(result.bonusAmountCents).toBe(500); // $5.00
      expect(result.creditAmountCents).toBe(5500); // $55.00
    });

    it("calculates 10% bonus for a $100.00 (10000 cents) ticket", () => {
      const result = calculateCancellationCredit(10000);
      expect(result.originalAmountCents).toBe(10000);
      expect(result.bonusAmountCents).toBe(1000); // $10.00
      expect(result.creditAmountCents).toBe(11000); // $110.00
    });

    it("handles odd ticket prices with rounded bonus cents", () => {
      // $49.99 = 4999 cents * 0.10 = 499.9 -> 500 cents
      const result = calculateCancellationCredit(4999, 10);
      expect(result.originalAmountCents).toBe(4999);
      expect(result.bonusAmountCents).toBe(500);
      expect(result.creditAmountCents).toBe(5499);
    });

    it("handles custom bonus percentage (e.g. 15%)", () => {
      const result = calculateCancellationCredit(6000, 15);
      expect(result.bonusAmountCents).toBe(900);
      expect(result.creditAmountCents).toBe(6900);
    });

    it("handles 0 amount ticket gracefully", () => {
      const result = calculateCancellationCredit(0, 10);
      expect(result.originalAmountCents).toBe(0);
      expect(result.bonusAmountCents).toBe(0);
      expect(result.creditAmountCents).toBe(0);
    });
  });

  describe("getUserPlatformBalance", () => {
    it("returns balance data when record exists", async () => {
      const mockBalanceRecord = {
        user_id: "usr-test-123",
        balance_cents: 5500,
        lifetime_credited_cents: 5500,
        lifetime_spent_cents: 0,
        bonus_earned_cents: 500,
        updated_at: "2026-08-25T12:00:00Z",
      };

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockBalanceRecord, error: null }),
          }),
        }),
      });

      const res = await getUserPlatformBalance("usr-test-123");
      expect(res.balance_cents).toBe(5500);
      expect(res.bonus_earned_cents).toBe(500);
    });

    it("returns zeroed defaults when no balance record exists", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const res = await getUserPlatformBalance("usr-test-123");
      expect(res.balance_cents).toBe(0);
      expect(res.lifetime_credited_cents).toBe(0);
    });
  });

  describe("getPlatformCreditLedger", () => {
    it("returns credit transactions from user ledger", async () => {
      const mockLedger = [
        {
          id: "tx-1",
          user_id: "usr-test-123",
          amount_cents: 5500,
          balance_after_cents: 5500,
          transaction_type: "cancellation_credit",
          description: "10% bonus credit for cancelled event",
          bonus_amount_cents: 500,
          created_at: "2026-08-25T12:00:00Z",
        },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockLedger, error: null }),
          }),
        }),
      });

      const res = await getPlatformCreditLedger("usr-test-123");
      expect(res).toHaveLength(1);
      expect(res[0].transaction_type).toBe("cancellation_credit");
      expect(res[0].amount_cents).toBe(5500);
    });
  });

  describe("getPendingCancellationClaims", () => {
    it("fetches pending cancellation refund claims with event details", async () => {
      const mockClaims = [
        {
          id: "claim-101",
          event_id: "evt-1",
          rsvp_id: "rsvp-1",
          user_id: "usr-test-123",
          original_amount_cents: 5000,
          bonus_percentage: 10,
          credit_amount_cents: 5500,
          status: "pending_choice",
          events: { title: "Spring Carnival" },
        },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockClaims, error: null }),
            }),
          }),
        }),
      });

      const res = await getPendingCancellationClaims("usr-test-123");
      expect(res).toHaveLength(1);
      expect(res[0].credit_amount_cents).toBe(5500);
      expect(res[0].event_title).toBe("Spring Carnival");
    });
  });

  describe("resolveRefundChoice", () => {
    it("calls process-refund-choice edge function for credit option", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          choice: "credit",
          credit_amount_cents: 5500,
          bonus_amount_cents: 500,
          new_balance_cents: 5500,
        },
        error: null,
      });

      const res = await resolveRefundChoice("claim-101", "credit");
      expect(mockInvoke).toHaveBeenCalledWith("process-refund-choice", {
        body: { claimId: "claim-101", choice: "credit" },
      });
      expect(res.success).toBe(true);
      expect(res.choice).toBe("credit");
      expect(res.credit_amount_cents).toBe(5500);
    });

    it("falls back to RPC when edge function is unavailable", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: "Edge Function offline" },
      });

      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          choice: "credit",
          credit_amount_cents: 5500,
          bonus_amount_cents: 500,
          new_balance_cents: 5500,
        },
        error: null,
      });

      const res = await resolveRefundChoice("claim-101", "credit");
      expect(mockRpc).toHaveBeenCalledWith("process_cancellation_refund_choice", {
        p_claim_id: "claim-101",
        p_user_id: "usr-test-123",
        p_choice: "credit",
      });
      expect(res.success).toBe(true);
      expect(res.credit_amount_cents).toBe(5500);
    });
  });

  describe("applyCreditToCheckout", () => {
    it("deducts platform credit and returns remaining due", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          credit_applied_cents: 5000,
          remaining_amount_cents: 0,
          new_balance_cents: 500,
          fully_covered: true,
        },
        error: null,
      });

      const res = await applyCreditToCheckout("usr-test-123", 5000, "ord-99");
      expect(mockRpc).toHaveBeenCalledWith("apply_platform_credit_to_checkout", {
        p_user_id: "usr-test-123",
        p_order_amount_cents: 5000,
        p_order_id: "ord-99",
        p_description: "Checkout credit deduction for order ord-99",
      });
      expect(res.fully_covered).toBe(true);
      expect(res.credit_applied_cents).toBe(5000);
      expect(res.remaining_amount_cents).toBe(0);
    });
  });
});
