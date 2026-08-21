import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateProratedRefund, processPaidRsvpCancellation } from "../refundCalculatorService";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("Automated Refund/Cancellation Fee Calculator Service (#3688)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateProratedRefund", () => {
    const now = new Date("2026-08-20T10:00:00Z");

    it("calculates 100% refund ($100) when cancelling > 7 days (168 hours) before event", () => {
      const eventStart = new Date("2026-08-30T10:00:00Z"); // 10 days (240 hours) before
      const result = calculateProratedRefund(eventStart, 100, undefined, now);

      expect(result.refund_percentage).toBe(100);
      expect(result.refund_amount_dollars).toBe(100);
      expect(result.cancellation_fee_dollars).toBe(0);
      expect(result.policy_description).toContain("240 hours before the event");
      expect(result.policy_description).toContain("100% refund ($100)");
    });

    it("calculates 50% refund ($50) when cancelling 72 hours (> 48 hours) before event", () => {
      const eventStart = new Date("2026-08-23T10:00:00Z"); // 3 days (72 hours) before
      const result = calculateProratedRefund(eventStart, 100, undefined, now);

      expect(result.refund_percentage).toBe(50);
      expect(result.refund_amount_dollars).toBe(50);
      expect(result.cancellation_fee_dollars).toBe(50);
      expect(result.policy_description).toContain("50% refund ($50)");
    });

    it("calculates 0% refund ($0) when cancelling 24 hours (< 48 hours) before event", () => {
      const eventStart = new Date("2026-08-21T10:00:00Z"); // 24 hours before
      const result = calculateProratedRefund(eventStart, 100, undefined, now);

      expect(result.refund_percentage).toBe(0);
      expect(result.refund_amount_dollars).toBe(0);
      expect(result.cancellation_fee_dollars).toBe(100);
      expect(result.policy_description).toContain("24 hours before the event");
      expect(result.policy_description).toContain("0% refund ($0)");
    });

    it("calculates 0% refund ($0) when cancelling 2 hours before event to protect against sunk catering costs", () => {
      const eventStart = new Date("2026-08-20T12:00:00Z"); // 2 hours before
      const result = calculateProratedRefund(eventStart, 100, undefined, now);

      expect(result.refund_percentage).toBe(0);
      expect(result.refund_amount_dollars).toBe(0);
      expect(result.cancellation_fee_dollars).toBe(100);
      expect(result.policy_description).toContain("2 hours before the event");
      expect(result.policy_description).toContain("0% refund ($0)");
    });
  });

  describe("processPaidRsvpCancellation", () => {
    it("executes paid RSVP cancellation and records refund transaction", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          refund_percentage: 50,
          refund_amount_cents: 5000,
        },
        error: null,
      });

      const result = await processPaidRsvpCancellation(
        "rsvp-101",
        "event-gala-1",
        "user-1",
        100,
        new Date(Date.now() + 72 * 3600 * 1000),
      );

      expect(result.success).toBe(true);
      expect(result.calculation.refund_percentage).toBe(50);
      expect(result.calculation.refund_amount_dollars).toBe(50);
    });
  });
});
