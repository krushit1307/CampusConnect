/**
 * Attendance Analytics — Utility Functions
 *
 * Pure helpers for computing attendance statistics, formatting numbers,
 * and transforming raw event/RSVP data into dashboard-ready structures.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface RawEvent {
  id: string;
  title: string;
  club_name: string;
  category: string;
  event_date: string;
  capacity: number;
  rsvp_count: number;
  checked_in_count: number;
  rating: number | null;
}

export interface AttendanceRecord {
  eventId: string;
  title: string;
  clubName: string;
  category: string;
  eventDate: string;
  capacity: number;
  rsvps: number;
  checkedIn: number;
  noShowCount: number;
  attendanceRate: number;
  rating: number | null;
}

export interface CategoryStats {
  category: string;
  totalEvents: number;
  totalAttendees: number;
  avgAttendanceRate: number;
  avgRating: number | null;
  color: string;
}

export interface TrendPoint {
  date: string;
  label: string;
  rsvps: number;
  checkedIn: number;
  noShows: number;
  attendanceRate: number;
}

export interface HeatmapCell {
  hour: number;
  dayOfWeek: number;
  count: number;
  label: string;
}

export interface DashboardStats {
  totalEvents: number;
  totalRSVPs: number;
  totalCheckIns: number;
  avgAttendanceRate: number;
  avgRating: number | null;
  peakAttendanceDate: string;
  mostActiveClub: string;
  totalCapacity: number;
  noShowTotal: number;
  conversionRate: number;
}

export interface FilterOptions {
  dateRange: "7d" | "30d" | "90d" | "1y" | "all";
  category: string | "all";
  club: string | "all";
}

// ── Category Colors ────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  academic: "#3b82f6",
  cultural: "#a855f7",
  sports: "#10b981",
  tech: "#06b6d4",
  social: "#f59e0b",
  workshop: "#ec4899",
  seminar: "#6366f1",
  concert: "#f43f5e",
  exhibition: "#14b8a6",
  networking: "#f97316",
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] || "#6b7280";
}

// ── Data Transformation ────────────────────────────────────────────

export function transformEventsToRecords(events: RawEvent[]): AttendanceRecord[] {
  return events.map((e) => {
    const rsvps = e.rsvp_count;
    const checkedIn = e.checked_in_count;
    const noShowCount = rsvps - checkedIn;
    const attendanceRate = rsvps > 0 ? (checkedIn / rsvps) * 100 : 0;

    return {
      eventId: e.id,
      title: e.title,
      clubName: e.club_name,
      category: e.category,
      eventDate: e.event_date,
      capacity: e.capacity,
      rsvps,
      checkedIn,
      noShowCount,
      attendanceRate,
      rating: e.rating,
    };
  });
}

// ── Dashboard Aggregate Stats ──────────────────────────────────────

export function computeDashboardStats(records: AttendanceRecord[]): DashboardStats {
  if (records.length === 0) {
    return {
      totalEvents: 0,
      totalRSVPs: 0,
      totalCheckIns: 0,
      avgAttendanceRate: 0,
      avgRating: null,
      peakAttendanceDate: "N/A",
      mostActiveClub: "N/A",
      totalCapacity: 0,
      noShowTotal: 0,
      conversionRate: 0,
    };
  }

  const totalEvents = records.length;
  const totalRSVPs = records.reduce((sum, r) => sum + r.rsvps, 0);
  const totalCheckIns = records.reduce((sum, r) => sum + r.checkedIn, 0);
  const totalCapacity = records.reduce((sum, r) => sum + r.capacity, 0);
  const noShowTotal = records.reduce((sum, r) => sum + r.noShowCount, 0);

  const avgAttendanceRate = records.reduce((sum, r) => sum + r.attendanceRate, 0) / totalEvents;

  const ratedRecords = records.filter((r) => r.rating !== null);
  const avgRating =
    ratedRecords.length > 0
      ? ratedRecords.reduce((sum, r) => sum + (r.rating ?? 0), 0) / ratedRecords.length
      : null;

  const peakRecord = [...records].sort((a, b) => b.checkedIn - a.checkedIn)[0];

  const clubCounts: Record<string, number> = {};
  records.forEach((r) => {
    clubCounts[r.clubName] = (clubCounts[r.clubName] || 0) + r.rsvps;
  });
  const mostActiveClub = Object.entries(clubCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

  const conversionRate = totalRSVPs > 0 ? (totalCheckIns / totalRSVPs) * 100 : 0;

  return {
    totalEvents,
    totalRSVPs,
    totalCheckIns,
    avgAttendanceRate,
    avgRating,
    peakAttendanceDate: peakRecord?.eventDate ?? "N/A",
    mostActiveClub,
    totalCapacity,
    noShowTotal,
    conversionRate,
  };
}

// ── Category Breakdown ─────────────────────────────────────────────

export function computeCategoryStats(records: AttendanceRecord[]): CategoryStats[] {
  const grouped: Record<string, AttendanceRecord[]> = {};
  records.forEach((r) => {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  });

  return Object.entries(grouped)
    .map(([category, events]) => {
      const totalEvents = events.length;
      const totalAttendees = events.reduce((s, e) => s + e.checkedIn, 0);
      const avgAttendanceRate = events.reduce((s, e) => s + e.attendanceRate, 0) / totalEvents;
      const ratedEvents = events.filter((e) => e.rating !== null);
      const avgRating =
        ratedEvents.length > 0
          ? ratedEvents.reduce((s, e) => s + (e.rating ?? 0), 0) / ratedEvents.length
          : null;

      return {
        category,
        totalEvents,
        totalAttendees,
        avgAttendanceRate,
        avgRating,
        color: getCategoryColor(category),
      };
    })
    .sort((a, b) => b.totalAttendees - a.totalAttendees);
}

// ── Trend Data ─────────────────────────────────────────────────────

export function computeTrendData(records: AttendanceRecord[]): TrendPoint[] {
  const sorted = [...records].sort(
    (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
  );

  return sorted.map((r) => ({
    date: r.eventDate,
    label: formatDateShort(r.eventDate),
    rsvps: r.rsvps,
    checkedIn: r.checkedIn,
    noShows: r.noShowCount,
    attendanceRate: Math.round(r.attendanceRate * 10) / 10,
  }));
}

// ── Heatmap Data ───────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeHeatmapData(records: AttendanceRecord[]): HeatmapCell[] {
  const cells: HeatmapCell[] = [];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ hour, dayOfWeek: day, count: 0, label: "" });
    }
  }

  records.forEach((r) => {
    const d = new Date(r.eventDate);
    const day = d.getDay();
    const hour = d.getHours();
    const idx = day * 24 + hour;
    cells[idx].count += r.checkedIn;
  });

  cells.forEach((c) => {
    c.label = `${DAY_NAMES[c.dayOfWeek]} ${c.hour}:00 — ${c.count} attendees`;
  });

  return cells;
}

// ── Filter Records by Date Range ───────────────────────────────────

export function filterByDateRange(
  records: AttendanceRecord[],
  range: FilterOptions["dateRange"],
): AttendanceRecord[] {
  if (range === "all") return records;

  const now = new Date();
  const ms: Record<string, number> = {
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
    "1y": 365 * 24 * 60 * 60 * 1000,
  };

  const cutoff = now.getTime() - (ms[range] ?? 0);
  return records.filter((r) => new Date(r.eventDate).getTime() >= cutoff);
}

// ── Formatting Helpers ─────────────────────────────────────────────

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatPercent(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Export to CSV ──────────────────────────────────────────────────

export function exportToCsv(records: AttendanceRecord[]): string {
  const header =
    "Event,Club,Category,Date,Capacity,RSVPs,Checked In,No-Shows,Attendance %,Rating\n";
  const rows = records
    .map(
      (r) =>
        `"${r.title}","${r.clubName}","${r.category}","${r.eventDate}",${r.capacity},${r.rsvps},${r.checkedIn},${r.noShowCount},${Math.round(r.attendanceRate * 10) / 10},${r.rating ?? "N/A"}`,
    )
    .join("\n");
  return header + rows;
}

export function downloadCsv(records: AttendanceRecord[]): void {
  const csv = exportToCsv(records);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
