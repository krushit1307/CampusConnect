// src/services/__tests__/ticketTradeService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchOpenTicketTrades,
  proposeTicketTrade,
  acceptTicketTrade,
  cancelTicketTrade,
} from "../ticketTradeService";

const mockRpc = vi.fn();
const mockSelect = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: mockSelect,
        }),
      }),
    }),
    rpc: mockRpc,
  }),
}));

describe("ticketTradeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proposeTicketTrade invokes propose_ticket_trade RPC correctly", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, trade_id: "trade-100", message: "Trade created" },
      error: null,
    });

    const result = await proposeTicketTrade("rsvp-1", "evt-2");
    expect(mockRpc).toHaveBeenCalledWith("propose_ticket_trade", {
      p_initiator_rsvp_id: "rsvp-1",
      p_requested_event_id: "evt-2",
    });
    expect(result.success).toBe(true);
    expect(result.trade_id).toBe("trade-100");
  });

  it("acceptTicketTrade invokes accept_ticket_trade RPC correctly", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, message: "Swap executed" },
      error: null,
    });

    const result = await acceptTicketTrade("trade-100", "rsvp-2");
    expect(mockRpc).toHaveBeenCalledWith("accept_ticket_trade", {
      p_trade_id: "trade-100",
      p_responder_rsvp_id: "rsvp-2",
    });
    expect(result.success).toBe(true);
  });

  it("cancelTicketTrade invokes cancel_ticket_trade RPC correctly", async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, message: "Trade cancelled" },
      error: null,
    });

    const result = await cancelTicketTrade("trade-100");
    expect(mockRpc).toHaveBeenCalledWith("cancel_ticket_trade", {
      p_trade_id: "trade-100",
    });
    expect(result.success).toBe(true);
  });
});
