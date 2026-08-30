import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RealTimeEventParkingMap } from "./RealTimeEventParkingMap";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { useSupabaseSubscription } from "@/hooks/useSupabaseSubscription";
import { DEFAULT_MOCK_PARKING_LOTS } from "./EventParkingMap";

vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/hooks/useSupabaseSubscription", () => ({
  useSupabaseSubscription: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

describe("RealTimeEventParkingMap Component (#4052)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders skeleton while loading", () => {
    (useQuery as any).mockReturnValue({ isLoading: true, data: null });
    render(<RealTimeEventParkingMap eventId="test-1" />);
    expect(screen.getByTestId("parking-map-skeleton")).toBeInTheDocument();
  });

  it("renders error state on error", () => {
    (useQuery as any).mockReturnValue({ isLoading: false, error: new Error("Failed to load") });
    render(<RealTimeEventParkingMap eventId="test-1" />);
    expect(screen.getByTestId("parking-map-error")).toBeInTheDocument();
    expect(screen.getByText(/Failed to load parking availability data/i)).toBeInTheDocument();
  });

  it("renders empty state when no parking lots are present", () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      data: { designated_parking_lots: [] },
    });
    render(<RealTimeEventParkingMap eventId="test-1" />);
    expect(screen.getByTestId("parking-map-empty")).toBeInTheDocument();
    expect(screen.getByText("No Designated Parking")).toBeInTheDocument();
  });

  it("renders the parking map when data is available", async () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      data: { designated_parking_lots: DEFAULT_MOCK_PARKING_LOTS },
    });

    render(<RealTimeEventParkingMap eventId="test-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("realtime-parking-map")).toBeInTheDocument();
      expect(screen.getByText(/Event Campus Parking Map/i)).toBeInTheDocument();
    });
  });

  it("sets up real-time subscription", () => {
    (useQuery as any).mockReturnValue({
      isLoading: false,
      data: { designated_parking_lots: DEFAULT_MOCK_PARKING_LOTS },
    });

    render(<RealTimeEventParkingMap eventId="test-1" />);

    expect(useSupabaseSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "events",
        event: "UPDATE",
        filter: "id=eq.test-1",
      }),
    );
  });
});
