import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTicketBundlesByClub,
  getBundleWithEvents,
  checkBundleAvailability,
  createStripeBundleCheckoutSession,
  executeBundlePurchase,
} from "../ticketBundleService";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("Ticket Bundle / Season Pass Service (#3875)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTicketBundlesByClub", () => {
    it("fetches active ticket bundles for a given club", async () => {
      const mockBundles = [
        {
          id: "bundle-1",
          club_id: "club-film-1",
          bundle_name: "Classic Cinema Series - Season Pass",
          description: "5 movies for the price of 3.5!",
          price_dollars: 18.0,
          original_total_price: 25.0,
          discount_percentage: 28,
          status: "ACTIVE",
          created_at: "2026-08-20T00:00:00Z",
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq1 = vi.fn().mockReturnThis();
      const mockEq2 = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockResolvedValue({ data: mockBundles, error: null });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq1 });
      mockEq1.mockReturnValue({ eq: mockEq2 });
      mockEq2.mockReturnValue({ order: mockOrder });

      const result = await getTicketBundlesByClub("club-film-1");

      expect(mockFrom).toHaveBeenCalledWith("ticket_bundles");
      expect(result).toHaveLength(1);
      expect(result[0].bundle_name).toBe("Classic Cinema Series - Season Pass");
      expect(result[0].price_dollars).toBe(18.0);
    });
  });

  describe("checkBundleAvailability", () => {
    it("returns available: true when none of the underlying events are sold out", async () => {
      const mockBundle = {
        id: "bundle-1",
        club_id: "club-film-1",
        bundle_name: "Classic Cinema Series",
        price_dollars: 18.0,
        original_total_price: 25.0,
        discount_percentage: 28,
        status: "ACTIVE",
        created_at: "2026-08-20T00:00:00Z",
      };

      const mockBundleEvents = [
        {
          event_id: "evt-movie-1",
          events: { id: "evt-movie-1", title: "Casablanca", max_attendees: 50 },
        },
        {
          event_id: "evt-movie-2",
          events: { id: "evt-movie-2", title: "Citizen Kane", max_attendees: 50 },
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "ticket_bundles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockBundle, error: null }),
          };
        }
        if (table === "bundle_events") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockBundleEvents, error: null }),
          };
        }
        return {};
      });

      const availability = await checkBundleAvailability("bundle-1");

      expect(availability.available).toBe(true);
      expect(availability.sold_out_event_name).toBeNull();
      expect(availability.total_savings_dollars).toBe(7.0);
    });

    it("returns available: false when an underlying event is sold out", async () => {
      const mockBundle = {
        id: "bundle-1",
        club_id: "club-film-1",
        bundle_name: "Classic Cinema Series",
        price_dollars: 18.0,
        original_total_price: 25.0,
        discount_percentage: 28,
        status: "ACTIVE",
      };

      const mockBundleEvents = [
        {
          event_id: "evt-movie-1",
          events: { id: "evt-movie-1", title: "Casablanca", max_attendees: 0 }, // max_attendees 0 => sold out
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "ticket_bundles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockBundle, error: null }),
          };
        }
        if (table === "bundle_events") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockBundleEvents, error: null }),
          };
        }
        return {};
      });

      const availability = await checkBundleAvailability("bundle-1");

      expect(availability.available).toBe(false);
      expect(availability.sold_out_event_name).toBe("Casablanca");
    });
  });

  describe("createStripeBundleCheckoutSession", () => {
    it("blocks checkout if an event in the bundle is sold out", async () => {
      const mockBundle = {
        id: "bundle-1",
        price_dollars: 18.0,
        original_total_price: 25.0,
      };

      const mockBundleEvents = [
        {
          event_id: "evt-movie-1",
          events: { id: "evt-movie-1", title: "The Godfather", max_attendees: 0 },
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "ticket_bundles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockBundle, error: null }),
          };
        }
        if (table === "bundle_events") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockBundleEvents, error: null }),
          };
        }
        return {};
      });

      await expect(createStripeBundleCheckoutSession("bundle-1", "user-123")).rejects.toThrow(
        "Cannot purchase bundle. Event 'The Godfather' is sold out.",
      );
    });
  });

  describe("executeBundlePurchase", () => {
    it("calls purchase_ticket_bundle_transaction RPC and returns success", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          purchase_id: "pur-99",
          bundle_id: "bundle-1",
          rsvps_created_count: 5,
          amount_paid: 18.0,
        },
        error: null,
      });

      const result = await executeBundlePurchase("bundle-1", "user-123", "cs_stripe_123");

      expect(mockRpc).toHaveBeenCalledWith("purchase_ticket_bundle_transaction", {
        p_bundle_id: "bundle-1",
        p_user_id: "user-123",
        p_stripe_session_id: "cs_stripe_123",
      });

      expect(result.success).toBe(true);
      expect(result.rsvps_created_count).toBe(5);
      expect(result.amount_paid).toBe(18.0);
    });
  });
});
