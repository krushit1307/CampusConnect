/**
 * useEventRecommendations — Hook that drives the recommendation engine.
 *
 * Combines user profile data, mock event catalog, and collaborative
 * signals into ranked recommendation sets.
 */

import { useMemo, useState, useCallback } from "react";
import {
  Event,
  EventCategory,
  UserInteraction,
  ScoredEvent,
  RecommendationSet,
  buildUserProfile,
  scoreEvents,
  buildRecommendationSet,
  MOCK_EVENTS,
  MOCK_SIMILAR_USER_RATINGS,
  MOCK_USER_INTERACTIONS,
  MOCK_USER_PREFERENCES,
} from "@/utils/recommendationEngine";

export interface RecommendationFilters {
  categories: EventCategory[];
  maxPrice: number;
  minRating: number;
  dateRange: "7d" | "14d" | "30d" | "all";
}

export function useEventRecommendations() {
  const [interactions, setInteractions] = useState<UserInteraction[]>(MOCK_USER_INTERACTIONS);
  const [filters, setFilters] = useState<RecommendationFilters>({
    categories: [],
    maxPrice: Infinity,
    minRating: 0,
    dateRange: "all",
  });

  const userProfile = useMemo(
    () => buildUserProfile("user-1", "Campus Student", interactions),
    [interactions],
  );

  // Filter events
  const filteredEvents = useMemo(() => {
    let evts = [...MOCK_EVENTS];

    if (filters.categories.length > 0) {
      evts = evts.filter((e) => filters.categories.includes(e.category));
    }

    if (filters.maxPrice < Infinity) {
      evts = evts.filter((e) => !e.is_paid || (e.price ?? 0) <= filters.maxPrice);
    }

    if (filters.minRating > 0) {
      evts = evts.filter((e) => (e.rating ?? 0) >= filters.minRating);
    }

    if (filters.dateRange !== "all") {
      const now = Date.now();
      const days = { "7d": 7, "14d": 14, "30d": 30 }[filters.dateRange];
      const cutoff = now + days * 24 * 60 * 60 * 1000;
      evts = evts.filter((e) => new Date(e.event_date).getTime() <= cutoff);
    }

    return evts;
  }, [filters]);

  // Score and rank
  const scoredEvents: ScoredEvent[] = useMemo(
    () =>
      scoreEvents(
        filteredEvents,
        MOCK_USER_PREFERENCES.categoryAffinities,
        MOCK_USER_PREFERENCES.tagAffinities,
        MOCK_SIMILAR_USER_RATINGS,
      ),
    [filteredEvents],
  );

  // Build recommendation sets
  const recommendations: RecommendationSet = useMemo(
    () => buildRecommendationSet(scoredEvents),
    [scoredEvents],
  );

  // Interaction handlers
  const addInteraction = useCallback((eventId: string, action: UserInteraction["action"]) => {
    setInteractions((prev) => [...prev, { eventId, action, timestamp: new Date().toISOString() }]);
  }, []);

  const updateFilters = useCallback((patch: Partial<RecommendationFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleCategory = useCallback((cat: EventCategory) => {
    setFilters((prev) => {
      const cats = prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat];
      return { ...prev, categories: cats };
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ categories: [], maxPrice: Infinity, minRating: 0, dateRange: "all" });
  }, []);

  // Stats
  const userStats = useMemo(() => {
    const rsvps = interactions.filter((i) => i.action === "rsvp" || i.action === "checkin").length;
    const bookmarks = interactions.filter((i) => i.action === "bookmark").length;
    const views = interactions.filter((i) => i.action === "view").length;
    const topCategory = Object.entries(MOCK_USER_PREFERENCES.categoryAffinities).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return {
      totalInteractions: interactions.length,
      rsvps,
      bookmarks,
      views,
      topCategory: topCategory ? topCategory[0] : "N/A",
      avgScore:
        scoredEvents.length > 0
          ? scoredEvents.reduce((s, e) => s + e.score, 0) / scoredEvents.length
          : 0,
    };
  }, [interactions, scoredEvents]);

  return {
    userProfile,
    scoredEvents,
    recommendations,
    filters,
    userStats,
    addInteraction,
    updateFilters,
    toggleCategory,
    resetFilters,
  };
}
