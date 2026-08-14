import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import LostFoundPage, { CATEGORIES, type LostFoundItem } from "./lost-found";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
      eventHandlers?: { dragend?: (e: any) => void; click?: () => void };
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
    useMapEvents: ({ click }: { click: (e: any) => void }) => {
      // Mock click handler trigger
      (window as any).simulateMapClick = (lat: number, lng: number) => {
        click({ latlng: { lat, lng } });
      };
      return null;
    },
    useMap: () => ({ setView: vi.fn() }),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: () => ({
    user: { id: "user-1", email: "test@campus.edu" },
    isInitializing: false,
  }),
}));

const mockItems: LostFoundItem[] = [
  {
    id: "item-1",
    user_id: "user-1",
    type: "lost",
    title: "Blue AirPods Case",
    description: "Lost my AirPods case near the library entrance.",
    category: "Electronics",
    location: "Main Library",
    image_url: null,
    contact_info: "test@campus.edu",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    bounty_amount: 50,
    lat: 40.7128,
    lng: -74.006,
    floor_details: "3rd floor near computing lab",
    profiles: { full_name: "Test User", handle: "testuser" },
  },
  {
    id: "item-2",
    user_id: "user-2",
    type: "found",
    title: "Student ID Card",
    description: "Found a student ID card near the cafeteria entrance.",
    category: "Documents",
    location: "Cafeteria",
    image_url: null,
    contact_info: null,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    bounty_amount: 0,
    lat: null,
    lng: null,
    floor_details: null,
    profiles: { full_name: "Other User", handle: "otheruser" },
  },
];

const mockRpc = vi.fn().mockResolvedValue({ error: null });
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  track: vi.fn().mockResolvedValue("ok"),
  presenceState: vi.fn().mockReturnValue({}),
};

const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
    }),
    insert: mockInsert,
    update: mockUpdate,
    upsert: vi.fn().mockResolvedValue({ error: null }),
  }),
  rpc: mockRpc,
  channel: vi.fn(() => mockChannel),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
};

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn().mockImplementation((success) =>
    success({
      coords: {
        latitude: 40.73061,
        longitude: -73.935242,
      },
    }),
  ),
};
(global.navigator as any).geolocation = mockGeolocation;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <ThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LostFoundPage />
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
      }),
      order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
    }),
    insert: mockInsert,
    update: mockUpdate,
    upsert: vi.fn().mockResolvedValue({ error: null }),
  });
  mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LostFoundPage Map Features", () => {
  it("renders mini-map and floor details when present on lost item card", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Blue AirPods Case")).toBeInTheDocument();
    });

    // Verify floor details are rendered in details list
    expect(screen.getByText("3rd floor near computing lab")).toBeInTheDocument();
    // Verify mini map container is loaded
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("shows Grid and Map view mode toggle buttons and switches views", async () => {
    renderPage();
    const gridToggle = screen.getByRole("button", { name: /grid/i });
    const mapToggle = screen.getByRole("button", { name: /map/i });

    expect(gridToggle).toBeInTheDocument();
    expect(mapToggle).toBeInTheDocument();

    // Default should show active grid item list
    expect(screen.getByText("Blue AirPods Case")).toBeInTheDocument();

    // Toggle to map view
    fireEvent.click(mapToggle);
    await waitFor(() => {
      // Map view should display map container
      expect(screen.getAllByTestId("map-container").length).toBeGreaterThan(0);
    });
  });

  it("renders input fields for map coordinates and floor details in Post Dialog", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /post item/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Floor / Indoor Details optional input
    expect(screen.getByLabelText(/floor \/ indoor details/i)).toBeInTheDocument();
    // Map container inside Post Dialog should exist
    expect(screen.getAllByTestId("map-container").length).toBeGreaterThan(0);
  });
});
