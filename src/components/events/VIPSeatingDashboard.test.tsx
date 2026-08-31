import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VIPSeatingDashboard } from "./VIPSeatingDashboard";
import { useQuery } from "@/hooks/useReactQueryReplacement";

vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({}),
}));

describe("VIPSeatingDashboard", () => {
  it("shows loading state when data is fetching", () => {
    (useQuery as any).mockReturnValue({ data: null, isLoading: true });
    render(<VIPSeatingDashboard eventId="event-123" />);
    expect(screen.getByText(/Loading VIP Seating Data/i)).toBeInTheDocument();
  });

  it("renders tables and assigns attendees correctly", async () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === "map_nodes") {
        return {
          data: [
            { id: "node-1", entity_name: "VIP Table 1", required_ticket_tier_id: "tier-vip" },
            { id: "node-2", entity_name: "GA Table 1", required_ticket_tier_id: null },
          ],
          isLoading: false,
        };
      }
      if (queryKey[0] === "event_rsvps_assigned") {
        return {
          data: [
            {
              id: "rsvp-1",
              assigned_map_node_id: "node-1",
              ticket_tier_id: "tier-vip",
              profiles: { first_name: "John", last_name: "Doe" },
            },
          ],
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    render(<VIPSeatingDashboard eventId="event-123" />);

    await waitFor(() => {
      expect(screen.getByText("VIP & GA Seating Manager")).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText("VIP Table 1")).toBeInTheDocument();
    expect(screen.getByText("GA Table 1")).toBeInTheDocument();

    // Check attendee assignment
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("1 Assigned Attendees")).toBeInTheDocument();
    expect(screen.getByText("0 Assigned Attendees")).toBeInTheDocument();
  });
});
