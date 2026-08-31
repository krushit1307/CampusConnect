/**
 * useAttendanceAnalytics — Hook that fetches and processes attendance analytics data.
 *
 * Provides filtered records, computed stats, trend data, category breakdown,
 * and heatmap data. Supports date range, category, and club filters.
 */

import { useMemo, useState, useCallback } from "react";
import {
  RawEvent,
  AttendanceRecord,
  DashboardStats,
  CategoryStats,
  TrendPoint,
  HeatmapCell,
  FilterOptions,
  transformEventsToRecords,
  computeDashboardStats,
  computeCategoryStats,
  computeTrendData,
  computeHeatmapData,
  filterByDateRange,
} from "@/utils/attendanceAnalytics";

// ── Mock Data (replaced by Supabase query in production) ──────────

const MOCK_EVENTS: RawEvent[] = [
  {
    id: "e1",
    title: "Annual Tech Fest — CodeSprint 2026",
    club_name: "CS Club",
    category: "tech",
    event_date: "2026-08-20T09:00:00Z",
    capacity: 200,
    rsvp_count: 156,
    checked_in_count: 142,
    rating: 4.9,
  },
  {
    id: "e2",
    title: "Classical Music Night — Raga Vibes",
    club_name: "Music Society",
    category: "concert",
    event_date: "2026-08-18T18:00:00Z",
    capacity: 500,
    rsvp_count: 312,
    checked_in_count: 287,
    rating: 4.7,
  },
  {
    id: "e3",
    title: "AI & Machine Learning Workshop",
    club_name: "AI/ML Club",
    category: "workshop",
    event_date: "2026-08-15T10:00:00Z",
    capacity: 60,
    rsvp_count: 58,
    checked_in_count: 55,
    rating: 4.8,
  },
  {
    id: "e4",
    title: "Inter-College Cricket Tournament",
    club_name: "Sports Council",
    category: "sports",
    event_date: "2026-08-12T07:00:00Z",
    capacity: 2000,
    rsvp_count: 1200,
    checked_in_count: 980,
    rating: 4.6,
  },
  {
    id: "e5",
    title: "Fresher's Welcome Party 2026",
    club_name: "Student Council",
    category: "social",
    event_date: "2026-08-10T17:00:00Z",
    capacity: 800,
    rsvp_count: 645,
    checked_in_count: 580,
    rating: 4.5,
  },
  {
    id: "e6",
    title: "Guest Lecture: Quantum Computing",
    club_name: "Physics Dept",
    category: "seminar",
    event_date: "2026-08-08T14:00:00Z",
    capacity: 200,
    rsvp_count: 134,
    checked_in_count: 128,
    rating: 4.8,
  },
  {
    id: "e7",
    title: "Photography Exhibition",
    club_name: "Photography Club",
    category: "exhibition",
    event_date: "2026-08-05T10:00:00Z",
    capacity: 300,
    rsvp_count: 89,
    checked_in_count: 72,
    rating: 4.4,
  },
  {
    id: "e8",
    title: "Career Fair — Spring 2026",
    club_name: "Placement Cell",
    category: "networking",
    event_date: "2026-08-03T09:00:00Z",
    capacity: 1500,
    rsvp_count: 1100,
    checked_in_count: 950,
    rating: 4.7,
  },
  {
    id: "e9",
    title: "Annual Day Celebration",
    club_name: "Cultural Committee",
    category: "cultural",
    event_date: "2026-07-30T16:00:00Z",
    capacity: 3000,
    rsvp_count: 2200,
    checked_in_count: 1890,
    rating: 4.9,
  },
  {
    id: "e10",
    title: "Web Dev Bootcamp",
    club_name: "Web Dev Club",
    category: "workshop",
    event_date: "2026-07-28T10:00:00Z",
    capacity: 40,
    rsvp_count: 38,
    checked_in_count: 36,
    rating: 4.6,
  },
  {
    id: "e11",
    title: "Yoga & Meditation Session",
    club_name: "Wellness Committee",
    category: "sports",
    event_date: "2026-07-25T06:30:00Z",
    capacity: 100,
    rsvp_count: 45,
    checked_in_count: 42,
    rating: 4.3,
  },
  {
    id: "e12",
    title: "Startup Pitch Night",
    club_name: "E-Cell",
    category: "networking",
    event_date: "2026-07-22T18:00:00Z",
    capacity: 150,
    rsvp_count: 120,
    checked_in_count: 105,
    rating: 4.7,
  },
  {
    id: "e13",
    title: "Hack Night — Build in 12 Hours",
    club_name: "Hack Club",
    category: "tech",
    event_date: "2026-07-20T18:00:00Z",
    capacity: 80,
    rsvp_count: 62,
    checked_in_count: 58,
    rating: 4.5,
  },
  {
    id: "e14",
    title: "International Food Festival",
    club_name: "International Club",
    category: "cultural",
    event_date: "2026-07-18T11:00:00Z",
    capacity: 1000,
    rsvp_count: 780,
    checked_in_count: 690,
    rating: 4.8,
  },
  {
    id: "e15",
    title: "Robotics Competition — Bot Wars",
    club_name: "Robotics Club",
    category: "tech",
    event_date: "2026-07-15T10:00:00Z",
    capacity: 100,
    rsvp_count: 95,
    checked_in_count: 91,
    rating: 4.8,
  },
  {
    id: "e16",
    title: "Ethics in AI Guest Lecture",
    club_name: "Philosophy Dept",
    category: "seminar",
    event_date: "2026-07-12T15:00:00Z",
    capacity: 200,
    rsvp_count: 185,
    checked_in_count: 180,
    rating: 4.9,
  },
  {
    id: "e17",
    title: "Spring Dance Recital",
    club_name: "Dance Club",
    category: "cultural",
    event_date: "2026-07-08T19:00:00Z",
    capacity: 400,
    rsvp_count: 320,
    checked_in_count: 295,
    rating: 4.6,
  },
  {
    id: "e18",
    title: "Data Science Workshop",
    club_name: "AI/ML Club",
    category: "workshop",
    event_date: "2026-07-05T10:00:00Z",
    capacity: 45,
    rsvp_count: 44,
    checked_in_count: 43,
    rating: 4.7,
  },
  {
    id: "e19",
    title: "Film Screening Night",
    club_name: "Film Society",
    category: "social",
    event_date: "2026-07-01T20:00:00Z",
    capacity: 120,
    rsvp_count: 98,
    checked_in_count: 88,
    rating: 4.2,
  },
  {
    id: "e20",
    title: "Open Mic Night",
    club_name: "Music Society",
    category: "concert",
    event_date: "2026-06-28T18:00:00Z",
    capacity: 200,
    rsvp_count: 175,
    checked_in_count: 160,
    rating: 4.5,
  },
  {
    id: "e21",
    title: "Blockchain Seminar",
    club_name: "CS Club",
    category: "seminar",
    event_date: "2026-06-25T14:00:00Z",
    capacity: 150,
    rsvp_count: 110,
    checked_in_count: 98,
    rating: 4.3,
  },
  {
    id: "e22",
    title: "Basketball Tournament",
    club_name: "Sports Council",
    category: "sports",
    event_date: "2026-06-22T08:00:00Z",
    capacity: 500,
    rsvp_count: 380,
    checked_in_count: 340,
    rating: 4.4,
  },
  {
    id: "e23",
    title: "Networking Mixer",
    club_name: "Placement Cell",
    category: "networking",
    event_date: "2026-06-20T17:00:00Z",
    capacity: 200,
    rsvp_count: 165,
    checked_in_count: 148,
    rating: 4.1,
  },
  {
    id: "e24",
    title: "Photography Walk",
    club_name: "Photography Club",
    category: "exhibition",
    event_date: "2026-06-18T07:00:00Z",
    capacity: 50,
    rsvp_count: 42,
    checked_in_count: 38,
    rating: 4.5,
  },
];

// ── Hook ──────────────────────────────────────────────────────────

export function useAttendanceAnalytics() {
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: "all",
    category: "all",
    club: "all",
  });

  const allRecords: AttendanceRecord[] = useMemo(() => transformEventsToRecords(MOCK_EVENTS), []);

  const records: AttendanceRecord[] = useMemo(() => {
    let filtered = filterByDateRange(allRecords, filters.dateRange);
    if (filters.category !== "all") {
      filtered = filtered.filter((r) => r.category === filters.category);
    }
    if (filters.club !== "all") {
      filtered = filtered.filter((r) => r.clubName === filters.club);
    }
    return filtered;
  }, [allRecords, filters]);

  const stats: DashboardStats = useMemo(() => computeDashboardStats(records), [records]);
  const categoryStats: CategoryStats[] = useMemo(() => computeCategoryStats(records), [records]);
  const trendData: TrendPoint[] = useMemo(() => computeTrendData(records), [records]);
  const heatmapData: HeatmapCell[] = useMemo(() => computeHeatmapData(records), [records]);

  const availableClubs = useMemo(
    () => [...new Set(allRecords.map((r) => r.clubName))].sort(),
    [allRecords],
  );

  const availableCategories = useMemo(
    () => [...new Set(allRecords.map((r) => r.category))].sort(),
    [allRecords],
  );

  const updateFilters = useCallback((patch: Partial<FilterOptions>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ dateRange: "all", category: "all", club: "all" });
  }, []);

  return {
    records,
    stats,
    categoryStats,
    trendData,
    heatmapData,
    filters,
    availableClubs,
    availableCategories,
    updateFilters,
    resetFilters,
  };
}
