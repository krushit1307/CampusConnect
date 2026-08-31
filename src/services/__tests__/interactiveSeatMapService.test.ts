import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateAuditoriumSeatNodes,
  lockSeatTemporarily,
  confirmSeatReservation,
  DEFAULT_AUDITORIUM_CONFIG,
} from "../interactiveSeatMapService";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("Interactive Seat Map Service (#3873)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateAuditoriumSeatNodes", () => {
    it("generates auditorium 2D grid nodes based on schema and assigns VIP sections", () => {
      const nodes = generateAuditoriumSeatNodes(DEFAULT_AUDITORIUM_CONFIG);
      expect(nodes.length).toBe(60); // 6 rows * 10 cols

      const vipSeat = nodes.find((n) => n.seat_id === "Row-A-Seat-1");
      expect(vipSeat?.section).toBe("VIP");

      const genSeat = nodes.find((n) => n.seat_id === "Row-C-Seat-1");
      expect(genSeat?.section).toBe("General");
    });

    it("merges existing seat reservation statuses correctly", () => {
      const dbSeats = [
        {
          id: "seat-1",
          event_id: "event-1",
          seat_id: "Row-B-Seat-14",
          seat_label: "Row B, Seat 14",
          section: "VIP",
          status: "RESERVED" as const,
        },
      ];

      const nodes = generateAuditoriumSeatNodes(
        { rows: 3, cols: 15, vip_rows: ["B"], aisle_cols: [] },
        dbSeats,
      );

      const reservedNode = nodes.find((n) => n.seat_id === "Row-B-Seat-14");
      expect(reservedNode?.status).toBe("RESERVED");
    });
  });

  describe("lockSeatTemporarily", () => {
    it("locks seat temporarily during checkout to prevent double-booking", async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, status: "LOCKED" },
        error: null,
      });

      const result = await lockSeatTemporarily(
        "event-1",
        "Row-B-Seat-14",
        "Row B, Seat 14",
        "VIP",
        "user-1",
      );

      expect(result.success).toBe(true);
      expect(result.seat_id).toBe("Row-B-Seat-14");
      expect(result.status).toBe("LOCKED");
    });
  });

  describe("confirmSeatReservation", () => {
    it("binds seat_id and seat_label to user RSVP", async () => {
      mockRpc.mockResolvedValue({
        data: { success: true, status: "RESERVED" },
        error: null,
      });

      const result = await confirmSeatReservation(
        "event-1",
        "Row-B-Seat-14",
        "Row B, Seat 14",
        "user-1",
        "rsvp-101",
      );

      expect(result.success).toBe(true);
      expect(result.seatLabel).toBe("Row B, Seat 14");
    });
  });
});
