import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendeeVenueMap, type AttendeeMapNode } from "./AttendeeVenueMap";

// Mock Auth
vi.mock("@/components/Auth/AuthSecurityContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

// Mock Supabase client
const mockInsertReport = vi.fn().mockResolvedValue({ error: null });
const mockUpdateReport = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/client", () => {
  const mockClient = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }),
    },
    rpc: (name: string) => {
      if (name === "is_system_admin") return Promise.resolve({ data: true, error: null });
      return Promise.resolve({ data: null, error: null });
    },
    channel: () => ({
      on: () => ({
        subscribe: () => ({}),
      }),
    }),
    removeChannel: () => Promise.resolve(),
    from: (table: string) => {
      if (table === "accessibility_reports") {
        return {
          insert: mockInsertReport,
          update: mockUpdateReport,
        };
      }
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
    },
  };

  return {
    createClient: () => mockClient,
    supabase: mockClient,
  };
});

// Mock React Query
const mockRefetchReports = vi.fn();
const mockReportsData = [
  {
    id: "report-1",
    venue_id: "venue-1",
    feature: "has_elevator",
    feature_type: "elevator",
    status: "reported_broken",
    description: "Elevator is stuck on level 2",
    photo_url: "/uploads/broken-elevator.jpg",
    created_at: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
    user_id: "user-1",
  },
];

vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: (opts: any) => {
    if (opts.queryKey[0] === "venue-accessibility-reports") {
      return {
        data: mockReportsData,
        isLoading: false,
        refetch: mockRefetchReports,
      };
    }
    if (opts.queryKey[0] === "is-system-admin-for-accessibility") {
      return {
        data: true, // admin
        isLoading: false,
      };
    }
    return { data: null, isLoading: false };
  },
  useMutation: (opts: any) => ({
    mutate: (arg?: any) => {
      return opts.mutationFn(arg).then(() => opts.onSuccess(arg));
    },
    isPending: false,
  }),
}));

const nodes: AttendeeMapNode[] = [
  {
    id: "entrance-1",
    entity_name: "Main Entrance",
    type: "entrance",
    x_coord: 0,
    y_coord: 0,
    width: 5,
    height: 5,
    rotation: 0,
  },
  {
    id: "elevator-1",
    entity_name: "North Elevator",
    type: "elevator",
    x_coord: 40,
    y_coord: 0,
    width: 5,
    height: 5,
    rotation: 0,
  },
  {
    id: "sponsor-1",
    entity_name: "Sponsor Booth",
    type: "sponsor",
    x_coord: 70,
    y_coord: 70,
    width: 10,
    height: 10,
    rotation: 0,
  },
];

describe("AttendeeVenueMap crowdsourced accessibility warnings", () => {
  it("renders active warning banner and excludes broken node from route guide", async () => {
    render(<AttendeeVenueMap nodes={nodes} venueId="venue-1" eventId="event-1" />);

    // 1. Verify warning banner exists
    expect(await screen.findByText("⚠ Accessibility Warning")).toBeInTheDocument();
    expect(screen.getByText(/elevator reported broken \(10 mins ago\)/i)).toBeInTheDocument();

    // 2. Turn on accessibility mode
    fireEvent.click(screen.getByRole("button", { name: /accessibility mode/i }));

    // 3. Since elevator is broken, the route segment to elevator should be excluded from safe routing,
    // so route guide list should not contain elevator directions
    expect(screen.queryByText(/north elevator is approximately/i)).not.toBeInTheDocument();
  });

  it("handles reporting a broken feature and resolving as admin", async () => {
    render(<AttendeeVenueMap nodes={nodes} venueId="venue-1" eventId="event-1" />);

    // 1. Click Report Broken Feature
    const reportBtn = screen.getByRole("button", { name: /report broken feature/i });
    fireEvent.click(reportBtn);

    // 2. Verify dialog title
    expect(await screen.findByText("Report Broken Feature")).toBeInTheDocument();

    // 3. Select type and fill description
    const descTextarea = screen.getByPlaceholderText(
      /the library elevator has an 'out of order' sign/i,
    );
    fireEvent.change(descTextarea, { target: { value: "Ramp is slippery and covered in ice." } });

    // 4. Click Submit
    const submitBtn = screen.getByRole("button", { name: "Submit Report" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsertReport).toHaveBeenCalled();
    });

    // 5. Verify resolve click triggers update mutation
    const repairBtn = screen.getByRole("button", { name: "Mark as Repaired" });
    fireEvent.click(repairBtn);

    await waitFor(() => {
      expect(mockUpdateReport).toHaveBeenCalled();
    });
  });
});
