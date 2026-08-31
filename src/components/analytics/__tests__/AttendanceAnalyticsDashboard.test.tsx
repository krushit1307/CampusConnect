/**
 * Tests for attendance analytics utility functions.
 *
 * Covers data transformation, statistics computation, filtering,
 * formatting, and CSV export helpers.
 */

import { describe, it, expect } from "vitest";
import {
  transformEventsToRecords,
  computeDashboardStats,
  computeCategoryStats,
  computeTrendData,
  computeHeatmapData,
  filterByDateRange,
  formatNumber,
  formatPercent,
  formatDateShort,
  exportToCsv,
  getCategoryColor,
  type RawEvent,
} from "@/utils/attendanceAnalytics";

// ── Test Fixtures ──────────────────────────────────────────────────

const MOCK_EVENTS: RawEvent[] = [
  {
    id: "e1",
    title: "Hackathon 2026",
    club_name: "CS Club",
    category: "tech",
    event_date: "2026-08-20T09:00:00Z",
    capacity: 200,
    rsvp_count: 150,
    checked_in_count: 130,
    rating: 4.8,
  },
  {
    id: "e2",
    title: "Music Night",
    club_name: "Music Society",
    category: "concert",
    event_date: "2026-08-15T18:00:00Z",
    capacity: 500,
    rsvp_count: 300,
    checked_in_count: 280,
    rating: 4.6,
  },
  {
    id: "e3",
    title: "AI Workshop",
    club_name: "AI/ML Club",
    category: "workshop",
    event_date: "2026-08-10T10:00:00Z",
    capacity: 60,
    rsvp_count: 55,
    checked_in_count: 50,
    rating: 4.9,
  },
];

// ── Transform Tests ────────────────────────────────────────────────

describe("transformEventsToRecords", () => {
  it("should transform raw events to attendance records", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    expect(records).toHaveLength(3);

    expect(records[0]).toEqual({
      eventId: "e1",
      title: "Hackathon 2026",
      clubName: "CS Club",
      category: "tech",
      eventDate: "2026-08-20T09:00:00Z",
      capacity: 200,
      rsvps: 150,
      checkedIn: 130,
      noShowCount: 20,
      attendanceRate: expect.closeTo(86.67, 1),
      rating: 4.8,
    });
  });

  it("should handle zero RSVPs gracefully", () => {
    const events: RawEvent[] = [
      {
        id: "e-zero",
        title: "Empty Event",
        club_name: "Club",
        category: "social",
        event_date: "2026-08-01T10:00:00Z",
        capacity: 100,
        rsvp_count: 0,
        checked_in_count: 0,
        rating: null,
      },
    ];
    const records = transformEventsToRecords(events);
    expect(records[0].attendanceRate).toBe(0);
    expect(records[0].noShowCount).toBe(0);
  });

  it("should handle more check-ins than RSVPs (walk-ins)", () => {
    const events: RawEvent[] = [
      {
        id: "e-walkin",
        title: "Open Event",
        club_name: "Club",
        category: "social",
        event_date: "2026-08-01T10:00:00Z",
        capacity: 100,
        rsvp_count: 30,
        checked_in_count: 50,
        rating: 4.0,
      },
    ];
    const records = transformEventsToRecords(events);
    expect(records[0].noShowCount).toBe(-20);
    expect(records[0].checkedIn).toBe(50);
  });
});

// ── Dashboard Stats Tests ──────────────────────────────────────────

describe("computeDashboardStats", () => {
  it("should compute aggregate stats correctly", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const stats = computeDashboardStats(records);

    expect(stats.totalEvents).toBe(3);
    expect(stats.totalRSVPs).toBe(505);
    expect(stats.totalCheckIns).toBe(460);
    expect(stats.totalCapacity).toBe(760);
    expect(stats.noShowTotal).toBe(45);
    expect(stats.avgAttendanceRate).toBeGreaterThan(85);
    expect(stats.avgRating).not.toBeNull();
    expect(stats.conversionRate).toBeGreaterThan(85);
  });

  it("should return zeros for empty input", () => {
    const stats = computeDashboardStats([]);
    expect(stats.totalEvents).toBe(0);
    expect(stats.avgRating).toBeNull();
    expect(stats.mostActiveClub).toBe("N/A");
  });

  it("should identify the most active club by total RSVPs", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const stats = computeDashboardStats(records);
    expect(stats.mostActiveClub).toBe("Music Society");
  });
});

// ── Category Stats Tests ───────────────────────────────────────────

describe("computeCategoryStats", () => {
  it("should group events by category", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const catStats = computeCategoryStats(records);

    expect(catStats).toHaveLength(3);
    expect(catStats.map((c) => c.category).sort()).toEqual(["concert", "tech", "workshop"]);
  });

  it("should compute per-category attendees correctly", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const catStats = computeCategoryStats(records);

    const concertStat = catStats.find((c) => c.category === "concert");
    expect(concertStat?.totalAttendees).toBe(280);
    expect(concertStat?.totalEvents).toBe(1);
  });

  it("should assign colors to categories", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const catStats = computeCategoryStats(records);

    catStats.forEach((cs) => {
      expect(cs.color).toBeTruthy();
      expect(cs.color.startsWith("#")).toBe(true);
    });
  });
});

// ── Trend Data Tests ───────────────────────────────────────────────

describe("computeTrendData", () => {
  it("should sort by date ascending", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const trend = computeTrendData(records);

    expect(trend[0].date).toBe("2026-08-10T10:00:00Z");
    expect(trend[2].date).toBe("2026-08-20T09:00:00Z");
  });

  it("should include all required fields", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const trend = computeTrendData(records);

    trend.forEach((t) => {
      expect(t.date).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(typeof t.rsvps).toBe("number");
      expect(typeof t.checkedIn).toBe("number");
      expect(typeof t.noShows).toBe("number");
      expect(typeof t.attendanceRate).toBe("number");
    });
  });
});

// ── Heatmap Data Tests ─────────────────────────────────────────────

describe("computeHeatmapData", () => {
  it("should return 168 cells (7 days × 24 hours)", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const heatmap = computeHeatmapData(records);
    expect(heatmap).toHaveLength(168);
  });

  it("should accumulate attendee counts in correct cells", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const heatmap = computeHeatmapData(records);

    // At least one cell should have count > 0
    const nonEmpty = heatmap.filter((c) => c.count > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);
  });
});

// ── Filter Tests ───────────────────────────────────────────────────

describe("filterByDateRange", () => {
  it("should return all records for 'all' range", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const filtered = filterByDateRange(records, "all");
    expect(filtered).toHaveLength(3);
  });

  it("should filter by date range", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const filtered = filterByDateRange(records, "7d");
    expect(filtered.length).toBeLessThanOrEqual(3);
  });
});

// ── Format Tests ───────────────────────────────────────────────────

describe("formatNumber", () => {
  it("should format thousands with K suffix", () => {
    expect(formatNumber(1500)).toBe("1.5K");
  });

  it("should format millions with M suffix", () => {
    expect(formatNumber(2500000)).toBe("2.5M");
  });

  it("should return raw number for values under 1000", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("should handle zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatPercent", () => {
  it("should format with one decimal", () => {
    expect(formatPercent(85.678)).toBe("85.7%");
  });

  it("should handle whole numbers", () => {
    expect(formatPercent(90)).toBe("90%");
  });
});

describe("formatDateShort", () => {
  it("should format ISO date to short form", () => {
    const result = formatDateShort("2026-08-20T09:00:00Z");
    expect(result).toMatch(/Aug/);
    expect(result).toContain("20");
  });
});

// ── Color Tests ────────────────────────────────────────────────────

describe("getCategoryColor", () => {
  it("should return known colors for known categories", () => {
    expect(getCategoryColor("tech")).toBe("#06b6d4");
    expect(getCategoryColor("concert")).toBe("#f43f5e");
  });

  it("should return default color for unknown categories", () => {
    expect(getCategoryColor("unknown")).toBe("#6b7280");
  });
});

// ── CSV Export Tests ───────────────────────────────────────────────

describe("exportToCsv", () => {
  it("should produce a CSV string with header and rows", () => {
    const records = transformEventsToRecords(MOCK_EVENTS);
    const csv = exportToCsv(records);

    const lines = csv.split("\n");
    expect(lines[0]).toContain("Event");
    expect(lines[0]).toContain("Attendance %");
    expect(lines.length).toBe(4); // header + 3 data rows
  });

  it("should properly escape fields with commas", () => {
    const events: RawEvent[] = [
      {
        id: "e-comma",
        title: "Event, with comma",
        club_name: "Club",
        category: "social",
        event_date: "2026-08-01T10:00:00Z",
        capacity: 100,
        rsvp_count: 50,
        checked_in_count: 40,
        rating: null,
      },
    ];
    const records = transformEventsToRecords(events);
    const csv = exportToCsv(records);

    expect(csv).toContain('"Event, with comma"');
  });
});
