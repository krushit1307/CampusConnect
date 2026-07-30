import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CampusEventMap, MapEventItem } from "./CampusEventMap";

const mockMap = { setView: vi.fn() };

// Mock react-leaflet to simplify DOM testing without Canvas/WebGL
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
    Popup: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="map-popup">{children}</div>
    ),
    useMap: () => mockMap,
  };
});

// Mock Supabase client
const mockSelect = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: mockSelect,
    }),
  }),
}));

describe("CampusEventMap Component", () => {
  const sampleEvents: MapEventItem[] = [
    {
      id: "event-1",
      title: "Tech Symposium 2026",
      description: "Annual tech conference on campus",
      location: "28.7041, 77.1025",
      latitude: 28.7041,
      longitude: 77.1025,
      start_date: "2026-08-15T09:00:00Z",
      end_date: "2026-08-15T17:00:00Z",
      club_name: "Coding Club",
      banner_url: "https://example.com/banner.jpg",
    },
    {
      id: "event-2",
      title: "Campus Music Night",
      description: "Live concert in main quad",
      location: "28.7050, 77.1030", // Parsed coordinates
      start_date: "2026-08-20T18:00:00Z",
      end_date: "2026-08-20T21:00:00Z",
      club_name: "Music Society",
    },
    {
      id: "event-3",
      title: "Online Coding Contest",
      description: "Virtual hackathon",
      location: "Online", // No coordinates -> Should be filtered out from map
      start_date: "2026-08-25T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ or: mockOr });
    mockOr.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ data: sampleEvents, error: null });
  });

  it("renders map container with provided events", async () => {
    render(
      <MemoryRouter>
        <CampusEventMap events={sampleEvents} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("campus-event-map-container")).toBeInTheDocument();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
    expect(screen.getByTestId("tile-layer")).toBeInTheDocument();

    // 2 events have valid coordinates (event-1 and event-2). event-3 is Online.
    const markers = screen.getAllByTestId("map-marker");
    expect(markers.length).toBe(2);
  });

  it("renders marker popup details and link to event page", async () => {
    render(
      <MemoryRouter>
        <CampusEventMap events={sampleEvents} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Tech Symposium 2026")).toBeInTheDocument();
    expect(screen.getByText("Hosted by Coding Club")).toBeInTheDocument();
    expect(screen.getByText("Campus Music Night")).toBeInTheDocument();

    const detailLinks = screen.getAllByRole("link", { name: /View Event Page/i });
    expect(detailLinks.length).toBe(2);
    expect(detailLinks[0]).toHaveAttribute("href", "/events/event-1");
    expect(detailLinks[1]).toHaveAttribute("href", "/events/event-2");
  });

  it("filters markers based on search query", async () => {
    render(
      <MemoryRouter>
        <CampusEventMap events={sampleEvents} />
      </MemoryRouter>,
    );

    const searchInput = screen.getByTestId("campus-map-search-input");
    fireEvent.change(searchInput, { target: { value: "Symposium" } });

    // Only Tech Symposium should match
    expect(screen.getByText("Tech Symposium 2026")).toBeInTheDocument();
    expect(screen.queryByText("Campus Music Night")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("map-marker").length).toBe(1);
  });

  it("shows empty state when no upcoming events have valid coordinates", async () => {
    const noCoordEvents: MapEventItem[] = [
      {
        id: "event-online",
        title: "Virtual Webinar",
        location: "Zoom",
      },
    ];

    render(
      <MemoryRouter>
        <CampusEventMap events={noCoordEvents} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/No upcoming events with location markers found/i)).toBeInTheDocument();
    expect(screen.queryByTestId("map-marker")).not.toBeInTheDocument();
  });

  it("fetches events from Supabase when initialEvents prop is omitted", async () => {
    render(
      <MemoryRouter>
        <CampusEventMap />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockSelect).toHaveBeenCalled();
      expect(screen.getByText("Tech Symposium 2026")).toBeInTheDocument();
    });
  });
});
