import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InteractiveCampusMap from "./events.interactive-map";

// ─── react-leaflet Mock ──────────────────────────────────────────────────────────
vi.mock("react-leaflet", () => {
  return {
    MapContainer: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="map-container">{children}</div>
    ),
    TileLayer: () => <div data-testid="tile-layer" />,
    Marker: ({
      children,
      position,
      eventHandlers,
    }: {
      children?: React.ReactNode;
      position?: [number, number];
      eventHandlers?: { click?: () => void };
    }) => (
      <div
        data-testid="map-marker"
        data-position={JSON.stringify(position)}
        onClick={eventHandlers?.click}
      >
        {children}
      </div>
    ),
    useMap: () => ({ setView: vi.fn() }),
  };
});

// ─── Supabase Client Mock ────────────────────────────────────────────────────────
const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: "user-123", email: "student@test.edu" } },
});

const mockSelect = vi.fn().mockReturnSelf();
const mockEq = vi.fn().mockResolvedValue({
  data: [
    { event_id: "event-active-1", status: "attending" }
  ],
  error: null
});

const mockFunctionsInvoke = vi.fn().mockResolvedValue({
  data: { success: true },
  error: null,
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: mockSelect,
      eq: mockEq,
    }),
    functions: {
      invoke: mockFunctionsInvoke,
    },
    channel: () => ({
      subscribe: (cb: any) => cb("SUBSCRIBED"),
    }),
    removeChannel: vi.fn(),
  }),
}));

// ─── react-query Mock ────────────────────────────────────────────────────────────
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: () => ({
    data: [
      {
        id: "event-active-1",
        title: "Hackathon Live Session",
        description: "Welcome to Thapar Hackathon!",
        start_date: new Date().toISOString(), // Currently active
        end_date: new Date(Date.now() + 3600000).toISOString(),
        location: "Athletics Complex",
        latitude: 30.0,
        longitude: 76.0,
        attendee_count: 50,
        banner_url: "https://example.com/banner.png",
        status: "ongoing",
        venues: { name: "Athletics Arena", latitude: 30.0, longitude: 76.0 },
      },
    ],
    isLoading: false,
  }),
  useMutation: ({ mutationFn, onSuccess }: any) => ({
    mutate: async (vars: any) => {
      const data = await mutationFn(vars);
      if (onSuccess) onSuccess(data, vars);
    },
    isPending: false,
  }),
}));

describe("InteractiveCampusMap Page Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders headers and plots glowing geographic markers", async () => {
    render(
      <MemoryRouter>
        <InteractiveCampusMap />
      </MemoryRouter>
    );

    // Verify header title and subtitled text
    expect(screen.getByText("Campus Snap Map")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("UPCOMING")).toBeInTheDocument();

    // Verify marker counts
    const markers = screen.getAllByTestId("map-marker");
    expect(markers.length).toBe(1);
    expect(markers[0]).toHaveAttribute("data-position", "[30,76]");
  });

  it("slides up a bottom-sheet when marker is clicked with details and rsvp trigger", async () => {
    render(
      <MemoryRouter>
        <InteractiveCampusMap />
      </MemoryRouter>
    );

    const marker = screen.getByTestId("map-marker");
    fireEvent.click(marker);

    // Verify bottom sheet title and venue details
    expect(screen.getByText("Hackathon Live Session")).toBeInTheDocument();
    expect(screen.getByText("Athletics Arena")).toBeInTheDocument();
    expect(screen.getByText("50 attendees")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Thapar Hackathon!")).toBeInTheDocument();

    // Verify instant RSVP button exists (shows RSVP'd because we mocked the status as 'attending')
    const rsvpBtn = screen.getByRole("button", { name: /rsvp'd/i });
    expect(rsvpBtn).toBeInTheDocument();

    // Click RSVP to cancel
    await act(async () => {
      fireEvent.click(rsvpBtn);
    });

    // Verify toggle-rsvp function invoke was triggered
    expect(mockFunctionsInvoke).toHaveBeenCalledWith("toggle-rsvp", expect.objectContaining({
      body: { eventId: "event-active-1", hasRsvpd: true }
    }));
  });
});
