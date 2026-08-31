import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CarpoolRouteWaypointOptimizerWidget } from "./CarpoolRouteWaypointOptimizerWidget";

describe("CarpoolRouteWaypointOptimizerWidget Component (#4678)", () => {
  it("renders Carpool Route Waypoint Optimizer header, metrics, and pickup sequence", () => {
    render(
      <CarpoolRouteWaypointOptimizerWidget
        venueName="Regional Tech Conference Center"
        driverName="Alex Rivera"
      />
    );

    expect(screen.getByText(/Dynamic "Carpool" Route Waypoint Optimizer — Regional Tech Conference Center/i)).toBeInTheDocument();
    expect(screen.getByText("Route Efficiency Metrics")).toBeInTheDocument();
    expect(screen.getByText("Alice Vance")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Google Maps Navigation/i })).toBeInTheDocument();
  });

  it("re-calculates pickup sequence and triggers onRouteOptimized callback", () => {
    const handleOptimized = vi.fn();
    render(
      <CarpoolRouteWaypointOptimizerWidget
        venueName="Regional Tech Conference Center"
        onRouteOptimized={handleOptimized}
      />
    );

    const recalcBtn = screen.getByRole("button", { name: /Re-Calculate Pickup Order/i });
    fireEvent.click(recalcBtn);

    expect(handleOptimized).toHaveBeenCalledWith(
      expect.objectContaining({
        timeSavedMinutes: 25,
        originalDistanceMiles: 18.5,
      })
    );

    expect(screen.getByText(/Route re-optimized! Saved 25 minutes/i)).toBeInTheDocument();
  });
});
