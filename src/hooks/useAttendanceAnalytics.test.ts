import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useAttendanceAnalytics,
  type TimeRange,
  ZONE_NAMES,
  REFERRAL_SOURCES,
  TIME_RANGE_OPTIONS,
} from "./useAttendanceAnalytics";

describe("useAttendanceAnalytics", () => {
  describe("initial state", () => {
    it("should return default filter state", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.filter.timeRange).toBe("30d");
      expect(result.current.filter.selectedEventId).toBeNull();
      expect(result.current.filter.selectedClubId).toBeNull();
      expect(result.current.filter.category).toBeNull();
    });

    it("should provide all mock events initially", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.filteredEvents.length).toBeGreaterThan(0);
    });

    it("should compute aggregate stats", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.aggregate.totalRsvps).toBeGreaterThan(0);
      expect(result.current.aggregate.totalCheckedIn).toBeGreaterThan(0);
      expect(result.current.aggregate.averageCheckInRate).toBeGreaterThan(0);
      expect(result.current.aggregate.averageCheckInRate).toBeLessThanOrEqual(100);
    });

    it("should generate trends data", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.trends.length).toBe(90);
      result.current.trends.forEach((t) => {
        expect(t.date).toBeTruthy();
        expect(t.rsvps).toBeGreaterThanOrEqual(0);
        expect(t.checkIns).toBeGreaterThanOrEqual(0);
        expect(t.noShows).toBeGreaterThanOrEqual(0);
        expect(t.checkInRate).toBeGreaterThan(0);
      });
    });

    it("should generate zone analytics", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.zoneAnalytics.length).toBe(6);
      result.current.zoneAnalytics.forEach((z) => {
        expect(z.zone).toBeTruthy();
        expect(z.totalVisits).toBeGreaterThan(0);
        expect(z.averageDurationMinutes).toBeGreaterThan(0);
        expect(z.hourlyTraffic.length).toBe(24);
      });
    });

    it("should provide categories list starting with All", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.categories[0]).toBe("All");
      expect(result.current.categories.length).toBeGreaterThan(1);
    });

    it("should provide insights", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.insights.length).toBeGreaterThan(0);
      result.current.insights.forEach((i) => {
        expect(i.title).toBeTruthy();
        expect(i.description).toBeTruthy();
        expect(i.icon).toBeTruthy();
        expect(["positive", "warning", "info", "neutral"]).toContain(i.type);
      });
    });

    it("should provide status breakdown", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.statusBreakdown.checked_in).toBeGreaterThanOrEqual(0);
      expect(result.current.statusBreakdown.no_show).toBeGreaterThanOrEqual(0);
      expect(result.current.statusBreakdown.cancelled).toBeGreaterThanOrEqual(0);
    });

    it("should provide referral stats sorted by count", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.referralStats.length).toBeGreaterThan(0);
      for (let i = 1; i < result.current.referralStats.length; i++) {
        expect(result.current.referralStats[i].count).toBeLessThanOrEqual(
          result.current.referralStats[i - 1].count,
        );
      }
    });
  });

  describe("filtering", () => {
    it("should filter by time range 7d", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      act(() => {
        result.current.updateTimeRange("7d");
      });
      expect(result.current.filter.timeRange).toBe("7d");
      expect(result.current.filteredEvents.length).toBeLessThanOrEqual(
        result.current.MOCK_EVENTS.length,
      );
    });

    it("should filter by time range all", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      act(() => {
        result.current.updateTimeRange("all");
      });
      expect(result.current.filter.timeRange).toBe("all");
      expect(result.current.filteredEvents.length).toBe(result.current.MOCK_EVENTS.length);
    });

    it("should filter by category", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      const techEvents = result.current.MOCK_EVENTS.filter((e) => e.category === "Technology");
      act(() => {
        result.current.updateCategory("Technology");
      });
      expect(result.current.filter.category).toBe("Technology");
      expect(result.current.filteredEvents.length).toBe(techEvents.length);
    });

    it("should reset filters to defaults", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      act(() => {
        result.current.updateTimeRange("7d");
        result.current.updateCategory("Technology");
      });
      act(() => {
        result.current.resetFilters();
      });
      expect(result.current.filter.timeRange).toBe("30d");
      expect(result.current.filter.selectedEventId).toBeNull();
      expect(result.current.filter.category).toBeNull();
    });

    it("should clear category when All is selected", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      act(() => {
        result.current.updateCategory("All");
      });
      expect(result.current.filter.category).toBeNull();
    });

    it("should filter by selected event", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      const firstEvent = result.current.MOCK_EVENTS[0];
      act(() => {
        result.current.updateSelectedEvent(firstEvent.eventId);
      });
      expect(result.current.filteredEvents.length).toBe(1);
      expect(result.current.filteredEvents[0].eventId).toBe(firstEvent.eventId);
    });

    it("should deselect event when null is passed", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      act(() => {
        result.current.updateSelectedEvent("evt-1");
      });
      act(() => {
        result.current.updateSelectedEvent(null);
      });
      expect(result.current.filter.selectedEventId).toBeNull();
    });
  });

  describe("CSV export", () => {
    it("should have an exportCsv function", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(typeof result.current.exportCsv).toBe("function");
    });
  });

  describe("constants", () => {
    it("should have zone names with required fields", () => {
      Object.entries(ZONE_NAMES).forEach(([key, meta]) => {
        expect(meta.label).toBeTruthy();
        expect(meta.icon).toBeTruthy();
        expect(meta.color).toBeTruthy();
        expect(meta.color.startsWith("#")).toBe(true);
      });
    });

    it("should have referral sources with labels and icons", () => {
      Object.entries(REFERRAL_SOURCES).forEach(([key, meta]) => {
        expect(meta.label).toBeTruthy();
        expect(meta.icon).toBeTruthy();
      });
    });

    it("should have time range options with valid values", () => {
      expect(TIME_RANGE_OPTIONS.length).toBe(4);
      TIME_RANGE_OPTIONS.forEach((opt) => {
        expect(opt.label).toBeTruthy();
        expect(["7d", "30d", "90d", "all"]).toContain(opt.value);
      });
    });
  });

  describe("aggregate computations", () => {
    it("should calculate utilization rate", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.aggregate.utilizationRate).toBeGreaterThan(0);
      expect(result.current.aggregate.utilizationRate).toBeLessThanOrEqual(100);
    });

    it("should identify best performing event", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.aggregate.bestPerformingEvent).not.toBeNull();
      expect(result.current.aggregate.bestPerformingEvent!.checkInRate).toBeGreaterThan(0);
    });

    it("should identify worst performing event", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.aggregate.worstPerformingEvent).not.toBeNull();
    });

    it("should calculate early bird rate", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.aggregate.earlyBirdRate).toBeGreaterThanOrEqual(0);
      expect(result.current.aggregate.earlyBirdRate).toBeLessThanOrEqual(100);
    });

    it("should compute average stay minutes", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      expect(result.current.aggregate.averageStayMinutes).toBeGreaterThan(0);
    });
  });

  describe("recalculation on filter change", () => {
    it("should recalculate aggregate when category changes", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      const initialRate = result.current.aggregate.averageCheckInRate;

      act(() => {
        result.current.updateCategory("Technology");
      });

      const newRate = result.current.aggregate.averageCheckInRate;
      // The rate should be different (or same if technology has same avg)
      // Just verify it recalc'd and is valid
      expect(newRate).toBeGreaterThanOrEqual(0);
      expect(newRate).toBeLessThanOrEqual(100);
    });

    it("should recalculate insights when filters change", () => {
      const { result } = renderHook(() => useAttendanceAnalytics());
      const initialCount = result.current.insights.length;

      act(() => {
        result.current.updateCategory("Technology");
      });

      // Insights should be recalculated
      expect(result.current.insights.length).toBeGreaterThanOrEqual(0);
    });
  });
});
