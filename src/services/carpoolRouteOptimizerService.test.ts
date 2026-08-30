import { describe, it, expect, vi } from "vitest";
import {
  DirectionsApiError,
  buildAppleMapsDeepLink,
  buildDirectionsUrl,
  buildGoogleMapsDeepLink,
  buildHeuristicRoute,
  describeStop,
  haversineMeters,
  optimizeStopOrder,
  parseDirectionsResponse,
  resolveOptimizedRoute,
  type CarpoolRouteGroup,
  type RouteStop,
} from "./carpoolRouteOptimizerService";

const ORIGIN = { label: "Driver Dorm", lat: 42.73, lng: -73.67 };
const DESTINATION = { label: "Ski Resort", lat: 42.85, lng: -73.95 };

function stop(id: string, riderName: string, label: string, lat: number, lng: number): RouteStop {
  return { id, riderName, label, lat, lng };
}

function makeGroup(stops: RouteStop[]): CarpoolRouteGroup {
  return {
    carpoolId: "carpool-1",
    origin: ORIGIN,
    destination: DESTINATION,
    stops,
  };
}

describe("haversineMeters", () => {
  it("returns zero for identical points", () => {
    expect(haversineMeters(ORIGIN, ORIGIN)).toBe(0);
  });

  it("measures roughly one degree of latitude as ~111 km", () => {
    const distance = haversineMeters({ lat: 40, lng: -74 }, { lat: 41, lng: -74 });
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_500);
  });
});

describe("optimizeStopOrder", () => {
  it("passes through empty and single-stop lists untouched", () => {
    expect(optimizeStopOrder(ORIGIN, DESTINATION, [])).toEqual([]);
    const solo = [stop("s1", "Alice", "North Hall", 42.731, -73.668)];
    expect(optimizeStopOrder(ORIGIN, DESTINATION, solo)).toHaveLength(1);
  });

  it("orders pickups along the way without backtracking", () => {
    // Given in worst-possible order: farthest first, nearest last.
    const stops = [
      stop("far", "Carol", "Far Quad", 0, 90),
      stop("mid", "Bob", "Mid Hall", 0, 50),
      stop("near", "Alice", "Near Hall", 0, 10),
    ];
    const ordered = optimizeStopOrder({ lat: 0, lng: 0 }, { lat: 0, lng: 100 }, stops);
    expect(ordered.map((s) => s.id)).toEqual(["near", "mid", "far"]);
  });

  it("is deterministic across repeated calls", () => {
    const stops = [
      stop("a", "Alice", "North Hall", 42.733, -73.665),
      stop("b", "Bob", "South Hall", 42.728, -73.673),
      stop("c", "Carol", "East Quad", 42.7295, -73.669),
    ];
    const first = optimizeStopOrder(ORIGIN, DESTINATION, stops).map((s) => s.id);
    const second = optimizeStopOrder(ORIGIN, DESTINATION, stops).map((s) => s.id);
    expect(first).toEqual(second);
  });

  it("never produces an order worse than the naive input order", () => {
    const stops = [
      stop("a", "Alice", "North Hall", 42.733, -73.665),
      stop("b", "Bob", "South Hall", 42.728, -73.673),
      stop("c", "Carol", "East Quad", 42.7295, -73.669),
    ];
    const optimized = optimizeStopOrder(ORIGIN, DESTINATION, stops);

    const pathLen = (order: RouteStop[]) => {
      let cursor = ORIGIN;
      let total = 0;
      for (const point of order) {
        total += haversineMeters(cursor, point);
        cursor = point;
      }
      return total + haversineMeters(cursor, DESTINATION);
    };
    expect(pathLen(optimized)).toBeLessThanOrEqual(pathLen(stops));
  });
});

describe("buildDirectionsUrl", () => {
  it("requests driving directions with optimize:true waypoints", () => {
    const url = new URL(
      buildDirectionsUrl(makeGroup([stop("a", "Alice", "N", 42.731, -73.668)]), "key-123"),
    );
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/directions/json");
    expect(url.searchParams.get("origin")).toBe("42.730000,-73.670000");
    expect(url.searchParams.get("destination")).toBe("42.850000,-73.950000");
    expect(url.searchParams.get("mode")).toBe("driving");
    expect(url.searchParams.get("key")).toBe("key-123");
    expect(url.searchParams.get("waypoints")).toBe("optimize:true|42.731000,-73.668000");
  });

  it("pipes multiple waypoints after the optimize flag", () => {
    const group = makeGroup([
      stop("a", "Alice", "N", 42.731, -73.668),
      stop("b", "Bob", "S", 42.728, -73.673),
    ]);
    const waypoints = new URL(buildDirectionsUrl(group, "k").toString()).searchParams.get(
      "waypoints",
    );
    expect(waypoints).toBe("optimize:true|42.731000,-73.668000|42.728000,-73.673000");
  });
});

describe("parseDirectionsResponse", () => {
  const group = makeGroup([
    stop("alice", "Alice", "North Hall", 42.731, -73.668),
    stop("bob", "Bob", "South Hall", 42.728, -73.673),
  ]);

  function okResponse(waypointOrder: number[]) {
    return {
      status: "OK",
      routes: [
        {
          overview_polyline: { points: "abc~polyline" },
          waypoint_order: waypointOrder,
          legs: [
            { distance: { value: 800 }, duration: { value: 180 } },
            { distance: { value: 1200 }, duration: { value: 300 } },
            { distance: { value: 90000 }, duration: { value: 4500 } },
          ],
        },
      ],
    };
  }

  it("re-applies Google's waypoint_order and labels every leg", () => {
    const route = parseDirectionsResponse(okResponse([1, 0]), group);
    expect(route.provider).toBe("google");
    expect(route.orderedStops.map((s) => s.riderName)).toEqual(["Bob", "Alice"]);
    expect(route.legs.map((l) => l.fromLabel)).toEqual(["Driver Dorm", "South Hall", "North Hall"]);
    expect(route.legs[2].toLabel).toBe("Ski Resort");
    expect(route.totalDistanceMeters).toBe(92_000);
    expect(route.totalDurationSeconds).toBe(4_980);
    expect(route.overviewPolyline).toBe("abc~polyline");
  });

  it("keeps original order when Google omits waypoint_order", () => {
    const response = okResponse(undefined as unknown as number[]);
    const route = parseDirectionsResponse(response, group);
    expect(route.orderedStops.map((s) => s.riderName)).toEqual(["Alice", "Bob"]);
  });

  it("throws a typed error carrying the API status on failure", () => {
    expect(() => parseDirectionsResponse({ status: "REQUEST_DENIED" }, group)).toThrow(
      DirectionsApiError,
    );
    try {
      parseDirectionsResponse({ status: "REQUEST_DENIED" }, group);
    } catch (error) {
      expect((error as DirectionsApiError).apiStatus).toBe("REQUEST_DENIED");
    }
  });
});

describe("buildHeuristicRoute", () => {
  it("produces labelled legs and sane totals offline", () => {
    const group = makeGroup([stop("solo", "Alice", "North Hall", 42.731, -73.668)]);
    const route = buildHeuristicRoute(group);

    expect(route.provider).toBe("heuristic");
    expect(route.orderedStops[0].riderName).toBe("Alice");
    expect(route.legs).toHaveLength(2); // origin -> pickup -> venue
    expect(route.legs[0].fromLabel).toBe("Driver Dorm");
    expect(route.legs[1].toLabel).toBe("Ski Resort");
    expect(route.totalDistanceMeters).toBeGreaterThan(0);
    expect(route.totalDurationSeconds).toBeGreaterThan(0);
    expect(route.overviewPolyline).toBeNull();
  });
});

describe("deep links", () => {
  it("hands multi-stop navigation to Google Maps", () => {
    const link = buildGoogleMapsDeepLink(ORIGIN, DESTINATION, [
      stop("a", "Alice", "N", 42.731, -73.668),
    ]);
    expect(link.startsWith("https://www.google.com/maps/dir/?")).toBe(true);
    expect(link).toContain("api=1");
    expect(encodeURIComponent("42.731000,-73.668000")).not.toBeNull();
    const parsed = new URL(link);
    expect(parsed.searchParams.get("travelmode")).toBe("driving");
    expect(parsed.searchParams.get("destination")).toBe("42.850000,-73.950000");
    expect(parsed.searchParams.get("waypoints")).toContain("42.731000,-73.668000");
  });

  it("links Apple Maps start-to-venue (no multi-stop support)", () => {
    const link = new URL(buildAppleMapsDeepLink(ORIGIN, DESTINATION));
    expect(link.origin + link.pathname).toBe("https://maps.apple.com/");
    expect(link.searchParams.get("saddr")).toBe("42.730000,-73.670000");
    expect(link.searchParams.get("daddr")).toBe("42.850000,-73.950000");
    expect(link.searchParams.get("dirflg")).toBe("d");
  });
});

describe("resolveOptimizedRoute", () => {
  const group = makeGroup([stop("a", "Alice", "North Hall", 42.731, -73.668)]);

  it("uses the offline heuristic when no API key is configured", async () => {
    const { route, warning } = await resolveOptimizedRoute(group);
    expect(route.provider).toBe("heuristic");
    expect(warning).toBeNull();
  });

  it("prefers Google's optimized route when available", async () => {
    const httpGet = vi.fn().mockResolvedValue({
      status: "OK",
      routes: [
        {
          waypoint_order: [0],
          legs: [{ distance: { value: 700 }, duration: { value: 150 } }],
        },
      ],
    });
    const { route, warning } = await resolveOptimizedRoute(group, {
      apiKey: "key-abc",
      httpGet,
    });
    expect(warning).toBeNull();
    expect(route.provider).toBe("google");
    expect(route.totalDistanceMeters).toBe(700);
    expect(httpGet).toHaveBeenCalledWith(expect.stringContaining("optimize%3Atrue"));
  });

  it("falls back to the heuristic when the network call fails", async () => {
    const httpGet = vi.fn().mockRejectedValue(new Error("offline"));
    const { route, warning } = await resolveOptimizedRoute(group, {
      apiKey: "key-abc",
      httpGet,
    });
    expect(route.provider).toBe("heuristic");
    expect(warning).toContain("unavailable");
    expect(warning).toContain("estimated order");
  });

  it("surfaces the API status when Google refuses the request", async () => {
    const httpGet = vi.fn().mockResolvedValue({ status: "REQUEST_DENIED" });
    const { route, warning } = await resolveOptimizedRoute(group, {
      apiKey: "bad-key",
      httpGet,
    });
    expect(route.provider).toBe("heuristic");
    expect(warning).toContain("(REQUEST_DENIED)");
  });
});

describe("describeStop", () => {
  it("formats 'Stop N: Rider (Where)' summaries", () => {
    expect(describeStop(1, stop("a", "Alice", "North Hall", 42, -73))).toBe(
      "Stop 1: Alice (North Hall)",
    );
    expect(describeStop(2, stop("b", undefined, "Booth Stop", 42, -73))).toBe("Stop 2: Booth Stop");
  });
});
