/**
 * Tests for the campus activity heatmap data utilities.
 *
 * Covers event generation, time-slot grid computation,
 * location activity, club engagement, RSVP velocity, category distribution,
 * summary stats, and color utilities.
 */

import { describe, it, expect } from "vitest";
import {
  generateMockEvents,
  computeTimeSlotGrid,
  computeLocationActivity,
  computeClubEngagement,
  computeRSVPVelocity,
  computeCategoryDistribution,
  computeSummaryStats,
  buildHeatmapDataset,
  getHeatColor,
  getFillRateColor,
  ALL_DAYS,
  ALL_HOURS,
  type CampusEvent,
  type EventCategory,
} from "@/utils/activityHeatmap";

// ── Event Generation ───────────────────────────────────────────────

describe("generateMockEvents", () => {
  it("should generate events across 12 weeks by default", () => {
    const events = generateMockEvents();
    expect(events.length).toBeGreaterThan(50);

    const weeks = new Set(events.map((e) => e.weekNumber));
    expect(weeks.size).toBe(12);
  });

  it("should generate deterministic events for same seed", () => {
    const a = generateMockEvents(42, 4);
    const b = generateMockEvents(42, 4);
    expect(a.length).toBe(b.length);
    expect(a[0].id).toBe(b[0].id);
    expect(a[0].title).toBe(b[0].title);
  });

  it("should produce different events for different seeds", () => {
    const a = generateMockEvents(42, 4);
    const b = generateMockEvents(99, 4);
    expect(a[0].id).not.toBe(b[0].id);
  });

  it("should have valid hours within 6-23", () => {
    const events = generateMockEvents(42, 2);
    events.forEach((e) => {
      expect(e.startHour).toBeGreaterThanOrEqual(6);
      expect(e.startHour).toBeLessThanOrEqual(23);
    });
  });

  it("should have valid categories", () => {
    const events = generateMockEvents(42, 2);
    const validCategories: EventCategory[] = [
      "academic",
      "cultural",
      "sports",
      "tech",
      "social",
      "workshop",
      "seminar",
      "concert",
      "exhibition",
      "networking",
    ];
    events.forEach((e) => {
      expect(validCategories).toContain(e.category);
    });
  });

  it("should have rsvpCount <= capacity for all events", () => {
    const events = generateMockEvents(42, 6);
    events.forEach((e) => {
      expect(e.rsvpCount).toBeLessThanOrEqual(e.capacity);
      expect(e.rsvpCount).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── Time Slot Grid ─────────────────────────────────────────────────

describe("computeTimeSlotGrid", () => {
  it("should return one slot per day×hour combination", () => {
    const events = generateMockEvents(42, 2);
    const grid = computeTimeSlotGrid(events);
    expect(grid.length).toBe(ALL_DAYS.length * ALL_HOURS.length);
  });

  it("should have zero counts for empty slots", () => {
    const grid = computeTimeSlotGrid([]);
    grid.forEach((slot) => {
      expect(slot.eventCount).toBe(0);
      expect(slot.totalRsvps).toBe(0);
    });
  });

  it("should count events correctly in matching slots", () => {
    const mockEvents: CampusEvent[] = [
      {
        id: "test-1",
        title: "Test",
        category: "tech",
        dayOfWeek: "Mon",
        startHour: 10,
        durationHours: 1,
        location: "Lab",
        club: "CS",
        rsvpCount: 20,
        capacity: 50,
        weekNumber: 1,
      },
    ];
    const grid = computeTimeSlotGrid(mockEvents);
    const mon10 = grid.find((s) => s.day === "Mon" && s.hour === 10);
    expect(mon10).toBeDefined();
    expect(mon10!.eventCount).toBe(1);
    expect(mon10!.totalRsvps).toBe(20);
    expect(mon10!.categories.tech).toBe(1);
  });

  it("should handle multi-hour events spanning multiple slots", () => {
    const mockEvents: CampusEvent[] = [
      {
        id: "test-2",
        title: "Long Event",
        category: "workshop",
        dayOfWeek: "Wed",
        startHour: 14,
        durationHours: 3,
        location: "Lab",
        club: "Code",
        rsvpCount: 30,
        capacity: 60,
        weekNumber: 1,
      },
    ];
    const grid = computeTimeSlotGrid(mockEvents);
    expect(grid.find((s) => s.day === "Wed" && s.hour === 14)!.eventCount).toBe(1);
    expect(grid.find((s) => s.day === "Wed" && s.hour === 15)!.eventCount).toBe(1);
    expect(grid.find((s) => s.day === "Wed" && s.hour === 16)!.eventCount).toBe(1);
    expect(grid.find((s) => s.day === "Wed" && s.hour === 17)!.eventCount).toBe(0);
  });
});

// ── Location Activity ──────────────────────────────────────────────

describe("computeLocationActivity", () => {
  it("should return locations sorted by event count descending", () => {
    const events = generateMockEvents(42, 4);
    const locs = computeLocationActivity(events);
    for (let i = 1; i < locs.length; i++) {
      expect(locs[i - 1].totalEvents).toBeGreaterThanOrEqual(locs[i].totalEvents);
    }
  });

  it("should have peakHour and peakDay defined", () => {
    const events = generateMockEvents(42, 4);
    const locs = computeLocationActivity(events);
    locs.forEach((loc) => {
      expect(loc.peakHour).toBeGreaterThanOrEqual(6);
      expect(ALL_DAYS).toContain(loc.peakDay);
    });
  });

  it("should return empty for no events", () => {
    expect(computeLocationActivity([])).toHaveLength(0);
  });
});

// ── Club Engagement ────────────────────────────────────────────────

describe("computeClubEngagement", () => {
  it("should return clubs sorted by engagement score descending", () => {
    const events = generateMockEvents(42, 6);
    const clubs = computeClubEngagement(events);
    for (let i = 1; i < clubs.length; i++) {
      expect(clubs[i - 1].engagementScore).toBeGreaterThanOrEqual(clubs[i].engagementScore);
    }
  });

  it("should have engagement scores between 0 and 100", () => {
    const events = generateMockEvents(42, 6);
    const clubs = computeClubEngagement(events);
    clubs.forEach((club) => {
      expect(club.engagementScore).toBeGreaterThanOrEqual(0);
      expect(club.engagementScore).toBeLessThanOrEqual(100);
    });
  });
});

// ── RSVP Velocity ──────────────────────────────────────────────────

describe("computeRSVPVelocity", () => {
  it("should return one point per week", () => {
    const events = generateMockEvents(42, 8);
    const velocity = computeRSVPVelocity(events, 8);
    expect(velocity.length).toBe(8);
  });

  it("should have monotonically increasing week numbers", () => {
    const events = generateMockEvents(42, 8);
    const velocity = computeRSVPVelocity(events, 8);
    velocity.forEach((v, i) => {
      expect(v.week).toBe(i + 1);
    });
  });

  it("should have valid labels", () => {
    const events = generateMockEvents(42, 4);
    const velocity = computeRSVPVelocity(events, 4);
    velocity.forEach((v) => {
      expect(v.label).toMatch(/^W\d+$/);
    });
  });
});

// ── Category Distribution ──────────────────────────────────────────

describe("computeCategoryDistribution", () => {
  it("should return categories sorted by count descending", () => {
    const events = generateMockEvents(42, 4);
    const dist = computeCategoryDistribution(events);
    for (let i = 1; i < dist.length; i++) {
      expect(dist[i - 1].count).toBeGreaterThanOrEqual(dist[i].count);
    }
  });

  it("should have percentages summing to approximately 100", () => {
    const events = generateMockEvents(42, 4);
    const dist = computeCategoryDistribution(events);
    const total = dist.reduce((s, d) => s + d.percentage, 0);
    // Allow rounding error
    expect(total).toBeGreaterThanOrEqual(95);
    expect(total).toBeLessThanOrEqual(105);
  });
});

// ── Summary Stats ──────────────────────────────────────────────────

describe("computeSummaryStats", () => {
  it("should return correct total event count", () => {
    const events = generateMockEvents(42, 2);
    const stats = computeSummaryStats(events);
    expect(stats.totalEvents).toBe(events.length);
  });

  it("should return valid peak day", () => {
    const events = generateMockEvents(42, 4);
    const stats = computeSummaryStats(events);
    expect(ALL_DAYS).toContain(stats.peakDay);
  });

  it("should return valid peak hour in range", () => {
    const events = generateMockEvents(42, 4);
    const stats = computeSummaryStats(events);
    expect(stats.peakHour).toBeGreaterThanOrEqual(6);
    expect(stats.peakHour).toBeLessThanOrEqual(23);
  });
});

// ── Full Dataset Builder ───────────────────────────────────────────

describe("buildHeatmapDataset", () => {
  it("should return all dataset sections", () => {
    const dataset = buildHeatmapDataset(42, 4);
    expect(dataset.timeSlots.length).toBeGreaterThan(0);
    expect(dataset.locations.length).toBeGreaterThan(0);
    expect(dataset.clubs.length).toBeGreaterThan(0);
    expect(dataset.rsvpVelocity.length).toBe(4);
    expect(dataset.categories.length).toBeGreaterThan(0);
    expect(dataset.summaryStats.totalEvents).toBeGreaterThan(0);
  });
});

// ── Color Utilities ────────────────────────────────────────────────

describe("getHeatColor", () => {
  it("should return transparent for zero value", () => {
    expect(getHeatColor(0, 10)).toContain("0.03");
  });

  it("should return darker colors for higher values", () => {
    const low = getHeatColor(2, 10);
    const high = getHeatColor(9, 10);
    expect(low).not.toBe(high);
  });

  it("should handle max=0 gracefully", () => {
    expect(getHeatColor(5, 0)).toContain("0.02");
  });
});

describe("getFillRateColor", () => {
  it("should return red for high fill rates", () => {
    expect(getFillRateColor(0.95)).toBe("#ef4444");
  });

  it("should return green for low fill rates", () => {
    expect(getFillRateColor(0.3)).toBe("#10b981");
  });

  it("should return amber for medium fill rates", () => {
    expect(getFillRateColor(0.8)).toBe("#f59e0b");
  });
});
