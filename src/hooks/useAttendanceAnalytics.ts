import { useState, useMemo, useCallback } from "react";

/* ─────────────────────── TYPES ─────────────────────── */

export type AttendanceStatus = "checked_in" | "rsvped" | "no_show" | "cancelled";
export type ZoneName =
  | "main_stage"
  | "workshop_a"
  | "workshop_b"
  | "food_court"
  | "networking_lounge"
  | "exhibition_hall";

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  eventId: string;
  eventName: string;
  eventDate: string;
  rsvpDate: string;
  status: AttendanceStatus;
  checkedInAt?: string;
  checkedOutAt?: string;
  zoneCheckIns: ZoneCheckIn[];
  isEarlyBird: boolean;
  referralSource: "organic" | "social" | "email" | "club_feed" | "search";
}

export interface ZoneCheckIn {
  zone: ZoneName;
  enteredAt: string;
  exitedAt?: string;
  durationMinutes: number;
}

export interface EventAttendanceSummary {
  eventId: string;
  eventName: string;
  eventDate: string;
  clubName: string;
  category: string;
  totalCapacity: number;
  totalRsvps: number;
  totalCheckedIn: number;
  totalNoShows: number;
  totalCancelled: number;
  checkInRate: number;
  noShowRate: number;
  averageStayMinutes: number;
  peakHour: number;
  earlyBirdCount: number;
  referralBreakdown: Record<string, number>;
}

export interface AttendanceTrend {
  date: string;
  rsvps: number;
  checkIns: number;
  noShows: number;
  checkInRate: number;
}

export interface ZoneAnalytics {
  zone: ZoneName;
  totalVisits: number;
  averageDurationMinutes: number;
  uniqueVisitors: number;
  popularityIndex: number;
  hourlyTraffic: number[];
}

export interface AttendanceInsight {
  type: "positive" | "warning" | "info" | "neutral";
  title: string;
  description: string;
  metric?: string;
  icon: string;
}

export type TimeRange = "7d" | "30d" | "90d" | "all";

export interface AttendanceFilterState {
  timeRange: TimeRange;
  selectedEventId: string | null;
  selectedClubId: string | null;
  category: string | null;
}

/* ─────────────────────── CONSTANTS ─────────────────────── */

export const ZONE_NAMES: Record<ZoneName, { label: string; icon: string; color: string }> = {
  main_stage: { label: "Main Stage", icon: "🎤", color: "#a855f7" },
  workshop_a: { label: "Workshop A", icon: "💻", color: "#3b82f6" },
  workshop_b: { label: "Workshop B", icon: "🔬", color: "#06b6d4" },
  food_court: { label: "Food Court", icon: "🍕", color: "#f59e0b" },
  networking_lounge: { label: "Networking Lounge", icon: "🤝", color: "#22c55e" },
  exhibition_hall: { label: "Exhibition Hall", icon: "🖼️", color: "#ef4444" },
};

export const REFERRAL_SOURCES: Record<string, { label: string; icon: string }> = {
  organic: { label: "Direct / Organic", icon: "🔗" },
  social: { label: "Social Media", icon: "📱" },
  email: { label: "Email Campaign", icon: "📧" },
  club_feed: { label: "Club Feed", icon: "📰" },
  search: { label: "Search / Explore", icon: "🔍" },
};

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

/* ─────────────────────── MOCK DATA ─────────────────────── */

const MOCK_EVENTS: EventAttendanceSummary[] = [
  {
    eventId: "evt-1",
    eventName: "Annual Tech Summit 2026",
    eventDate: "2026-08-15",
    clubName: "CS Department",
    category: "Technology",
    totalCapacity: 300,
    totalRsvps: 285,
    totalCheckedIn: 247,
    totalNoShows: 32,
    totalCancelled: 6,
    checkInRate: 86.7,
    noShowRate: 11.2,
    averageStayMinutes: 185,
    peakHour: 14,
    earlyBirdCount: 89,
    referralBreakdown: { organic: 45, social: 98, email: 67, club_feed: 52, search: 23 },
  },
  {
    eventId: "evt-2",
    eventName: "Cultural Night Fiesta",
    eventDate: "2026-08-20",
    clubName: "Cultural Committee",
    category: "Cultural",
    totalCapacity: 500,
    totalRsvps: 472,
    totalCheckedIn: 438,
    totalNoShows: 28,
    totalCancelled: 6,
    checkInRate: 92.8,
    noShowRate: 5.9,
    averageStayMinutes: 210,
    peakHour: 19,
    earlyBirdCount: 134,
    referralBreakdown: { organic: 78, social: 156, email: 112, club_feed: 89, search: 37 },
  },
  {
    eventId: "evt-3",
    eventName: "Career Fair & Job Expo",
    eventDate: "2026-08-22",
    clubName: "Placement Cell",
    category: "Career",
    totalCapacity: 600,
    totalRsvps: 580,
    totalCheckedIn: 512,
    totalNoShows: 58,
    totalCancelled: 10,
    checkInRate: 88.3,
    noShowRate: 10.0,
    averageStayMinutes: 156,
    peakHour: 11,
    earlyBirdCount: 201,
    referralBreakdown: { organic: 112, social: 178, email: 145, club_feed: 98, search: 47 },
  },
  {
    eventId: "evt-4",
    eventName: "Freshman Welcome Week",
    eventDate: "2026-08-10",
    clubName: "Student Council",
    category: "Social",
    totalCapacity: 400,
    totalRsvps: 389,
    totalCheckedIn: 356,
    totalNoShows: 28,
    totalCancelled: 5,
    checkInRate: 91.5,
    noShowRate: 7.2,
    averageStayMinutes: 132,
    peakHour: 10,
    earlyBirdCount: 167,
    referralBreakdown: { organic: 56, social: 123, email: 89, club_feed: 98, search: 23 },
  },
  {
    eventId: "evt-5",
    eventName: "HackFusion 2026",
    eventDate: "2026-08-25",
    clubName: "Coding Club",
    category: "Technology",
    totalCapacity: 200,
    totalRsvps: 198,
    totalCheckedIn: 182,
    totalNoShows: 14,
    totalCancelled: 2,
    checkInRate: 91.9,
    noShowRate: 7.1,
    averageStayMinutes: 342,
    peakHour: 22,
    earlyBirdCount: 78,
    referralBreakdown: { organic: 34, social: 67, email: 45, club_feed: 38, search: 14 },
  },
  {
    eventId: "evt-6",
    eventName: "Research Symposium",
    eventDate: "2026-08-18",
    clubName: "Research Society",
    category: "Academic",
    totalCapacity: 150,
    totalRsvps: 142,
    totalCheckedIn: 118,
    totalNoShows: 20,
    totalCancelled: 4,
    checkInRate: 83.1,
    noShowRate: 14.1,
    averageStayMinutes: 168,
    peakHour: 15,
    earlyBirdCount: 45,
    referralBreakdown: { organic: 23, social: 34, email: 56, club_feed: 19, search: 10 },
  },
  {
    eventId: "evt-7",
    eventName: "Music Fest Groove",
    eventDate: "2026-08-23",
    clubName: "Music Club",
    category: "Cultural",
    totalCapacity: 350,
    totalRsvps: 340,
    totalCheckedIn: 312,
    totalNoShows: 22,
    totalCancelled: 6,
    checkInRate: 91.8,
    noShowRate: 6.5,
    averageStayMinutes: 198,
    peakHour: 20,
    earlyBirdCount: 112,
    referralBreakdown: { organic: 67, social: 134, email: 78, club_feed: 45, search: 16 },
  },
  {
    eventId: "evt-8",
    eventName: "Startup Pitch Night",
    eventDate: "2026-08-12",
    clubName: "Entrepreneurship Cell",
    category: "Career",
    totalCapacity: 180,
    totalRsvps: 175,
    totalCheckedIn: 156,
    totalNoShows: 16,
    totalCancelled: 3,
    checkInRate: 89.1,
    noShowRate: 9.1,
    averageStayMinutes: 142,
    peakHour: 18,
    earlyBirdCount: 56,
    referralBreakdown: { organic: 34, social: 56, email: 42, club_feed: 28, search: 15 },
  },
];

function generateMockTrends(): AttendanceTrend[] {
  const trends: AttendanceTrend[] = [];
  const now = new Date("2026-08-30");

  for (let i = 89; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const baseRsvps = isWeekend ? 65 : 42;
    const rsvps = baseRsvps + Math.floor(Math.random() * 30) - 10;
    const checkInRate = 0.82 + Math.random() * 0.14;
    const checkIns = Math.floor(rsvps * checkInRate);
    const noShows = rsvps - checkIns;

    trends.push({
      date: date.toISOString().split("T")[0],
      rsvps,
      checkIns,
      noShows,
      checkInRate: Math.round(checkInRate * 1000) / 10,
    });
  }
  return trends;
}

function generateMockZoneAnalytics(): ZoneAnalytics[] {
  return [
    {
      zone: "main_stage",
      totalVisits: 1245,
      averageDurationMinutes: 72,
      uniqueVisitors: 890,
      popularityIndex: 98,
      hourlyTraffic: [
        12, 8, 5, 3, 2, 2, 4, 18, 45, 78, 95, 110, 105, 112, 98, 82, 65, 58, 72, 85, 68, 42, 28, 15,
      ],
    },
    {
      zone: "workshop_a",
      totalVisits: 780,
      averageDurationMinutes: 95,
      uniqueVisitors: 520,
      popularityIndex: 72,
      hourlyTraffic: [
        2, 1, 0, 0, 0, 0, 1, 5, 32, 58, 72, 85, 78, 72, 65, 58, 42, 35, 28, 22, 15, 8, 4, 2,
      ],
    },
    {
      zone: "workshop_b",
      totalVisits: 650,
      averageDurationMinutes: 88,
      uniqueVisitors: 445,
      popularityIndex: 60,
      hourlyTraffic: [
        1, 0, 0, 0, 0, 0, 0, 3, 28, 52, 65, 72, 68, 62, 55, 48, 38, 32, 25, 18, 12, 5, 3, 1,
      ],
    },
    {
      zone: "food_court",
      totalVisits: 1420,
      averageDurationMinutes: 35,
      uniqueVisitors: 1100,
      popularityIndex: 100,
      hourlyTraffic: [
        5, 3, 2, 1, 1, 1, 3, 8, 25, 42, 85, 125, 132, 98, 65, 48, 42, 55, 82, 95, 62, 35, 18, 8,
      ],
    },
    {
      zone: "networking_lounge",
      totalVisits: 890,
      averageDurationMinutes: 28,
      uniqueVisitors: 720,
      popularityIndex: 82,
      hourlyTraffic: [
        0, 0, 0, 0, 0, 0, 1, 4, 15, 32, 45, 52, 48, 42, 38, 35, 32, 38, 55, 68, 52, 28, 12, 4,
      ],
    },
    {
      zone: "exhibition_hall",
      totalVisits: 560,
      averageDurationMinutes: 42,
      uniqueVisitors: 410,
      popularityIndex: 48,
      hourlyTraffic: [
        0, 0, 0, 0, 0, 0, 0, 2, 12, 28, 42, 55, 52, 48, 42, 38, 28, 22, 18, 15, 8, 4, 2, 0,
      ],
    },
  ];
}

function generateMockHourlyDistribution(): number[] {
  return [
    8, 5, 3, 2, 1, 1, 2, 12, 48, 82, 110, 135, 128, 120, 105, 88, 72, 65, 82, 98, 78, 52, 32, 15,
  ];
}

function generateMockAttendanceRecords(): AttendanceRecord[] {
  const statuses: AttendanceStatus[] = ["checked_in", "rsvped", "no_show", "cancelled"];
  const names = [
    "Alex K.",
    "Priya S.",
    "Marcus L.",
    "Chen W.",
    "Aisha R.",
    "Tom B.",
    "Nina P.",
    "Jordan M.",
    "Fatima H.",
    "Ravi G.",
    "Sofia V.",
    "Liam O.",
    "Emma T.",
    "Noah D.",
    "Olivia R.",
  ];
  const referrals: AttendanceRecord["referralSource"][] = [
    "organic",
    "social",
    "email",
    "club_feed",
    "search",
  ];
  const zones: ZoneName[] = [
    "main_stage",
    "workshop_a",
    "workshop_b",
    "food_court",
    "networking_lounge",
    "exhibition_hall",
  ];
  const records: AttendanceRecord[] = [];

  for (let i = 0; i < 80; i++) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const name = names[i % names.length];
    const eventIdx = i % MOCK_EVENTS.length;
    const event = MOCK_EVENTS[eventIdx];

    const zoneCheckIns: ZoneCheckIn[] = [];
    if (status === "checked_in") {
      const numZones = Math.floor(Math.random() * 4) + 1;
      for (let z = 0; z < numZones; z++) {
        const zone = zones[Math.floor(Math.random() * zones.length)];
        const duration = Math.floor(Math.random() * 90) + 10;
        zoneCheckIns.push({
          zone,
          enteredAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          exitedAt:
            Math.random() > 0.3
              ? new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
          durationMinutes: duration,
        });
      }
    }

    records.push({
      id: `rec-${i}-${Date.now()}`,
      userId: `user-${i}`,
      userName: name,
      eventId: event.eventId,
      eventName: event.eventName,
      eventDate: event.eventDate,
      rsvpDate: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
      status,
      checkedInAt:
        status === "checked_in"
          ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      checkedOutAt:
        status === "checked_in" && Math.random() > 0.4
          ? new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000).toISOString()
          : undefined,
      zoneCheckIns,
      isEarlyBird: Math.random() > 0.65,
      referralSource: referrals[Math.floor(Math.random() * referrals.length)],
    });
  }
  return records;
}

/* ─────────────────────── COMPUTATION HELPERS ─────────────────────── */

function computeAggregateStats(events: EventAttendanceSummary[]) {
  if (events.length === 0) {
    return {
      totalRsvps: 0,
      totalCheckedIn: 0,
      totalNoShows: 0,
      totalCancelled: 0,
      averageCheckInRate: 0,
      averageNoShowRate: 0,
      averageStayMinutes: 0,
      totalCapacity: 0,
      utilizationRate: 0,
      totalEarlyBirds: 0,
      earlyBirdRate: 0,
      bestPerformingEvent: null as EventAttendanceSummary | null,
      worstPerformingEvent: null as EventAttendanceSummary | null,
    };
  }

  const totalRsvps = events.reduce((sum, e) => sum + e.totalRsvps, 0);
  const totalCheckedIn = events.reduce((sum, e) => sum + e.totalCheckedIn, 0);
  const totalNoShows = events.reduce((sum, e) => sum + e.totalNoShows, 0);
  const totalCancelled = events.reduce((sum, e) => sum + e.totalCancelled, 0);
  const totalCapacity = events.reduce((sum, e) => sum + e.totalCapacity, 0);
  const totalEarlyBirds = events.reduce((sum, e) => sum + e.earlyBirdCount, 0);
  const avgStay = events.reduce((sum, e) => sum + e.averageStayMinutes, 0) / events.length;

  const sorted = [...events].sort((a, b) => b.checkInRate - a.checkInRate);

  return {
    totalRsvps,
    totalCheckedIn,
    totalNoShows,
    totalCancelled,
    averageCheckInRate: Math.round((totalCheckedIn / totalRsvps) * 1000) / 10,
    averageNoShowRate: Math.round((totalNoShows / totalRsvps) * 1000) / 10,
    averageStayMinutes: Math.round(avgStay),
    totalCapacity,
    utilizationRate: Math.round((totalRsvps / totalCapacity) * 1000) / 10,
    totalEarlyBirds,
    earlyBirdRate: Math.round((totalEarlyBirds / totalRsvps) * 1000) / 10,
    bestPerformingEvent: sorted[0],
    worstPerformingEvent: sorted[sorted.length - 1],
  };
}

function generateInsights(
  events: EventAttendanceSummary[],
  aggregate: ReturnType<typeof computeAggregateStats>,
): AttendanceInsight[] {
  const insights: AttendanceInsight[] = [];

  if (aggregate.averageCheckInRate >= 90) {
    insights.push({
      type: "positive",
      title: "Excellent Check-in Rate",
      description: `Your average check-in rate of ${aggregate.averageCheckInRate}% is outstanding. Keep up the great engagement!`,
      metric: `${aggregate.averageCheckInRate}%`,
      icon: "🏆",
    });
  } else if (aggregate.averageCheckInRate < 85) {
    insights.push({
      type: "warning",
      title: "Check-in Rate Below Target",
      description: `Your average check-in rate is ${aggregate.averageCheckInRate}%. Consider sending reminder notifications 24h before events.`,
      metric: `${aggregate.averageCheckInRate}%`,
      icon: "⚠️",
    });
  }

  if (aggregate.averageNoShowRate > 10) {
    insights.push({
      type: "warning",
      title: "High No-Show Rate Detected",
      description: `${aggregate.averageNoShowRate}% of RSVPs don't attend. Consider waitlist management or confirmation prompts.`,
      metric: `${aggregate.averageNoShowRate}%`,
      icon: "📉",
    });
  }

  if (aggregate.earlyBirdRate > 30) {
    insights.push({
      type: "positive",
      title: "Strong Early Bird Engagement",
      description: `${aggregate.earlyBirdRate}% of attendees register early. Your early-bird campaigns are working well!`,
      metric: `${aggregate.earlyBirdRate}%`,
      icon: "🐦",
    });
  }

  if (aggregate.bestPerformingEvent) {
    const best = aggregate.bestPerformingEvent;
    insights.push({
      type: "info",
      title: "Best Performing Event",
      description: `"${best.eventName}" achieved a ${best.checkInRate}% check-in rate with ${best.totalRsvps} RSVPs.`,
      metric: `${best.checkInRate}%`,
      icon: "🌟",
    });
  }

  const weekendEvents = events.filter((e) => {
    const d = new Date(e.eventDate);
    return d.getDay() === 0 || d.getDay() === 6;
  });
  const weekdayEvents = events.filter((e) => {
    const d = new Date(e.eventDate);
    return d.getDay() !== 0 && d.getDay() !== 6;
  });

  if (weekendEvents.length > 0 && weekdayEvents.length > 0) {
    const weekendRate = weekendEvents.reduce((s, e) => s + e.checkInRate, 0) / weekendEvents.length;
    const weekdayRate = weekdayEvents.reduce((s, e) => s + e.checkInRate, 0) / weekdayEvents.length;
    if (Math.abs(weekendRate - weekdayRate) > 5) {
      const better = weekendRate > weekdayRate ? "weekend" : "weekday";
      insights.push({
        type: "info",
        title: `${better.charAt(0).toUpperCase() + better.slice(1)} Events Perform Better`,
        description: `${better.charAt(0).toUpperCase() + better.slice(1)} events have a ${Math.round(Math.abs(weekendRate - weekdayRate) * 10) / 10}% higher check-in rate. Consider scheduling key events on ${better}s.`,
        icon: "📅",
      });
    }
  }

  const totalReferrals = Object.values(
    events.reduce(
      (acc, e) => {
        Object.entries(e.referralBreakdown).forEach(([key, val]) => {
          acc[key] = (acc[key] || 0) + val;
        });
        return acc;
      },
      {} as Record<string, number>,
    ),
  );
  if (totalReferrals.length > 0) {
    insights.push({
      type: "neutral",
      title: "Referral Source Insight",
      description:
        "Social media and email campaigns drive the most RSVPs. Club feed posts have high conversion but lower volume.",
      icon: "📊",
    });
  }

  if (aggregate.averageStayMinutes > 180) {
    insights.push({
      type: "positive",
      title: "High Engagement Duration",
      description: `Average stay of ${aggregate.averageStayMinutes} minutes indicates strong event quality and engagement.`,
      metric: `${aggregate.averageStayMinutes} min`,
      icon: "⏱️",
    });
  } else if (aggregate.averageStayMinutes < 120) {
    insights.push({
      type: "warning",
      title: "Short Engagement Duration",
      description: `Average stay is only ${aggregate.averageStayMinutes} minutes. Consider adding interactive elements to keep attendees engaged.`,
      metric: `${aggregate.averageStayMinutes} min`,
      icon: "⏱️",
    });
  }

  return insights;
}

/* ─────────────────────── HOOK ─────────────────────── */

export function useAttendanceAnalytics() {
  const [filter, setFilter] = useState<AttendanceFilterState>({
    timeRange: "30d",
    selectedEventId: null,
    selectedClubId: null,
    category: null,
  });

  const [records] = useState<AttendanceRecord[]>(() => generateMockAttendanceRecords());
  const trends = useMemo(() => generateMockTrends(), []);
  const zoneAnalytics = useMemo(() => generateMockZoneAnalytics(), []);
  const hourlyDistribution = useMemo(() => generateMockHourlyDistribution(), []);

  const filteredEvents = useMemo(() => {
    let events = [...MOCK_EVENTS];

    if (filter.selectedEventId) {
      events = events.filter((e) => e.eventId === filter.selectedEventId);
    }

    if (filter.category) {
      events = events.filter((e) => e.category === filter.category);
    }

    if (filter.timeRange !== "all") {
      const daysMap: Record<TimeRange, number> = { "7d": 7, "30d": 30, "90d": 90, all: 999 };
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - daysMap[filter.timeRange]);
      events = events.filter((e) => new Date(e.eventDate) >= cutoff);
    }

    return events;
  }, [filter]);

  const aggregate = useMemo(() => computeAggregateStats(filteredEvents), [filteredEvents]);
  const insights = useMemo(
    () => generateInsights(filteredEvents, aggregate),
    [filteredEvents, aggregate],
  );

  const categories = useMemo(() => {
    const cats = new Set(MOCK_EVENTS.map((e) => e.category));
    return ["All", ...Array.from(cats).sort()];
  }, []);

  const filteredRecords = useMemo(() => {
    let result = [...records];
    if (filter.selectedEventId) {
      result = result.filter((r) => r.eventId === filter.selectedEventId);
    }
    return result;
  }, [records, filter.selectedEventId]);

  const statusBreakdown = useMemo(() => {
    const counts = { checked_in: 0, rsvped: 0, no_show: 0, cancelled: 0 };
    filteredRecords.forEach((r) => {
      counts[r.status]++;
    });
    return counts;
  }, [filteredRecords]);

  const referralStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRecords.forEach((r) => {
      counts[r.referralSource] = (counts[r.referralSource] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([source, count]) => ({
        source,
        count,
        percentage: Math.round((count / Math.max(filteredRecords.length, 1)) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const updateTimeRange = useCallback((timeRange: TimeRange) => {
    setFilter((prev) => ({ ...prev, timeRange }));
  }, []);

  const updateCategory = useCallback((category: string | null) => {
    setFilter((prev) => ({ ...prev, category: category === "All" ? null : category }));
  }, []);

  const updateSelectedEvent = useCallback((eventId: string | null) => {
    setFilter((prev) => ({ ...prev, selectedEventId: eventId }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilter({ timeRange: "30d", selectedEventId: null, selectedClubId: null, category: null });
  }, []);

  const exportCsv = useCallback(() => {
    const headers = [
      "Event",
      "Date",
      "Club",
      "Category",
      "Capacity",
      "RSVPs",
      "Checked In",
      "No Shows",
      "Cancelled",
      "Check-in Rate",
      "No-Show Rate",
      "Avg Stay (min)",
    ];
    const rows = filteredEvents.map((e) => [
      e.eventName,
      e.eventDate,
      e.clubName,
      e.category,
      String(e.totalCapacity),
      String(e.totalRsvps),
      String(e.totalCheckedIn),
      String(e.totalNoShows),
      String(e.totalCancelled),
      `${e.checkInRate}%`,
      `${e.noShowRate}%`,
      String(e.averageStayMinutes),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-analytics-${filter.timeRange}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredEvents, filter.timeRange]);

  return {
    filter,
    filteredEvents,
    aggregate,
    insights,
    trends,
    zoneAnalytics,
    hourlyDistribution,
    categories,
    filteredRecords,
    statusBreakdown,
    referralStats,
    updateTimeRange,
    updateCategory,
    updateSelectedEvent,
    resetFilters,
    exportCsv,
    MOCK_EVENTS,
    ZONE_NAMES,
    REFERRAL_SOURCES,
    TIME_RANGE_OPTIONS,
  };
}
