// src/services/__tests__/eventCancellationService.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  validateCancellationConfirmation,
  cancelEventAndRefund,
  processBatchRefunds,
} from "../eventCancellationService";

const mockInvoke = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    functions: {
      invoke: mockInvoke,
    },
  }),
}));

describe("eventCancellationService", () => {
  describe("validateCancellationConfirmation", () => {
    it("returns true when typed text matches 'CANCEL [EVENT TITLE]'", () => {
      expect(validateCancellationConfirmation("Fall Music Fest", "CANCEL Fall Music Fest")).toBe(
        true,
      );
    });

    it("is case-insensitive for text matching", () => {
      expect(validateCancellationConfirmation("Fall Music Fest", "cancel fall music fest")).toBe(
        true,
      );
    });

    it("returns false when confirmation text does not match", () => {
      expect(validateCancellationConfirmation("Fall Music Fest", "Cancel Event")).toBe(false);
    });
  });

  describe("cancelEventAndRefund", () => {
    it("invokes cancel-event-refunds Edge Function with eventId and reason", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          total_rsvps_cancelled: 200,
          total_paid_refunds: 150,
          total_refunded_amount_cents: 300000,
        },
        error: null,
      });

      const res = await cancelEventAndRefund("evt-902", "Blizzard Warning", "Fall Music Fest");

      expect(mockInvoke).toHaveBeenCalledWith("cancel-event-refunds", {
        body: { eventId: "evt-902", reason: "Blizzard Warning" },
      });
      expect(res.success).toBe(true);
      expect(res.total_rsvps_cancelled).toBe(200);
      expect(res.vendor_summary).toBeDefined();
      expect(res.vendor_summary?.totalVendorsNotified).toBeGreaterThan(0);
    });
  });

  describe("processBatchRefunds", () => {
    it("processes refunds in batches with progress callbacks", async () => {
      const items = Array.from({ length: 25 }).map((_, i) => ({
        rsvpId: `rsvp-${i}`,
        amountCents: 2000,
      }));

      const progressFn = vi.fn();

      const result = await processBatchRefunds(items, 10, 10, progressFn);

      expect(result.success).toBe(true);
      expect(result.processed).toBe(25);
      expect(progressFn).toHaveBeenCalled();
    });
  });
});
