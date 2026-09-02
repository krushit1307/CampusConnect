import { useState, useMemo, useCallback } from "react";
import { useVenueAnalytics } from "./useVenueAnalytics";
import {
  computeVenueScore,
  generateVenueRecommendations,
  analyzeUtilizationTrend,
  detectBookingConflicts,
  estimateVenueCost,
  type VenueScoreInput,
  type VenueScoreBreakdown,
  type TrendAnalysis,
  type DetectedConflict,
  type CostEstimate,
  type BookingSlot,
} from "@/lib/venue-intelligence/venueScoringEngine";

// ─── Types ────────────────────────────────────────────────────────────

export interface VenueIntelligenceState {
  requiredCapacity: number;
  preferredAmenities: string[];
  budget: number;
  eventDurationHours: number;
  searchMode: "discover" | "compare" | "analyze";
  selectedVenueIds: string[];
  showConflictPanel: boolean;
}

export interface VenueIntelligenceResult {
  // From base analytics
  venues: ReturnType<typeof useVenueAnalytics>["venues"];
  utilization: ReturnType<typeof useVenueAnalytics>["utilization"];
  conflicts: ReturnType<typeof useVenueAnalytics>["conflicts"];
  upcomingBookings: ReturnType<typeof useVenueAnalytics>["upcomingBookings"];
  summary: ReturnType<typeof useVenueAnalytics>["summary"];
  heatmapData: ReturnType<typeof useVenueAnalytics>["heatmapData"];
  venueTypes: ReturnType<typeof useVenueAnalytics>["venueTypes"];

  // Intelligence additions
  recommendations: VenueScoreComparison[];
  topPicks: VenueScoreComparison[];
  trendAnalyses: Map<string, TrendAnalysis>;
  detectedConflicts: DetectedConflict[];
  costEstimates: Map<string, CostEstimate>;
  selectedVenueScores: VenueScoreBreakdown[];

  // State
  state: VenueIntelligenceState;

  // Actions
  setRequiredCapacity: (n: number) => void;
  setPreferredAmenities: (a: string[]) => void;
  toggleAmenity: (amenity: string) => void;
  setBudget: (b: number) => void;
  setEventDurationHours: (h: number) => void;
  setSearchMode: (m: "discover" | "compare" | "analyze") => void;
  toggleVenueSelection: (id: string) => void;
  clearVenueSelection: () => void;
  setShowConflictPanel: (show: boolean) => void;
  getVenueScore: (venueId: string) => VenueScoreBreakdown | undefined;
  getVenueCost: (venueId: string) => CostEstimate | undefined;
}

export interface VenueScoreComparison {
  venueId: string;
  venueName: string;
  matchScore: number;
  breakdown: VenueScoreBreakdown;
  reasons: string[];
  estimatedCost: number;
  estimatedCapacity: number;
}

// ─── Available Amenity Options ────────────────────────────────────────

export const AVAILABLE_AMENITIES = [
  "projector",
  "sound_system",
  "whiteboard",
  "air_conditioning",
  "recording",
  "live_stream",
  "wheelchair_access",
  "video_conferencing",
  "high_speed_internet",
  "computers",
  "3d_printers",
  "stage",
  "lighting",
  "catering",
  "vip_lounge",
  "open_air",
  "power_outlets",
  "changing_rooms",
] as const;

// ─── Hook ─────────────────────────────────────────────────────────────

export function useVenueIntelligence(): VenueIntelligenceResult {
  const analytics = useVenueAnalytics();

  const [state, setState] = useState<VenueIntelligenceState>({
    requiredCapacity: 100,
    preferredAmenities: ["projector", "sound_system"],
    budget: 200,
    eventDurationHours: 3,
    searchMode: "discover",
    selectedVenueIds: [],
    showConflictPanel: false,
  });

  // ─── Recommendations ──────────────────────────────────────────────

  const recommendations = useMemo<VenueScoreComparison[]>(() => {
    const recs = generateVenueRecommendations(analytics.venues, analytics.utilization, {
      requiredCapacity: state.requiredCapacity,
      preferredAmenities: state.preferredAmenities,
      budget: state.budget,
      limit: 10,
    });
    return recs.map((r) => ({
      venueId: r.venueId,
      venueName: r.venueName,
      matchScore: r.breakdown.total,
      breakdown: r.breakdown,
      reasons: r.recommendation.reasons,
      estimatedCost: r.recommendation.estimatedCost,
      estimatedCapacity: r.recommendation.estimatedCapacity,
    }));
  }, [analytics.venues, analytics.utilization, state]);

  const topPicks = useMemo(() => recommendations.slice(0, 3), [recommendations]);

  // ─── Trend Analyses ───────────────────────────────────────────────

  const trendAnalyses = useMemo(() => {
    const map = new Map<string, TrendAnalysis>();
    for (const u of analytics.utilization) {
      map.set(u.venueId, analyzeUtilizationTrend(u.weeklyData));
    }
    return map;
  }, [analytics.utilization]);

  // ─── Detected Conflicts ───────────────────────────────────────────

  const detectedConflicts = useMemo(() => {
    const slots: BookingSlot[] = analytics.upcomingBookings.map((b) => ({
      id: b.id,
      venueId: b.venueId,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      eventName: b.eventName,
    }));
    return detectBookingConflicts(slots);
  }, [analytics.upcomingBookings]);

  // ─── Cost Estimates ───────────────────────────────────────────────

  const costEstimates = useMemo(() => {
    const map = new Map<string, CostEstimate>();
    for (const v of analytics.venues) {
      map.set(v.id, estimateVenueCost(v, state.eventDurationHours));
    }
    return map;
  }, [analytics.venues, state.eventDurationHours]);

  // ─── Selected Venue Scores ────────────────────────────────────────

  const selectedVenueScores = useMemo(() => {
    return state.selectedVenueIds.map((id) => {
      const venue = analytics.venues.find((v) => v.id === id);
      const util = analytics.utilization.find((u) => u.venueId === id);
      if (!venue)
        return {
          capacityFit: 0,
          amenityMatch: 0,
          utilizationEfficiency: 0,
          satisfaction: 0,
          costEfficiency: 0,
          scheduleAvailability: 0,
          trendBonus: 0,
          total: 0,
        };
      const input: VenueScoreInput = {
        venue,
        utilization: util,
        requiredCapacity: state.requiredCapacity,
        preferredAmenities: state.preferredAmenities,
        budget: state.budget,
      };
      return computeVenueScore(input);
    });
  }, [state.selectedVenueIds, analytics.venues, analytics.utilization, state]);

  // ─── Actions ──────────────────────────────────────────────────────

  const setRequiredCapacity = useCallback(
    (n: number) => setState((s) => ({ ...s, requiredCapacity: Math.max(1, n) })),
    [],
  );

  const setPreferredAmenities = useCallback(
    (a: string[]) => setState((s) => ({ ...s, preferredAmenities: a })),
    [],
  );

  const toggleAmenity = useCallback((amenity: string) => {
    setState((s) => {
      const exists = s.preferredAmenities.includes(amenity);
      return {
        ...s,
        preferredAmenities: exists
          ? s.preferredAmenities.filter((a) => a !== amenity)
          : [...s.preferredAmenities, amenity],
      };
    });
  }, []);

  const setBudget = useCallback(
    (b: number) => setState((s) => ({ ...s, budget: Math.max(0, b) })),
    [],
  );

  const setEventDurationHours = useCallback(
    (h: number) => setState((s) => ({ ...s, eventDurationHours: Math.max(1, h) })),
    [],
  );

  const setSearchMode = useCallback(
    (m: "discover" | "compare" | "analyze") => setState((s) => ({ ...s, searchMode: m })),
    [],
  );

  const toggleVenueSelection = useCallback((id: string) => {
    setState((s) => {
      const exists = s.selectedVenueIds.includes(id);
      const next = exists
        ? s.selectedVenueIds.filter((i) => i !== id)
        : [...s.selectedVenueIds, id].slice(0, 5);
      return { ...s, selectedVenueIds: next };
    });
  }, []);

  const clearVenueSelection = useCallback(() => {
    setState((s) => ({ ...s, selectedVenueIds: [] }));
  }, []);

  const setShowConflictPanel = useCallback((show: boolean) => {
    setState((s) => ({ ...s, showConflictPanel: show }));
  }, []);

  const getVenueScore = useCallback(
    (venueId: string) => {
      const idx = state.selectedVenueIds.indexOf(venueId);
      return idx >= 0 ? selectedVenueScores[idx] : undefined;
    },
    [state.selectedVenueIds, selectedVenueScores],
  );

  const getVenueCost = useCallback(
    (venueId: string) => costEstimates.get(venueId),
    [costEstimates],
  );

  return {
    venues: analytics.venues,
    utilization: analytics.utilization,
    conflicts: analytics.conflicts,
    upcomingBookings: analytics.upcomingBookings,
    summary: analytics.summary,
    heatmapData: analytics.heatmapData,
    venueTypes: analytics.venueTypes,
    recommendations,
    topPicks,
    trendAnalyses,
    detectedConflicts,
    costEstimates,
    selectedVenueScores,
    state,
    setRequiredCapacity,
    setPreferredAmenities,
    toggleAmenity,
    setBudget,
    setEventDurationHours,
    setSearchMode,
    toggleVenueSelection,
    clearVenueSelection,
    setShowConflictPanel,
    getVenueScore,
    getVenueCost,
  };
}
