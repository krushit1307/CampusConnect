import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventDetailsPage from "./events.$eventId";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      from: (table: string) => {
        if (table === "event_rsvps") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: "rsvp-123",
                        ticket_id: "ticket-123-uuid",
                        paid_amount_cents: 1500, // Paid ticket ($15.00)
                        user_id: "user-123",
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnSelf(),
          or: vi.fn().mockReturnSelf(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "evt-warning-123",
              title: "Scary Movie Screening",
              description:
                "A screening of a horror movie with lots of blood, gore, and flashing lights.",
              event_date: new Date(Date.now() + 86400000).toISOString(),
              start_date: new Date(Date.now() + 86400000).toISOString(),
              end_date: new Date(Date.now() + 90000000).toISOString(),
              location: "North Library Room A",
              max_attendees: 100,
              content_warnings: ["Violence", "Flashing Lights"],
              clubs: { name: "Film Club", slug: "film-club" },
              profiles: { full_name: "John Doe", email: "john@university.edu" },
              event_rsvps: [{ id: "rsvp-123", user_id: "user-123" }],
              attendee_count: 1,
              event_metrics: { views: 0 },
              venues: { name: "North Library Room A", latitude: 30, longitude: 76 },
            },
            error: null,
          }),
        };
      },
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123", email: "student@test.edu" } } }),
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: { access_token: "mock-token" } } }),
      },
      rpc: vi.fn().mockImplementation((name: string, args: any) => {
        if (name === "transfer_ticket_transaction") {
          if (args.p_recipient_email === "free@test.edu") {
            return Promise.resolve({
              data: {
                success: false,
                message:
                  "Free tickets cannot be transferred to prevent off-platform scalper hoarding.",
              },
              error: null,
            });
          }
          return Promise.resolve({
            data: { success: true, message: "Ticket transferred successfully!" },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    }),
    getSupabaseUrl: () => "https://mock.supabase.co",
  };
});

vi.mock("@/hooks/useEmailVerification", () => ({
  useEmailVerification: () => true,
}));

vi.mock("@/hooks/useOfflineRsvpSync", () => ({
  useOfflineRsvpSync: () => {},
}));

vi.mock("@/hooks/useGeofencedCheckIn", () => ({
  useGeofencedCheckIn: () => ({ checkIn: vi.fn(), checkedIn: false }),
}));

vi.mock("@/hooks/useTicketDownload", () => ({
  useTicketDownload: () => ({ downloadTicket: vi.fn(), isGenerating: false }),
}));

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: any) => <div data-testid="helmet">{children}</div>,
  HelmetProvider: ({ children }: any) => <div>{children}</div>,
}));

// Mock toast to capture errors
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
    success: vi.fn(),
  },
}));

describe("Automated Content Warning Tagging & Gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gates description and RSVP action, then reveals description on explicit consent", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/events/evt-warning-123"]}>
          <Routes>
            <Route path="/events/:eventId" element={<EventDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Wait for the event details to load and verify the title
    const eventTitle = await screen.findByText("Scary Movie Screening");
    expect(eventTitle).toBeInTheDocument();

    // Verify Content Warning box is displayed
    const warningHeader = screen.getByText("Content Warning");
    expect(warningHeader).toBeInTheDocument();
    expect(screen.getByText(/Violence, Flashing Lights/i)).toBeInTheDocument();

    // Verify reveal button exists
    const revealBtn = screen.getByRole("button", { name: /reveal description/i });
    expect(revealBtn).toBeInTheDocument();

    // Find and click RSVP button (first match is standard RSVP button)
    const rsvpButtons = screen.getAllByRole("button", { name: /RSVP/i });
    expect(rsvpButtons.length).toBeGreaterThan(0);
    fireEvent.click(rsvpButtons[0]);

    // Expect RSVP click to be blocked and toast to be fired
    expect(mockToastError).toHaveBeenCalledWith(
      "Please read and acknowledge the content warnings before RSVPing.",
    );

    // Now reveal description by clicking the consent button
    fireEvent.click(revealBtn);

    // Content Warning box should be gone
    expect(screen.queryByText("Content Warning")).not.toBeInTheDocument();

    // Try clicking RSVP button again
    fireEvent.click(rsvpButtons[0]);

    // Check that toast error was NOT called this time (it went past the content warning check)
    expect(mockToastError).toHaveBeenCalledTimes(1); // Still only the 1st blocked click
  });
});

describe("Peer-to-Peer Ticket Transfer System", () => {
  it("allows transferring paid tickets and triggers RPC execution", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/events/evt-warning-123"]}>
          <Routes>
            <Route path="/events/:eventId" element={<EventDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Wait for the page load
    const eventTitle = await screen.findByText("Scary Movie Screening");
    expect(eventTitle).toBeInTheDocument();

    // Verify Transfer Ticket button is displayed
    const transferBtn = await screen.findByRole("button", { name: /transfer ticket/i });
    expect(transferBtn).toBeInTheDocument();

    // Click Transfer Ticket
    fireEvent.click(transferBtn);

    // Verify Dialog title
    expect(await screen.findByText("Transfer Event Ticket")).toBeInTheDocument();

    // Fill in email
    const emailInput = screen.getByPlaceholderText(/student@university.edu/i);
    fireEvent.change(emailInput, { target: { value: "sarah@university.edu" } });

    // Click Confirm Transfer
    const confirmBtn = screen.getByRole("button", { name: "Confirm Transfer" });
    fireEvent.click(confirmBtn);

    // Expect transaction/mutation success (which closes the dialog)
    await waitFor(() => {
      expect(screen.queryByText("Transfer Event Ticket")).not.toBeInTheDocument();
    });
  });
});
