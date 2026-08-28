import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import CarpoolRouteOptimizer from "./CarpoolRouteOptimizer";
import * as optimizerService from "../../services/carpoolRouteOptimizerService";
import type { OptimizedRoute } from "../../services/carpoolRouteOptimizerService";

vi.mock("../../services/carpoolRouteOptimizerService", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../services/carpoolRouteOptimizerService")>();
  return {
    ...actual,
    resolveOptimizedRoute: vi.fn(),
  };
});

const mockedResolve = vi.mocked(optimizerService.resolveOptimizedRoute);

const GROUP: optimizerService.CarpoolRouteGroup = {
  carpoolId: "carpool-42",
  origin: { label: "Driver Dorm", lat: 42.73, lng: -73.67 },
  destination: { label: "Ski Resort", lat: 42.85, lng: -73.95 },
  stops: [
    { id: "s1", riderName: "Alice", label: "North Hall", lat: 42.731, lng: -73.668 },
    { id: "s2", riderName: "Bob", label: "South Hall", lat: 42.728, lng: -73.673 },
  ],
};

function makeRoute(overrides: Partial<OptimizedRoute> = {}): OptimizedRoute {
  return {
    provider: "google",
    orderedStops: GROUP.stops,
    legs: [
      {
        fromLabel: "Driver Dorm",
        toLabel: "North Hall",
        distanceMeters: 500,
        durationSeconds: 120,
      },
      { fromLabel: "North Hall", toLabel: "South Hall", distanceMeters: 900, durationSeconds: 240 },
      {
        fromLabel: "South Hall",
        toLabel: "Ski Resort",
        distanceMeters: 90_000,
        durationSeconds: 4_200,
      },
    ],
    totalDistanceMeters: 91_400,
    totalDurationSeconds: 4_560,
    overviewPolyline: null,
    ...overrides,
  };
}

describe("CarpoolRouteOptimizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ route: makeRoute(), warning: null });
  });

  it("shows a loading skeleton before the route resolves", () => {
    mockedResolve.mockReturnValue(new Promise(() => {}));
    render(<CarpoolRouteOptimizer group={GROUP} />);
    expect(screen.getByTestId("route-optimizer-loading")).toBeInTheDocument();
  });

  it("renders step-by-step stops and the final destination", async () => {
    render(<CarpoolRouteOptimizer group={GROUP} />);

    await waitFor(() => {
      expect(screen.getByTestId("route-stop-0")).toBeInTheDocument();
    });
    expect(screen.getByTestId("route-stop-0")).toHaveTextContent("Stop 1: Alice (North Hall)");
    expect(screen.getByTestId("route-stop-1")).toHaveTextContent("Stop 2: Bob (South Hall)");
    expect(screen.getByTestId("route-final-stop")).toHaveTextContent(
      "Final Destination: Ski Resort",
    );
    expect(screen.getByTestId("route-final-stop")).toHaveTextContent("1 h 16 min");
    expect(screen.getByTestId("route-final-stop")).toHaveTextContent("91.4 km");
  });

  it("badges a live-traffic route vs an estimated one", async () => {
    const { rerender } = render(<CarpoolRouteOptimizer group={GROUP} />);
    await waitFor(() => {
      expect(screen.getByTestId("route-provider-badge")).toHaveTextContent(
        "Live Traffic Optimized",
      );
    });

    mockedResolve.mockResolvedValue({
      route: makeRoute({ provider: "heuristic" }),
      warning: null,
    });
    rerender(<CarpoolRouteOptimizer group={{ ...GROUP, carpoolId: "carpool-43" }} />);
    await waitFor(() => {
      expect(screen.getByTestId("route-provider-badge")).toHaveTextContent("Estimated Order");
    });
  });

  it("surfaces a fallback warning when live optimization is unavailable", async () => {
    mockedResolve.mockResolvedValue({
      route: makeRoute({ provider: "heuristic" }),
      warning: "Live traffic optimization unavailable (REQUEST_DENIED); showing estimated order.",
    });
    render(<CarpoolRouteOptimizer group={GROUP} />);
    expect(await screen.findByTestId("route-warning")).toHaveTextContent(/REQUEST_DENIED/);
  });

  it("builds navigation deep links for both map providers", async () => {
    render(<CarpoolRouteOptimizer group={GROUP} />);
    const google = await screen.findByTestId("route-google-link");
    const apple = await screen.findByTestId("route-apple-link");

    expect(google).toHaveAttribute("target", "_blank");
    expect(google.getAttribute("href")).toContain("https://www.google.com/maps/dir/?");
    expect(google.getAttribute("href")).toContain("waypoints=");

    expect(apple).toHaveAttribute("target", "_blank");
    expect(apple.getAttribute("href")).toContain("https://maps.apple.com/?");
    expect(apple.getAttribute("href")).toContain("daddr=");
  });

  it("passes the API key through to the resolver", async () => {
    render(<CarpoolRouteOptimizer group={GROUP} apiKey="key-777" />);
    await waitFor(() => {
      expect(mockedResolve).toHaveBeenCalledWith(
        expect.objectContaining({ carpoolId: "carpool-42" }),
        expect.objectContaining({ apiKey: "key-777" }),
      );
    });
  });

  it("persists the resolved route via onSaveRoute", async () => {
    const onSaveRoute = vi.fn().mockResolvedValue(undefined);
    render(<CarpoolRouteOptimizer group={GROUP} onSaveRoute={onSaveRoute} />);
    await waitFor(() => {
      expect(onSaveRoute).toHaveBeenCalledWith(makeRoute());
    });
    expect(await screen.findByTestId("route-save-state")).toHaveTextContent("Route saved");
  });

  it("recomputes when the underlying stops change", async () => {
    const view = render(<CarpoolRouteOptimizer group={GROUP} />);
    await waitFor(() => {
      expect(mockedResolve).toHaveBeenCalledTimes(1);
    });

    const movedStop = { ...GROUP.stops[0], lat: 42.9 };
    view.rerender(
      <CarpoolRouteOptimizer group={{ ...GROUP, stops: [movedStop, GROUP.stops[1]] }} />,
    );

    await waitFor(() => {
      expect(mockedResolve).toHaveBeenCalledTimes(2);
    });
  });
});

export {};
