/**
 * useCampusActivityInsights — Hook that computes campus activity insights,
 * trend comparisons, predictive forecasts, and exportable report data.
 *
 * Aggregates the heatmap dataset into actionable insights: weekly trends,
 * semester-over-semester comparison, peak activity prediction, and
 * per-club / per-location performance scoring.
 */

import { useMemo, useState, useCallback } from "react";
import {
  CampusEvent,
  DayOfWeek,
  EventCategory,
  HeatmapDataset,
  buildHeatmapDataset,
  generateMockEvents,
  ALL_DAYS,
  CATEGORY_LABELS,
} from "@/utils/activityHeatmap";

// ── Types ──────────────────────────────────────────────────────────

export interface WeeklyTrendPoint {
  week: number;
  label: string;
  events: number;
  rsvps: number;
  fillRate: number;
  topCategory: EventCategory;
  topLocation: string;
  clubCount: number;
}

export interface TrendComparison {
  metric: string;
  firstHalf: number;
  secondHalf: number;
  change: number;
  changePercent: number;
  direction: "up" | "down" | "flat";
}

export interface PredictionPoint {
  week: number;
  label: string;
  predictedRsvps: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface ClubPerformanceScore {
  club: string;
  eventCount: number;
  totalRsvps: number;
  avgFillRate: number;
  growthRate: number;
  consistencyScore: number;
  overallScore: number;
}

export interface LocationInsight {
  location: string;
  utilizationRate: number;
  peakWindow: string;
  recommendedAction: string;
  trend: "growing" | "stable" | "declining";
}

export interface CategoryInsight {
  category: EventCategory;
  totalEvents: number;
  totalRsvps: number;
  avgFillRate: number;
  growthRate: number;
  recommendedFocus: string;
}

export interface ActivityInsightsReport {
  weeklyTrends: WeeklyTrendPoint[];
  trendComparisons: TrendComparison[];
  predictions: PredictionPoint[];
  clubPerformance: ClubPerformanceScore[];
  locationInsights: LocationInsight[];
  categoryInsights: CategoryInsight[];
  topInsights: string[];
  summaryScore: number;
}

export interface ReportFilters {
  weekRange: [number, number];
  selectedClubs: string[];
  selectedLocations: string[];
  compareMode: "first-half-second-half" | "week-over-week";
}

const INITIAL_REPORT_FILTERS: ReportFilters = {
  weekRange: [1, 12],
  selectedClubs: [],
  selectedLocations: [],
  compareMode: "first-half-second-half",
};

// ── Computation Functions ──────────────────────────────────────────

function computeWeeklyTrends(events: CampusEvent[]): WeeklyTrendPoint[] {
  const maxWeek = Math.max(...events.map((e) => e.weekNumber), 1);
  const trends: WeeklyTrendPoint[] = [];

  for (let w = 1; w <= maxWeek; w++) {
    const weekEvents = events.filter((e) => e.weekNumber === w);
    const totalRsvps = weekEvents.reduce((s, e) => s + e.rsvpCount, 0);
    const avgFillRate =
      weekEvents.length > 0
        ? weekEvents.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / weekEvents.length
        : 0;

    const catCounts = new Map<EventCategory, number>();
    for (const e of weekEvents) {
      catCounts.set(e.category, (catCounts.get(e.category) || 0) + e.rsvpCount);
    }
    let topCategory: EventCategory = "tech";
    let maxCat = 0;
    for (const [c, n] of catCounts) {
      if (n > maxCat) {
        maxCat = n;
        topCategory = c;
      }
    }

    const locCounts = new Map<string, number>();
    for (const e of weekEvents) {
      locCounts.set(e.location, (locCounts.get(e.location) || 0) + 1);
    }
    let topLocation = "Main Auditorium";
    let maxLoc = 0;
    for (const [l, c] of locCounts) {
      if (c > maxLoc) {
        maxLoc = c;
        topLocation = l;
      }
    }

    const uniqueClubs = new Set(weekEvents.map((e) => e.club));

    trends.push({
      week: w,
      label: `Week ${w}`,
      events: weekEvents.length,
      rsvps: totalRsvps,
      fillRate: avgFillRate,
      topCategory,
      topLocation,
      clubCount: uniqueClubs.size,
    });
  }

  return trends;
}

function computeTrendComparisons(
  events: CampusEvent[],
  _mode: "first-half-second-half" | "week-over-week",
): TrendComparison[] {
  const comparisons: TrendComparison[] = [];
  const maxWeek = Math.max(...events.map((e) => e.weekNumber), 1);
  const halfWeek = Math.floor(maxWeek / 2);

  const firstHalf = events.filter((e) => e.weekNumber <= halfWeek);
  const secondHalf = events.filter((e) => e.weekNumber > halfWeek);

  // Event count
  const firstEvents = firstHalf.length;
  const secondEvents = secondHalf.length;
  const eventChange = secondEvents - firstEvents;
  comparisons.push({
    metric: "Total Events",
    firstHalf: firstEvents,
    secondHalf: secondEvents,
    change: eventChange,
    changePercent: firstEvents > 0 ? (eventChange / firstEvents) * 100 : 0,
    direction: eventChange > 0 ? "up" : eventChange < 0 ? "down" : "flat",
  });

  // RSVPs
  const firstRsvps = firstHalf.reduce((s, e) => s + e.rsvpCount, 0);
  const secondRsvps = secondHalf.reduce((s, e) => s + e.rsvpCount, 0);
  const rsvpChange = secondRsvps - firstRsvps;
  comparisons.push({
    metric: "Total RSVPs",
    firstHalf: firstRsvps,
    secondHalf: secondRsvps,
    change: rsvpChange,
    changePercent: firstRsvps > 0 ? (rsvpChange / firstRsvps) * 100 : 0,
    direction: rsvpChange > 0 ? "up" : rsvpChange < 0 ? "down" : "flat",
  });

  // Fill rate
  const firstFill =
    firstHalf.length > 0
      ? firstHalf.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / firstHalf.length
      : 0;
  const secondFill =
    secondHalf.length > 0
      ? secondHalf.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / secondHalf.length
      : 0;
  const fillChange = secondFill - firstFill;
  comparisons.push({
    metric: "Avg Fill Rate",
    firstHalf: Math.round(firstFill * 100),
    secondHalf: Math.round(secondFill * 100),
    change: Math.round(fillChange * 100),
    changePercent: firstFill > 0 ? (fillChange / firstFill) * 100 : 0,
    direction: fillChange > 0.01 ? "up" : fillChange < -0.01 ? "down" : "flat",
  });

  // Active clubs
  const firstClubs = new Set(firstHalf.map((e) => e.club)).size;
  const secondClubs = new Set(secondHalf.map((e) => e.club)).size;
  const clubChange = secondClubs - firstClubs;
  comparisons.push({
    metric: "Active Clubs",
    firstHalf: firstClubs,
    secondHalf: secondClubs,
    change: clubChange,
    changePercent: firstClubs > 0 ? (clubChange / firstClubs) * 100 : 0,
    direction: clubChange > 0 ? "up" : clubChange < 0 ? "down" : "flat",
  });

  // Venues used
  const firstLocs = new Set(firstHalf.map((e) => e.location)).size;
  const secondLocs = new Set(secondHalf.map((e) => e.location)).size;
  const locChange = secondLocs - firstLocs;
  comparisons.push({
    metric: "Venues Used",
    firstHalf: firstLocs,
    secondHalf: secondLocs,
    change: locChange,
    changePercent: firstLocs > 0 ? (locChange / firstLocs) * 100 : 0,
    direction: locChange > 0 ? "up" : locChange < 0 ? "down" : "flat",
  });

  return comparisons;
}

function computePredictions(
  weeklyTrends: WeeklyTrendPoint[],
  forecastWeeks: number = 4,
): PredictionPoint[] {
  const predictions: PredictionPoint[] = [];
  const n = weeklyTrends.length;
  if (n < 2) return predictions;

  const xs = weeklyTrends.map((_, i) => i + 1);
  const ys = weeklyTrends.map((t) => t.rsvps);

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const residuals = ys.map((y, i) => y - (slope * xs[i] + intercept));
  const residualVariance = residuals.reduce((s, r) => s + r * r, 0) / (n - 2);
  const residualStd = Math.sqrt(residualVariance);

  const yMean = sumY / n;
  const totalVariance = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
  const rSquared =
    totalVariance > 0 ? 1 - residuals.reduce((s, r) => s + r * r, 0) / totalVariance : 0;
  const confidence = Math.max(0, Math.min(1, rSquared));

  for (let i = 0; i < forecastWeeks; i++) {
    const week = n + 1 + i;
    const predicted = Math.max(0, Math.round(slope * week + intercept));
    const margin = Math.round(residualStd * (1.96 / Math.sqrt(n)) * (1 + i * 0.3));

    predictions.push({
      week,
      label: `Week ${week}`,
      predictedRsvps: predicted,
      lowerBound: Math.max(0, predicted - margin),
      upperBound: predicted + margin,
      confidence: Math.round(confidence * 100),
    });
  }

  return predictions;
}

function computeClubPerformance(events: CampusEvent[]): ClubPerformanceScore[] {
  const clubMap = new Map<string, CampusEvent[]>();
  for (const e of events) {
    if (!clubMap.has(e.club)) clubMap.set(e.club, []);
    clubMap.get(e.club)!.push(e);
  }

  const maxWeek = Math.max(...events.map((e) => e.weekNumber), 1);
  const halfWeek = Math.floor(maxWeek / 2);

  return Array.from(clubMap.entries())
    .map(([club, evts]) => {
      const totalRsvps = evts.reduce((s, e) => s + e.rsvpCount, 0);
      const avgFillRate = evts.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / evts.length;

      const firstHalf = evts.filter((e) => e.weekNumber <= halfWeek);
      const secondHalf = evts.filter((e) => e.weekNumber > halfWeek);
      const firstRsvps = firstHalf.reduce((s, e) => s + e.rsvpCount, 0);
      const secondRsvps = secondHalf.reduce((s, e) => s + e.rsvpCount, 0);
      const growthRate = firstRsvps > 0 ? (secondRsvps - firstRsvps) / firstRsvps : 0;

      const weekCounts = new Map<number, number>();
      for (const e of evts) {
        weekCounts.set(e.weekNumber, (weekCounts.get(e.weekNumber) || 0) + 1);
      }
      const counts = Array.from(weekCounts.values());
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
      const consistencyScore = Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));

      const eventScore = Math.min(evts.length / 20, 1);
      const rsvpScore = Math.min(totalRsvps / 3000, 1);
      const growthScore = Math.min(Math.max(growthRate + 0.5, 0), 1);
      const overallScore = Math.round(
        (eventScore * 0.25 +
          rsvpScore * 0.25 +
          avgFillRate * 0.25 +
          growthScore * 0.15 +
          (consistencyScore / 100) * 0.1) *
          100,
      );

      return {
        club,
        eventCount: evts.length,
        totalRsvps,
        avgFillRate,
        growthRate,
        consistencyScore,
        overallScore,
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore);
}

function computeLocationInsights(events: CampusEvent[]): LocationInsight[] {
  const locMap = new Map<string, CampusEvent[]>();
  for (const e of events) {
    if (!locMap.has(e.location)) locMap.set(e.location, []);
    locMap.get(e.location)!.push(e);
  }

  const maxWeek = Math.max(...events.map((e) => e.weekNumber), 1);
  const halfWeek = Math.floor(maxWeek / 2);

  return Array.from(locMap.entries())
    .map(([location, evts]) => {
      const totalCapacity = evts.reduce((s, e) => s + e.capacity, 0);
      const totalRsvps = evts.reduce((s, e) => s + e.rsvpCount, 0);
      const utilizationRate = totalCapacity > 0 ? totalRsvps / totalCapacity : 0;

      const hourCounts = new Map<number, number>();
      for (const e of evts) hourCounts.set(e.startHour, (hourCounts.get(e.startHour) || 0) + 1);
      let peakHour = 10;
      let maxH = 0;
      for (const [h, c] of hourCounts) {
        if (c > maxH) {
          maxH = c;
          peakHour = h;
        }
      }
      const peakWindow = `${peakHour}:00–${peakHour + 2}:00`;

      const firstHalf = evts.filter((e) => e.weekNumber <= halfWeek).length;
      const secondHalf = evts.filter((e) => e.weekNumber > halfWeek).length;
      const trendRatio = firstHalf > 0 ? secondHalf / firstHalf : 1;
      const trend: "growing" | "stable" | "declining" =
        trendRatio > 1.2 ? "growing" : trendRatio < 0.8 ? "declining" : "stable";

      let recommendedAction = "";
      if (utilizationRate < 0.4) {
        recommendedAction = "Consider promoting events at this venue to boost attendance";
      } else if (utilizationRate > 0.85) {
        recommendedAction = "High demand venue — consider expanding capacity or adding time slots";
      } else if (trend === "declining") {
        recommendedAction = "Activity declining — investigate scheduling conflicts or venue issues";
      } else {
        recommendedAction = "Healthy utilization — maintain current scheduling approach";
      }

      return {
        location,
        utilizationRate,
        peakWindow,
        recommendedAction,
        trend,
      };
    })
    .sort((a, b) => b.utilizationRate - a.utilizationRate);
}

function computeCategoryInsights(events: CampusEvent[]): CategoryInsight[] {
  const catMap = new Map<EventCategory, CampusEvent[]>();
  for (const e of events) {
    if (!catMap.has(e.category)) catMap.set(e.category, []);
    catMap.get(e.category)!.push(e);
  }

  const maxWeek = Math.max(...events.map((e) => e.weekNumber), 1);
  const halfWeek = Math.floor(maxWeek / 2);

  return Array.from(catMap.entries())
    .map(([category, evts]) => {
      const totalRsvps = evts.reduce((s, e) => s + e.rsvpCount, 0);
      const avgFillRate = evts.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / evts.length;

      const firstHalf = evts.filter((e) => e.weekNumber <= halfWeek);
      const secondHalf = evts.filter((e) => e.weekNumber > halfWeek);
      const firstRsvps = firstHalf.reduce((s, e) => s + e.rsvpCount, 0);
      const secondRsvps = secondHalf.reduce((s, e) => s + e.rsvpCount, 0);
      const growthRate = firstRsvps > 0 ? (secondRsvps - firstRsvps) / firstRsvps : 0;

      let recommendedFocus = "";
      if (growthRate > 0.2) {
        recommendedFocus = "Strong growth — increase event frequency to capitalize";
      } else if (avgFillRate > 0.75) {
        recommendedFocus = "High demand — consider premium or larger-venue events";
      } else if (growthRate < -0.1) {
        recommendedFocus = "Declining interest — refresh format or add new sub-events";
      } else {
        recommendedFocus = "Stable — maintain consistency and explore cross-category collabs";
      }

      return {
        category,
        totalEvents: evts.length,
        totalRsvps,
        avgFillRate,
        growthRate,
        recommendedFocus,
      };
    })
    .sort((a, b) => b.totalRsvps - a.totalRsvps);
}

function generateTopInsights(
  trendComparisons: TrendComparison[],
  clubPerformance: ClubPerformanceScore[],
  locationInsights: LocationInsight[],
  categoryInsights: CategoryInsight[],
): string[] {
  const insights: string[] = [];

  const rsvpComparison = trendComparisons.find((c) => c.metric === "Total RSVPs");
  if (rsvpComparison) {
    const dir =
      rsvpComparison.direction === "up"
        ? "increased"
        : rsvpComparison.direction === "down"
          ? "decreased"
          : "remained stable";
    insights.push(
      `RSVPs ${dir} by ${Math.abs(Math.round(rsvpComparison.changePercent))}% in the second half of the semester (${rsvpComparison.secondHalf.toLocaleString()} vs ${rsvpComparison.firstHalf.toLocaleString()}).`,
    );
  }

  if (clubPerformance.length > 0) {
    const top = clubPerformance[0];
    insights.push(
      `${top.club} leads with a score of ${top.overallScore}/100, hosting ${top.eventCount} events with ${top.totalRsvps.toLocaleString()} total RSVPs.`,
    );
  }

  const highDemand = locationInsights.filter((l) => l.utilizationRate > 0.8);
  if (highDemand.length > 0) {
    insights.push(
      `${highDemand.length} venue${highDemand.length > 1 ? "s" : ""} exceed${highDemand.length === 1 ? "s" : ""} 80% utilization: ${highDemand.map((l) => l.location).join(", ")}.`,
    );
  }

  const declining = locationInsights.filter((l) => l.trend === "declining");
  if (declining.length > 0) {
    insights.push(
      `${declining.length} location${declining.length > 1 ? "s" : ""} show${declining.length === 1 ? "s" : ""} declining activity: ${declining.map((l) => l.location).join(", ")}.`,
    );
  }

  const growing = categoryInsights.filter((c) => c.growthRate > 0.15);
  if (growing.length > 0) {
    insights.push(
      `Fastest-growing categories: ${growing.map((c) => `${CATEGORY_LABELS[c.category]} (+${Math.round(c.growthRate * 100)}%)`).join(", ")}.`,
    );
  }

  const fillComparison = trendComparisons.find((c) => c.metric === "Avg Fill Rate");
  if (fillComparison) {
    insights.push(
      `Average fill rate moved from ${fillComparison.firstHalf}% to ${fillComparison.secondHalf}% (${fillComparison.direction === "up" ? "↑" : fillComparison.direction === "down" ? "↓" : "→"}).`,
    );
  }

  const clubComparison = trendComparisons.find((c) => c.metric === "Active Clubs");
  if (clubComparison) {
    insights.push(
      `Active clubs grew from ${clubComparison.firstHalf} to ${clubComparison.secondHalf} in the second half of the semester.`,
    );
  }

  const mostConsistent = [...clubPerformance].sort(
    (a, b) => b.consistencyScore - a.consistencyScore,
  )[0];
  if (mostConsistent && mostConsistent.consistencyScore > 70) {
    insights.push(
      `${mostConsistent.club} shows the most consistent scheduling with a consistency score of ${mostConsistent.consistencyScore}/100.`,
    );
  }

  return insights.slice(0, 8);
}

function computeSummaryScore(
  trendComparisons: TrendComparison[],
  _clubPerformance: ClubPerformanceScore[],
  locationInsights: LocationInsight[],
): number {
  let score = 50;

  const rsvpComp = trendComparisons.find((c) => c.metric === "Total RSVPs");
  if (rsvpComp) {
    score += Math.min(Math.max(rsvpComp.changePercent / 10, -15), 15);
  }

  const fillComp = trendComparisons.find((c) => c.metric === "Avg Fill Rate");
  if (fillComp) {
    score += Math.min(Math.max((fillComp.secondHalf - 50) / 5, -10), 10);
  }

  const clubComp = trendComparisons.find((c) => c.metric === "Active Clubs");
  if (clubComp) {
    score += Math.min(clubComp.secondHalf - clubComp.firstHalf, 5);
  }

  const declining = locationInsights.filter((l) => l.trend === "declining").length;
  const total = locationInsights.length || 1;
  score -= (declining / total) * 10;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ── Main Hook ──────────────────────────────────────────────────────

export function useCampusActivityInsights(seed = 42, totalWeeks = 12) {
  const [reportFilters, setReportFilters] = useState<ReportFilters>(INITIAL_REPORT_FILTERS);

  const fullDataset: HeatmapDataset = useMemo(
    () => buildHeatmapDataset(seed, totalWeeks),
    [seed, totalWeeks],
  );

  const events: CampusEvent[] = useMemo(
    () => generateMockEvents(seed, totalWeeks),
    [seed, totalWeeks],
  );

  // Filter events by report filters
  const filteredEvents = useMemo(() => {
    let evts = events;
    evts = evts.filter(
      (e) =>
        e.weekNumber >= reportFilters.weekRange[0] && e.weekNumber <= reportFilters.weekRange[1],
    );
    if (reportFilters.selectedClubs.length > 0) {
      evts = evts.filter((e) => reportFilters.selectedClubs.includes(e.club));
    }
    if (reportFilters.selectedLocations.length > 0) {
      evts = evts.filter((e) => reportFilters.selectedLocations.includes(e.location));
    }
    return evts;
  }, [events, reportFilters]);

  const weeklyTrends = useMemo(() => computeWeeklyTrends(filteredEvents), [filteredEvents]);
  const trendComparisons = useMemo(
    () => computeTrendComparisons(filteredEvents, reportFilters.compareMode),
    [filteredEvents, reportFilters.compareMode],
  );
  const predictions = useMemo(() => computePredictions(weeklyTrends, 4), [weeklyTrends]);
  const clubPerformance = useMemo(() => computeClubPerformance(filteredEvents), [filteredEvents]);
  const locationInsights = useMemo(() => computeLocationInsights(filteredEvents), [filteredEvents]);
  const categoryInsights = useMemo(() => computeCategoryInsights(filteredEvents), [filteredEvents]);
  const topInsights = useMemo(
    () =>
      generateTopInsights(trendComparisons, clubPerformance, locationInsights, categoryInsights),
    [trendComparisons, clubPerformance, locationInsights, categoryInsights],
  );
  const summaryScore = useMemo(
    () => computeSummaryScore(trendComparisons, clubPerformance, locationInsights),
    [trendComparisons, clubPerformance, locationInsights],
  );

  const report: ActivityInsightsReport = useMemo(
    () => ({
      weeklyTrends,
      trendComparisons,
      predictions,
      clubPerformance,
      locationInsights,
      categoryInsights,
      topInsights,
      summaryScore,
    }),
    [
      weeklyTrends,
      trendComparisons,
      predictions,
      clubPerformance,
      locationInsights,
      categoryInsights,
      topInsights,
      summaryScore,
    ],
  );

  const allClubs = useMemo(() => [...new Set(events.map((e) => e.club))].sort(), [events]);
  const allLocations = useMemo(() => [...new Set(events.map((e) => e.location))].sort(), [events]);

  const setWeekRange = useCallback((range: [number, number]) => {
    setReportFilters((prev) => ({ ...prev, weekRange: range }));
  }, []);

  const toggleClub = useCallback((club: string) => {
    setReportFilters((prev) => ({
      ...prev,
      selectedClubs: prev.selectedClubs.includes(club)
        ? prev.selectedClubs.filter((c) => c !== club)
        : [...prev.selectedClubs, club],
    }));
  }, []);

  const toggleLocation = useCallback((loc: string) => {
    setReportFilters((prev) => ({
      ...prev,
      selectedLocations: prev.selectedLocations.includes(loc)
        ? prev.selectedLocations.filter((l) => l !== loc)
        : [...prev.selectedLocations, loc],
    }));
  }, []);

  const setCompareMode = useCallback((mode: "first-half-second-half" | "week-over-week") => {
    setReportFilters((prev) => ({ ...prev, compareMode: mode }));
  }, []);

  const resetFilters = useCallback(() => {
    setReportFilters(INITIAL_REPORT_FILTERS);
  }, []);

  const exportReport = useCallback(() => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campus-activity-report-w${reportFilters.weekRange[0]}-${reportFilters.weekRange[1]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, reportFilters.weekRange]);

  const exportCSV = useCallback(() => {
    const headers = [
      "Week",
      "Events",
      "RSVPs",
      "Fill Rate %",
      "Top Category",
      "Top Location",
      "Clubs Active",
    ];
    const rows = weeklyTrends.map((t) => [
      t.label,
      t.events,
      t.rsvps,
      Math.round(t.fillRate * 100),
      CATEGORY_LABELS[t.topCategory],
      t.topLocation,
      t.clubCount,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campus-activity-report-w${reportFilters.weekRange[0]}-${reportFilters.weekRange[1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [weeklyTrends, reportFilters.weekRange]);

  return {
    report,
    fullDataset,
    allClubs,
    allLocations,
    reportFilters,
    setWeekRange,
    toggleClub,
    toggleLocation,
    setCompareMode,
    resetFilters,
    exportReport,
    exportCSV,
  };
}
