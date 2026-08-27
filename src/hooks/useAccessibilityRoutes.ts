import { useState, useMemo, useCallback } from "react";
import type {
  AccessibleRoute,
  AccessiblePathway,
  TransitStop,
  VenueEntrance,
  AccessibilityReport,
  AccessibilityStats,
  AccessibilityFilterState,
  RouteDifficulty,
  PathwaySurface,
  TransitType,
  GeoPoint,
} from "../types/accessibility";

// ─── Helpers ─────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function estimateWalkingTime(distanceMeters: number, difficulty: RouteDifficulty): number {
  const baseSpeedMPerMin = difficulty === "easy" ? 80 : difficulty === "moderate" ? 60 : 40;
  return Math.round(distanceMeters / baseSpeedMPerMin);
}

function getDifficulty(
  avgGrade: number,
  hasObstacles: boolean,
  surfaceQuality: boolean
): RouteDifficulty {
  const score = avgGrade * 0.4 + (hasObstacles ? 40 : 0) + (surfaceQuality ? 0 : 20);
  if (score < 20) return "easy";
  if (score < 45) return "moderate";
  return "challenging";
}

// ─── Default Filters ─────────────────────────────────────────────────────

export const DEFAULT_FILTERS: AccessibilityFilterState = {
  searchQuery: "",
  minRating: 0,
  difficulty: [],
  wheelchairOnly: false,
  visualAidsOnly: false,
  transitType: [],
  surfaceType: [],
  maxDistance: 2000,
  sortBy: "rating",
};

// ─── Main Hook ───────────────────────────────────────────────────────────

export function useAccessibilityRoutes(
  routes: AccessibleRoute[],
  pathways: AccessiblePathway[],
  transitStops: TransitStop[],
  venueEntrances: VenueEntrance[],
  reports: AccessibilityReport[]
) {
  const [filters, setFilters] = useState<AccessibilityFilterState>(DEFAULT_FILTERS);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [allReports, setAllReports] = useState<AccessibilityReport[]>(reports);

  const updateFilter = useCallback(
    <K extends keyof AccessibilityFilterState>(key: K, value: AccessibilityFilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleDifficulty = useCallback((d: RouteDifficulty) => {
    setFilters((prev) => ({
      ...prev,
      difficulty: prev.difficulty.includes(d)
        ? prev.difficulty.filter((x) => x !== d)
        : [...prev.difficulty, d],
    }));
  }, []);

  const toggleTransitType = useCallback((t: TransitType) => {
    setFilters((prev) => ({
      ...prev,
      transitType: prev.transitType.includes(t)
        ? prev.transitType.filter((x) => x !== t)
        : [...prev.transitType, t],
    }));
  }, []);

  const toggleSurfaceType = useCallback((s: PathwaySurface) => {
    setFilters((prev) => ({
      ...prev,
      surfaceType: prev.surfaceType.includes(s)
        ? prev.surfaceType.filter((x) => x !== s)
        : [...prev.surfaceType, s],
    }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minRating > 0) count++;
    if (filters.difficulty.length > 0) count++;
    if (filters.wheelchairOnly) count++;
    if (filters.visualAidsOnly) count++;
    if (filters.transitType.length > 0) count++;
    if (filters.surfaceType.length > 0) count++;
    if (filters.maxDistance < 2000) count++;
    return count;
  }, [filters]);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    let result = [...routes];

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.transitStop.name.toLowerCase().includes(q) ||
          r.venueEntrance.venueName.toLowerCase().includes(q)
      );
    }

    if (filters.minRating > 0) {
      result = result.filter((r) => r.overallRating >= filters.minRating);
    }

    if (filters.difficulty.length > 0) {
      result = result.filter((r) => filters.difficulty.includes(r.difficulty));
    }

    if (filters.wheelchairOnly) {
      result = result.filter((r) => r.wheelchairFriendly);
    }

    if (filters.visualAidsOnly) {
      result = result.filter((r) => r.visuallyFriendly);
    }

    if (filters.transitType.length > 0) {
      result = result.filter((r) => filters.transitType.includes(r.transitStop.type));
    }

    if (filters.surfaceType.length > 0) {
      result = result.filter((r) =>
        r.pathways.some((p) => filters.surfaceType.includes(p.surface))
      );
    }

    result = result.filter((r) => r.totalDistanceMeters <= filters.maxDistance);

    switch (filters.sortBy) {
      case "rating":
        result.sort((a, b) => b.overallRating - a.overallRating);
        break;
      case "distance":
        result.sort((a, b) => a.totalDistanceMeters - b.totalDistanceMeters);
        break;
      case "difficulty":
        const diffOrder = { easy: 0, moderate: 1, challenging: 2 };
        result.sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty]);
        break;
      case "newest":
        result.sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
        break;
    }

    return result;
  }, [routes, filters]);

  // Selected route
  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === selectedRouteId) ?? null,
    [routes, selectedRouteId]
  );

  // Stats
  const stats = useMemo<AccessibilityStats>(() => {
    const verified = pathways.filter((p) => p.verifiedBy).length;
    const pending = allReports.filter((r) => r.status === "pending").length;
    const avgRating =
      routes.length > 0
        ? routes.reduce((sum, r) => sum + r.overallRating, 0) / routes.length
        : 0;
    const wheelchairRoutes = routes.filter((r) => r.wheelchairFriendly).length;

    return {
      totalPathways: pathways.length,
      verifiedPathways: verified,
      totalRoutes: routes.length,
      totalReports: allReports.length,
      pendingReports: pending,
      averageRouteRating: Math.round(avgRating * 10) / 10,
      wheelchairCoveragePercent:
        routes.length > 0 ? Math.round((wheelchairRoutes / routes.length) * 100) : 0,
      lastCommunityUpdate:
        allReports.length > 0
          ? new Date(Math.max(...allReports.map((r) => r.submittedAt.getTime())))
          : new Date(),
    };
  }, [pathways, routes, allReports]);

  // Submit report
  const submitReport = useCallback(
    (report: Omit<AccessibilityReport, "id" | "status" | "submittedAt" | "helpfulVotes">) => {
      const newReport: AccessibilityReport = {
        ...report,
        id: generateId(),
        status: "pending",
        submittedAt: new Date(),
        helpfulVotes: 0,
      };
      setAllReports((prev) => [newReport, ...prev]);
      return newReport;
    },
    []
  );

  // Vote helpful
  const voteHelpful = useCallback((reportId: string) => {
    setAllReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, helpfulVotes: r.helpfulVotes + 1 } : r))
    );
  }, []);

  return {
    filters,
    filteredRoutes,
    selectedRoute,
    selectedRouteId,
    setSelectedRouteId,
    updateFilter,
    toggleDifficulty,
    toggleTransitType,
    toggleSurfaceType,
    resetFilters,
    activeFilterCount,
    stats,
    allReports,
    submitReport,
    voteHelpful,
  };
}
