import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DutchAuctionPanel } from "../components/events/DutchAuctionPanel";
import { DutchAuctionService } from "../services/dutchAuctionService";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "test-user-uuid" } },
  error: null,
});

const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn().mockReturnValue({
  eq: () => ({
    eq: () => ({
      eq: () => ({
        maybeSingle: mockMaybeSingle,
      }),
    }),
  }),
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
    from: (table: string) => {
      if (table === "event_rsvps") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "ticket_tiers") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: { capacity: 10 }, error: null }),
            }),
          }),
        };
      }
      return {
        select: mockSelect,
      };
    },
    rpc: vi.fn().mockResolvedValue({ data: 5000, error: null }),
    channel: () => ({
      on: () => ({
        on: () => ({
          subscribe: vi.fn(),
        }),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: (msg: string) => mockToastSuccess(msg),
    info: (msg: string) => mockToastInfo(msg),
  },
}));

// Mock DutchAuctionService
vi.mock("../services/dutchAuctionService", () => {
  return {
    DutchAuctionService: {
      getActiveAuction: vi.fn(),
      getCurrentPrice: vi.fn(),
      purchaseTicket: vi.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("DutchAuctionPanel Component", () => {
  const dummyAuction = {
    id: "auction-uuid",
    event_id: "event-uuid",
    ticket_tier_id: "tier-uuid",
    start_price_cents: 5000, // $50
    min_price_cents: 1000, // $10
    price_drop_interval_seconds: 60,
    price_drop_amount_cents: 100,
    starts_at: new Date(Date.now() - 5000).toISOString(), // started 5s ago
    ends_at: new Date(Date.now() + 1800000).toISOString(), // ends in 30 mins
    is_active: true,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    vi.mocked(DutchAuctionService.getActiveAuction).mockResolvedValue(dummyAuction);
    vi.mocked(DutchAuctionService.getCurrentPrice).mockResolvedValue(5000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders countdown timer, ticking dynamic price, and capacity", async () => {
    render(<DutchAuctionPanel eventId="event-uuid" />);

    // Wait for mock initialization
    await waitFor(() => {
      expect(screen.getByTestId("dutch-auction-panel")).toBeInTheDocument();
    });

    expect(screen.getByText("$50.00")).toBeInTheDocument();
    // Clock countdown should say 55s (since it started 5s ago, next drop is at 60s)
    expect(screen.getByTestId("dutch-ticking-clock")).toHaveTextContent("55s");
  });

  it("ticks price down automatically on intervals", async () => {
    render(<DutchAuctionPanel eventId="event-uuid" />);

    await waitFor(() => {
      expect(screen.getByTestId("dutch-auction-panel")).toBeInTheDocument();
    });

    // Advance clock by 60 seconds
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Price should drop from $50.00 to $49.00
    await waitFor(() => {
      expect(screen.getByText("$49.00")).toBeInTheDocument();
    });
  });

  it("triggers purchase with max slippage price limit constraints", async () => {
    vi.mocked(DutchAuctionService.purchaseTicket).mockResolvedValue({
      success: true,
      pricePaidCents: 5000,
      rsvpId: "rsvp-uuid",
      purchaseId: "purchase-uuid",
    });

    render(<DutchAuctionPanel eventId="event-uuid" />);

    await waitFor(() => {
      expect(screen.getByTestId("dutch-auction-panel")).toBeInTheDocument();
    });

    // Toggle max slippage input
    const maxPriceInput = screen.getByTestId("dutch-max-price-input") as HTMLInputElement;
    fireEvent.change(maxPriceInput, { target: { value: "55.00" } });

    // Click Buy button
    const buyButton = screen.getByTestId("dutch-buy-btn");
    fireEvent.click(buyButton);

    await waitFor(() => {
      expect(DutchAuctionService.purchaseTicket).toHaveBeenCalledWith(
        "auction-uuid",
        "test-user-uuid",
        5500
      );
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Ticket Purchased successfully")
      );
    });
  });
});
