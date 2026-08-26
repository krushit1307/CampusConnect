import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SeatSwapMarketplace } from "./SeatSwapMarketplace";

// Mock Supabase client
const mockPropose = vi.fn().mockResolvedValue({ data: "req-1", error: null });
const mockAccept = vi.fn().mockResolvedValue({ data: true, error: null });
const mockReject = vi.fn().mockResolvedValue({ data: true, error: null });
const mockCancel = vi.fn().mockResolvedValue({ data: true, error: null });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: any) => {
      if (name === "propose_seat_swap") return mockPropose(args);
      if (name === "accept_seat_swap") return mockAccept(args);
      if (name === "reject_seat_swap") return mockReject(args);
      if (name === "cancel_seat_swap") return mockCancel(args);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === "seating_layouts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "layout-1" }, error: null })
            })
          });
        }
      }
      if (table === "seats") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({
                  data: [
                    { id: "seat-1", table_name: "A", seat_number: "1", status: "sold", locked_by: "user-1" },
                    { id: "seat-2", table_name: "Z", seat_number: "9", status: "sold", locked_by: "user-2" }
                  ],
                  error: null
                })
              })
            })
          });
        }
      }
      if (table === "event_rsvps") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { id: "rsvp-1" }, error: null }),
                eq: () => ({
                  single: () => Promise.resolve({ data: { id: "rsvp-2" }, error: null })
                })
              })
            })
          });
        }
      }
      return {
        select: () => ({
          or: () => ({
            order: () => Promise.resolve({ data: [], error: null })
          })
        })
      };
    }
  })
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: (opts: any) => {
    if (opts.queryKey[0] === "seating-marketplace-seats") {
      return {
        data: {
          seats: [
            { id: "seat-1", table_name: "A", seat_number: "1", status: "sold", locked_by: "user-1" },
            { id: "seat-2", table_name: "Z", seat_number: "9", status: "sold", locked_by: "user-2" }
          ]
        },
        isLoading: false
      };
    }
    if (opts.queryKey[0] === "my-rsvp-for-swap") {
      return { data: { id: "rsvp-1" }, isLoading: false };
    }
    if (opts.queryKey[0] === "seat-swap-requests") {
      return {
        data: [
          {
            id: "request-1",
            status: "pending",
            initiator_ticket_id: "rsvp-2",
            target_ticket_id: "rsvp-1",
            initiator: { user_id: "user-2", profiles: { first_name: "Bob", last_name: "Jones" } },
            target: { user_id: "user-1", profiles: { first_name: "Alice", last_name: "Smith" } }
          }
        ],
        isLoading: false
      };
    }
    return { data: [], isLoading: false };
  },
  useMutation: (opts: any) => ({
    mutate: (arg?: any) => opts.mutationFn(arg).then(opts.onSuccess),
    isPending: false
  })
}));

describe("Interactive Event Seat Swapping Module (#3550)", () => {
  it("renders seating info, proposals received and allows accept clicks", async () => {
    const user = { id: "user-1" } as any;

    render(<SeatSwapMarketplace eventId="event-1" user={user} />);

    // Verify title and my current seated spot
    expect(screen.getByText("Seat Swap Marketplace")).toBeInTheDocument();
    expect(screen.getByText("Table A - Seat 1")).toBeInTheDocument();

    // Verify Bob's proposal details
    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();

    // Click Accept button on received request
    const acceptBtn = screen.getByRole("button", { name: "Accept" });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalled();
    });
  });
});
