import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { VenueCapacityOptimizerPrompt } from "../events/VenueCapacityOptimizerPrompt";
import { analyzeVenueCapacityOptimization } from "@/services/venueCapacityOptimizer";

vi.mock("@/services/venueCapacityOptimizer", () => ({
  analyzeVenueCapacityOptimization: vi.fn(),
}));

describe("VenueCapacityOptimizerPrompt Component (#3463)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders recommendation banner prompt when room is chronically under-capacity", async () => {
    (analyzeVenueCapacityOptimization as any).mockResolvedValue({
      should_upgrade: true,
      avg_waitlist_count: 15,
      current_venue_name: "Room 101",
      current_capacity: 30,
      suggested_venue_name: "Room 204",
      suggested_capacity: 50,
      prompt_message:
        "You consistently cap out Room 101 with 15 people on the waitlist. Room 204 (Capacity 50) is available on this date. Click here to upgrade your venue instantly.",
    });

    const mockUpgrade = vi.fn();

    render(
      <VenueCapacityOptimizerPrompt
        clubId="club-chess"
        selectedVenue="Room 101"
        onUpgradeVenue={mockUpgrade}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("capacity-optimization-prompt")).toBeInTheDocument();
      expect(
        screen.getByText(/You consistently cap out Room 101 with 15 people on the waitlist/i),
      ).toBeInTheDocument();
      expect(screen.getByTestId("upgrade-venue-btn")).toBeInTheDocument();
    });
  });

  it("triggers onUpgradeVenue callback with suggested room when upgrade button is clicked", async () => {
    (analyzeVenueCapacityOptimization as any).mockResolvedValue({
      should_upgrade: true,
      avg_waitlist_count: 15,
      current_venue_name: "Room 101",
      current_capacity: 30,
      suggested_venue_name: "Room 204",
      suggested_capacity: 50,
      prompt_message:
        "You consistently cap out Room 101 with 15 people on the waitlist. Room 204 (Capacity 50) is available on this date. Click here to upgrade your venue instantly.",
    });

    const mockUpgrade = vi.fn();

    render(
      <VenueCapacityOptimizerPrompt
        clubId="club-chess"
        selectedVenue="Room 101"
        onUpgradeVenue={mockUpgrade}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("upgrade-venue-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("upgrade-venue-btn"));

    expect(mockUpgrade).toHaveBeenCalledWith("Room 204", 50);
  });
});
