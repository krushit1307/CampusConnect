/**
 * useCampusActivity — Hook that manages heatmap data, filtering, and interaction state.
 */

import { useMemo, useState, useCallback } from "react";
import {
  EventCategory,
  DayOfWeek,
  HeatmapDataset,
  buildHeatmapDataset,
} from "@/utils/activityHeatmap";

export interface HeatmapFilters {
  selectedDays: DayOfWeek[];
  selectedCategories: EventCategory[];
  minHour: number;
  maxHour: number;
  locationFilter: string;
  weekRange: [number, number];
}

const INITIAL_FILTERS: HeatmapFilters = {
  selectedDays: [],
  selectedCategories: [],
  minHour: 6,
  maxHour: 23,
  locationFilter: "",
  weekRange: [1, 12],
};

export function useCampusActivity(seed = 42, totalWeeks = 12) {
  const [filters, setFilters] = useState<HeatmapFilters>(INITIAL_FILTERS);
  const [hoveredSlot, setHoveredSlot] = useState<{ day: DayOfWeek; hour: number } | null>(null);

  // Full dataset
  const fullDataset: HeatmapDataset = useMemo(
    () => buildHeatmapDataset(seed, totalWeeks),
    [seed, totalWeeks],
  );

  // Filtered time slots
  const filteredTimeSlots = useMemo(() => {
    return fullDataset.timeSlots.filter((slot) => {
      if (filters.selectedDays.length > 0 && !filters.selectedDays.includes(slot.day)) return false;
      if (slot.hour < filters.minHour || slot.hour > filters.maxHour) return false;
      return true;
    });
  }, [fullDataset.timeSlots, filters.selectedDays, filters.minHour, filters.maxHour]);

  // Filtered locations
  const filteredLocations = useMemo(() => {
    let locs = fullDataset.locations;
    if (filters.locationFilter) {
      locs = locs.filter((l) => l.location === filters.locationFilter);
    }
    return locs;
  }, [fullDataset.locations, filters.locationFilter]);

  // Heatmap grid max value for color scaling
  const gridMax = useMemo(
    () => Math.max(...filteredTimeSlots.map((s) => s.eventCount), 1),
    [filteredTimeSlots],
  );

  // All unique locations for filter dropdown
  const allLocations = useMemo(
    () => [...new Set(fullDataset.locations.map((l) => l.location))].sort(),
    [fullDataset.locations],
  );

  // Filter interaction handlers
  const toggleDay = useCallback((day: DayOfWeek) => {
    setFilters((prev) => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter((d) => d !== day)
        : [...prev.selectedDays, day],
    }));
  }, []);

  const toggleCategory = useCallback((cat: EventCategory) => {
    setFilters((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(cat)
        ? prev.selectedCategories.filter((c) => c !== cat)
        : [...prev.selectedCategories, cat],
    }));
  }, []);

  const setHourRange = useCallback((min: number, max: number) => {
    setFilters((prev) => ({ ...prev, minHour: min, maxHour: max }));
  }, []);

  const setLocation = useCallback((loc: string) => {
    setFilters((prev) => ({ ...prev, locationFilter: loc }));
  }, []);

  const setWeekRange = useCallback((range: [number, number]) => {
    setFilters((prev) => ({ ...prev, weekRange: range }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
  }, []);

  return {
    fullDataset,
    filteredTimeSlots,
    filteredLocations,
    gridMax,
    allLocations,
    filters,
    hoveredSlot,
    setHoveredSlot,
    toggleDay,
    toggleCategory,
    setHourRange,
    setLocation,
    setWeekRange,
    resetFilters,
  };
}
