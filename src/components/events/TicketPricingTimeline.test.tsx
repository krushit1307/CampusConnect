// src/components/events/TicketPricingTimeline.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TicketPricingTimeline } from "./TicketPricingTimeline";
import { supabase } from "@/lib/supabase/client";

// Helper to create a chainable mock query builder
const createQueryMock = (mockData: any = null) => {
  const queryMock: any = {};
  queryMock.select = vi.fn().mockReturnValue(queryMock);
  queryMock.eq = vi.fn().mockReturnValue(queryMock);
  queryMock.is = vi.fn().mockReturnValue(queryMock);
  queryMock.order = vi.fn().mockReturnValue(queryMock);
  queryMock.limit = vi.fn().mockReturnValue(queryMock);
  queryMock.single = vi.fn().mockResolvedValue({ data: mockData, error: null });
  queryMock.maybeSingle = vi.fn().mockResolvedValue({ data: mockData, error: null });
  queryMock.then = vi
    .fn()
    .mockImplementation((resolve) =>
      Promise.resolve({ data: mockData, error: null }).then(resolve),
    );
  return queryMock;
};

// Helper for chainable channel mock
const createChannelMock = () => {
  const channelMock: any = {};
  channelMock.on = vi.fn().mockReturnValue(channelMock);
  channelMock.subscribe = vi.fn().mockReturnValue({
    unsubscribe: vi.fn(),
  });
  return channelMock;
};

// Mock supabase client
vi.mock("@/lib/supabase/client", () => {
  const mockSupabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123", email: "user@college.edu" } },
      }),
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === "profiles") {
        return createQueryMock({ preferred_currency: "USD" });
      }
      return createQueryMock([]);
    }),
    rpc: vi.fn().mockImplementation((fnName) => {
      if (fnName === "get_active_ticket_tier") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    channel: vi.fn().mockImplementation(() => createChannelMock()),
  };
  return { supabase: mockSupabase };
});

// Mock CurrencyEstimate helper
vi.mock("@/components/CurrencyEstimate", () => ({
  CurrencyEstimate: () => <div data-testid="currency-estimate">$10.00 USD</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TicketPricingTimeline - Group RSVP", () => {
  const mockTiers = [
    {
      id: "tier-1",
      name: "Early Bird",
      price: 1000, // $10
      capacity: 100,
      start_date: null,
      end_date: null,
      sold_count: 0,
    },
  ];

  it("renders the Group RSVP checkbox", async () => {
    vi.spyOn(supabase, "from").mockImplementation((table) => {
      if (table === "event_rsvps") {
        return createQueryMock([]);
      }
      return createQueryMock(mockTiers);
    });

    render(<TicketPricingTimeline eventId="event-123" />);

    // Wait for the tiers to load and checkbox to render
    await waitFor(() => {
      expect(screen.getByLabelText(/Buy for a Group/i)).toBeInTheDocument();
    });
  });

  it("reveals 4 friend email input fields when Group RSVP is checked", async () => {
    vi.spyOn(supabase, "from").mockImplementation((table) => {
      if (table === "event_rsvps") {
        return createQueryMock([]);
      }
      return createQueryMock(mockTiers);
    });

    render(<TicketPricingTimeline eventId="event-123" />);

    const checkbox = await screen.findByLabelText(/Buy for a Group/i);
    fireEvent.click(checkbox);

    // Verify all 4 inputs render
    for (let i = 0; i < 4; i++) {
      expect(screen.getByLabelText(`Friend ${i + 1} Email`)).toBeInTheDocument();
    }
  });

  it("submits the correct friend emails and quantity on purchase", async () => {
    vi.spyOn(supabase, "from").mockImplementation((table) => {
      if (table === "event_rsvps") {
        return createQueryMock([]);
      }
      return createQueryMock(mockTiers);
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://stripe.com/checkout" }),
    });
    global.fetch = fetchMock;

    render(<TicketPricingTimeline eventId="event-123" />);

    const checkbox = await screen.findByLabelText(/Buy for a Group/i);
    fireEvent.click(checkbox);

    // Fill in the 4 emails
    const emails = ["f1@col.edu", "f2@col.edu", "f3@col.edu", "f4@col.edu"];
    emails.forEach((email, i) => {
      const input = screen.getByLabelText(`Friend ${i + 1} Email`);
      fireEvent.change(input, { target: { value: email } });
    });

    const buyButton = screen.getByRole("button", { name: /Buy Ticket/i });
    fireEvent.click(buyButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("create-stripe-checkout"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            eventId: "event-123",
            quantity: 5,
            friendEmails: emails,
          }),
        }),
      );
    });
  });
});
