import { useState, useMemo, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────

export type VenueType =
  | "auditorium"
  | "lecture_hall"
  | "conference_room"
  | "outdoor_ground"
  | "lab"
  | "sports_facility"
  | "student_center"
  | "cafeteria";

export type VenueStatus = "available" | "booked" | "maintenance" | "reserved";

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface Venue {
  id: string;
  name: string;
  building: string;
  type: VenueType;
  capacity: number;
  status: VenueStatus;
  amenities: string[];
  hourlyRate: number;
  rating: number;
  totalBookings: number;
  totalHours: number;
  imageUrl: string;
}

export interface VenueBooking {
  id: string;
  venueId: string;
  eventName: string;
  clubName: string;
  date: string;
  startTime: string;
  endTime: string;
  attendeeCount: number;
  status: "confirmed" | "pending" | "cancelled";
}

export interface VenueUtilization {
  venueId: string;
  venueName: string;
  type: VenueType;
  capacity: number;
  avgUtilization: number;
  peakHour: string;
  peakDay: string;
  totalBookings: number;
  avgAttendees: number;
  revenue: number;
  satisfaction: number;
  trend: "up" | "down" | "stable";
  weeklyData: number[];
  monthlyData: { month: string; hours: number; revenue: number }[];
}

export interface VenueConflict {
  id: string;
  venueId: string;
  venueName: string;
  event1: string;
  event2: string;
  date: string;
  overlapStart: string;
  overlapEnd: string;
  severity: "high" | "medium" | "low";
  suggestedResolution: string;
}

export interface VenueRecommendation {
  venueId: string;
  venueName: string;
  matchScore: number;
  reasons: string[];
  estimatedCost: number;
  estimatedCapacity: number;
}

export interface VenueAnalyticsSummary {
  totalVenues: number;
  activeVenues: number;
  totalBookingsThisMonth: number;
  avgUtilizationRate: number;
  totalRevenue: number;
  avgSatisfaction: number;
  pendingConflicts: number;
  upcomingMaintenance: number;
  weeklyTrend: number;
  monthlyTrend: number;
  utilizationByType: { type: VenueType; avg: number; count: number }[];
  bookingsByDay: { day: DayOfWeek; count: number }[];
  hourlyHeatmap: { hour: number; day: DayOfWeek; value: number }[];
  topVenues: { name: string; utilization: number; revenue: number }[];
}

// ─── Mock Data ────────────────────────────────────────────────────────

const VENUE_TYPES: { type: VenueType; label: string; color: string }[] = [
  { type: "auditorium", label: "Auditorium", color: "#06b6d4" },
  { type: "lecture_hall", label: "Lecture Hall", color: "#a855f7" },
  { type: "conference_room", label: "Conference Room", color: "#10b981" },
  { type: "outdoor_ground", label: "Outdoor Ground", color: "#f59e0b" },
  { type: "lab", label: "Lab", color: "#ec4899" },
  { type: "sports_facility", label: "Sports Facility", color: "#ef4444" },
  { type: "student_center", label: "Student Center", color: "#6366f1" },
  { type: "cafeteria", label: "Cafeteria", color: "#14b8a6" },
];

const MOCK_VENUES: Venue[] = [
  {
    id: "V1",
    name: "Main Auditorium",
    building: "Admin Block",
    type: "auditorium",
    capacity: 800,
    status: "available",
    amenities: ["projector", "sound_system", "recording", "live_stream", "wheelchair_access"],
    hourlyRate: 0,
    rating: 4.7,
    totalBookings: 48,
    totalHours: 192,
    imageUrl: "",
  },
  {
    id: "V2",
    name: "Seminar Hall A",
    building: "Science Block",
    type: "lecture_hall",
    capacity: 200,
    status: "booked",
    amenities: ["projector", "sound_system", "whiteboard", "air_conditioning"],
    hourlyRate: 50,
    rating: 4.5,
    totalBookings: 62,
    totalHours: 186,
    imageUrl: "",
  },
  {
    id: "V3",
    name: "Conference Room 201",
    building: "CS Department",
    type: "conference_room",
    capacity: 30,
    status: "available",
    amenities: ["projector", "whiteboard", "video_conferencing"],
    hourlyRate: 25,
    rating: 4.3,
    totalBookings: 95,
    totalHours: 285,
    imageUrl: "",
  },
  {
    id: "V4",
    name: "Central Lawn",
    building: "Main Campus",
    type: "outdoor_ground",
    capacity: 500,
    status: "available",
    amenities: ["open_air", "power_outlets", "stage_platform"],
    hourlyRate: 0,
    rating: 4.6,
    totalBookings: 34,
    totalHours: 102,
    imageUrl: "",
  },
  {
    id: "V5",
    name: "Computer Lab A",
    building: "CS Department",
    type: "lab",
    capacity: 60,
    status: "maintenance",
    amenities: ["computers_60", "projector", "high_speed_internet"],
    hourlyRate: 0,
    rating: 4.8,
    totalBookings: 78,
    totalHours: 312,
    imageUrl: "",
  },
  {
    id: "V6",
    name: "Sports Complex",
    building: "Sports Block",
    type: "sports_facility",
    capacity: 2000,
    status: "available",
    amenities: ["cricket_ground", "basketball_court", "gym", "changing_rooms"],
    hourlyRate: 100,
    rating: 4.4,
    totalBookings: 28,
    totalHours: 168,
    imageUrl: "",
  },
  {
    id: "V7",
    name: "Student Center",
    building: "Main Campus",
    type: "student_center",
    capacity: 300,
    status: "reserved",
    amenities: ["café", "projector", "sound_system", "games_area"],
    hourlyRate: 0,
    rating: 4.2,
    totalBookings: 56,
    totalHours: 168,
    imageUrl: "",
  },
  {
    id: "V8",
    name: "Innovation Hub",
    building: "CS Department",
    type: "lab",
    capacity: 100,
    status: "available",
    amenities: ["3d_printers", "computers_40", "projector", "workshop_tools"],
    hourlyRate: 0,
    rating: 4.9,
    totalBookings: 42,
    totalHours: 210,
    imageUrl: "",
  },
  {
    id: "V9",
    name: "Open Air Theatre",
    building: "Student Center",
    type: "auditorium",
    capacity: 500,
    status: "available",
    amenities: ["open_air", "stage", "sound_system", "lighting"],
    hourlyRate: 0,
    rating: 4.6,
    totalBookings: 22,
    totalHours: 66,
    imageUrl: "",
  },
  {
    id: "V10",
    name: "Convention Center",
    building: "Main Campus",
    type: "auditorium",
    capacity: 1500,
    status: "available",
    amenities: ["projector", "sound_system", "recording", "live_stream", "vip_lounge", "catering"],
    hourlyRate: 200,
    rating: 4.8,
    totalBookings: 18,
    totalHours: 72,
    imageUrl: "",
  },
];

const MOCK_UTILIZATION: VenueUtilization[] = [
  {
    venueId: "V1",
    venueName: "Main Auditorium",
    type: "auditorium",
    capacity: 800,
    avgUtilization: 78,
    peakHour: "18:00",
    peakDay: "Fri",
    totalBookings: 48,
    avgAttendees: 624,
    revenue: 0,
    satisfaction: 4.7,
    trend: "up",
    weeklyData: [65, 72, 80, 85, 90, 95, 60],
    monthlyData: [
      { month: "May", hours: 40, revenue: 0 },
      { month: "Jun", hours: 36, revenue: 0 },
      { month: "Jul", hours: 20, revenue: 0 },
      { month: "Aug", hours: 48, revenue: 0 },
      { month: "Sep", hours: 52, revenue: 0 },
    ],
  },
  {
    venueId: "V2",
    venueName: "Seminar Hall A",
    type: "lecture_hall",
    capacity: 200,
    avgUtilization: 82,
    peakHour: "14:00",
    peakDay: "Wed",
    totalBookings: 62,
    avgAttendees: 164,
    revenue: 9300,
    satisfaction: 4.5,
    trend: "up",
    weeklyData: [70, 78, 88, 85, 90, 50, 30],
    monthlyData: [
      { month: "May", hours: 50, revenue: 2500 },
      { month: "Jun", hours: 45, revenue: 2250 },
      { month: "Jul", hours: 30, revenue: 1500 },
      { month: "Aug", hours: 55, revenue: 2750 },
      { month: "Sep", hours: 60, revenue: 3000 },
    ],
  },
  {
    venueId: "V3",
    venueName: "Conference Room 201",
    type: "conference_room",
    capacity: 30,
    avgUtilization: 65,
    peakHour: "10:00",
    peakDay: "Tue",
    totalBookings: 95,
    avgAttendees: 22,
    revenue: 7125,
    satisfaction: 4.3,
    trend: "stable",
    weeklyData: [60, 70, 65, 72, 58, 40, 20],
    monthlyData: [
      { month: "May", hours: 60, revenue: 1500 },
      { month: "Jun", hours: 55, revenue: 1375 },
      { month: "Jul", hours: 40, revenue: 1000 },
      { month: "Aug", hours: 70, revenue: 1750 },
      { month: "Sep", hours: 75, revenue: 1875 },
    ],
  },
  {
    venueId: "V4",
    venueName: "Central Lawn",
    type: "outdoor_ground",
    capacity: 500,
    avgUtilization: 55,
    peakHour: "17:00",
    peakDay: "Sat",
    totalBookings: 34,
    avgAttendees: 275,
    revenue: 0,
    satisfaction: 4.6,
    trend: "stable",
    weeklyData: [40, 45, 50, 55, 60, 85, 70],
    monthlyData: [
      { month: "May", hours: 30, revenue: 0 },
      { month: "Jun", hours: 25, revenue: 0 },
      { month: "Jul", hours: 15, revenue: 0 },
      { month: "Aug", hours: 35, revenue: 0 },
      { month: "Sep", hours: 40, revenue: 0 },
    ],
  },
  {
    venueId: "V5",
    venueName: "Computer Lab A",
    type: "lab",
    capacity: 60,
    avgUtilization: 92,
    peakHour: "11:00",
    peakDay: "Thu",
    totalBookings: 78,
    avgAttendees: 55,
    revenue: 0,
    satisfaction: 4.8,
    trend: "up",
    weeklyData: [85, 90, 95, 98, 92, 40, 25],
    monthlyData: [
      { month: "May", hours: 70, revenue: 0 },
      { month: "Jun", hours: 65, revenue: 0 },
      { month: "Jul", hours: 50, revenue: 0 },
      { month: "Aug", hours: 78, revenue: 0 },
      { month: "Sep", hours: 82, revenue: 0 },
    ],
  },
  {
    venueId: "V8",
    venueName: "Innovation Hub",
    type: "lab",
    capacity: 100,
    avgUtilization: 88,
    peakHour: "15:00",
    peakDay: "Fri",
    totalBookings: 42,
    avgAttendees: 88,
    revenue: 0,
    satisfaction: 4.9,
    trend: "up",
    weeklyData: [80, 85, 90, 88, 95, 70, 50],
    monthlyData: [
      { month: "May", hours: 40, revenue: 0 },
      { month: "Jun", hours: 42, revenue: 0 },
      { month: "Jul", hours: 30, revenue: 0 },
      { month: "Aug", hours: 50, revenue: 0 },
      { month: "Sep", hours: 55, revenue: 0 },
    ],
  },
];

const MOCK_CONFLICTS: VenueConflict[] = [
  {
    id: "C1",
    venueId: "V2",
    venueName: "Seminar Hall A",
    event1: "AI/ML Workshop",
    event2: "Guest Lecture: Quantum Computing",
    date: "2026-09-08",
    overlapStart: "14:00",
    overlapEnd: "15:00",
    severity: "high",
    suggestedResolution: "Move Quantum Lecture to Conference Room 201 or reschedule to Sep 9.",
  },
  {
    id: "C2",
    venueId: "V6",
    venueName: "Sports Complex",
    event1: "Cricket Tournament",
    event2: "Basketball Practice",
    date: "2026-09-10",
    overlapStart: "09:00",
    overlapEnd: "11:00",
    severity: "medium",
    suggestedResolution: "Reschedule basketball practice to evening slot (17:00–19:00).",
  },
  {
    id: "C3",
    venueId: "V10",
    venueName: "Convention Center",
    event1: "Career Fair",
    event2: "Annual Day Rehearsal",
    date: "2026-09-12",
    overlapStart: "09:00",
    overlapEnd: "10:00",
    severity: "high",
    suggestedResolution:
      "Use Main Auditorium for rehearsal or shift Career Fair start to 11:00 AM.",
  },
  {
    id: "C4",
    venueId: "V1",
    venueName: "Main Auditorium",
    event1: "Freshers Party Soundcheck",
    event2: "Guest Lecture: Ethics in AI (Replay)",
    date: "2026-09-02",
    overlapStart: "16:00",
    overlapEnd: "16:30",
    severity: "low",
    suggestedResolution: "Short overlap; coordinate soundcheck timing with AV team.",
  },
];

const MOCK_UPCOMING_BOOKINGS: VenueBooking[] = [
  {
    id: "B1",
    venueId: "V1",
    eventName: "Fresher's Welcome Party",
    clubName: "Student Council",
    date: "2026-09-02",
    startTime: "17:00",
    endTime: "22:00",
    attendeeCount: 645,
    status: "confirmed",
  },
  {
    id: "B2",
    venueId: "V7",
    eventName: "Club Fair Setup",
    clubName: "Student Government",
    date: "2026-09-02",
    startTime: "08:00",
    endTime: "12:00",
    attendeeCount: 0,
    status: "confirmed",
  },
  {
    id: "B3",
    venueId: "V2",
    eventName: "AI/ML Workshop",
    clubName: "AI/ML Club",
    date: "2026-09-01",
    startTime: "10:00",
    endTime: "16:00",
    attendeeCount: 58,
    status: "confirmed",
  },
  {
    id: "B4",
    venueId: "V8",
    eventName: "Hack Night — Build in 12 Hours",
    clubName: "Hack Club",
    date: "2026-09-07",
    startTime: "18:00",
    endTime: "06:00",
    attendeeCount: 62,
    status: "confirmed",
  },
  {
    id: "B5",
    venueId: "V3",
    eventName: "Startup Mentoring Session",
    clubName: "E-Cell",
    date: "2026-09-03",
    startTime: "14:00",
    endTime: "16:00",
    attendeeCount: 25,
    status: "pending",
  },
  {
    id: "B6",
    venueId: "V4",
    eventName: "Photography Walk",
    clubName: "Photography Club",
    date: "2026-09-04",
    startTime: "06:00",
    endTime: "08:00",
    attendeeCount: 30,
    status: "confirmed",
  },
  {
    id: "B7",
    venueId: "V9",
    eventName: "Classical Music Night",
    clubName: "Music Society",
    date: "2026-08-30",
    startTime: "18:00",
    endTime: "21:00",
    attendeeCount: 312,
    status: "confirmed",
  },
  {
    id: "B8",
    venueId: "V6",
    eventName: "Inter-College Cricket Tournament",
    clubName: "Sports Council",
    date: "2026-09-10",
    startTime: "07:00",
    endTime: "18:00",
    attendeeCount: 1200,
    status: "pending",
  },
];

// ─── Heatmap generation ───────────────────────────────────────────────

function generateHeatmapData(): { hour: number; day: DayOfWeek; value: number }[] {
  const days: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const data: { hour: number; day: DayOfWeek; value: number }[] = [];
  const baseValues: Record<DayOfWeek, number[]> = {
    Mon: [
      5, 2, 10, 30, 55, 70, 85, 90, 88, 80, 75, 82, 85, 78, 70, 60, 50, 40, 35, 25, 15, 8, 4, 3,
    ],
    Tue: [3, 1, 8, 25, 50, 65, 80, 92, 90, 85, 80, 78, 82, 75, 68, 55, 45, 35, 30, 20, 12, 6, 3, 2],
    Wed: [
      4, 2, 12, 35, 60, 75, 88, 95, 92, 88, 82, 80, 78, 72, 65, 58, 48, 38, 32, 22, 14, 7, 3, 2,
    ],
    Thu: [3, 1, 9, 28, 52, 68, 82, 90, 88, 82, 78, 76, 80, 74, 66, 56, 46, 36, 28, 18, 10, 5, 3, 2],
    Fri: [
      6, 3, 15, 40, 65, 80, 92, 98, 95, 90, 85, 82, 80, 75, 70, 62, 55, 48, 42, 35, 28, 18, 10, 6,
    ],
    Sat: [
      8, 5, 10, 20, 35, 50, 65, 78, 85, 90, 88, 82, 75, 68, 60, 55, 50, 45, 40, 35, 30, 22, 15, 10,
    ],
    Sun: [5, 3, 5, 10, 18, 30, 45, 55, 60, 65, 62, 58, 52, 45, 40, 35, 30, 25, 20, 15, 10, 8, 5, 4],
  };
  for (const day of days) {
    for (let hour = 0; hour < 24; hour++) {
      data.push({ hour, day, value: baseValues[day][hour] });
    }
  }
  return data;
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useVenueAnalytics() {
  const [selectedVenueType, setSelectedVenueType] = useState<VenueType | "all">("all");
  const [dateRange, setDateRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [conflictFilter, setConflictFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const venues = MOCK_VENUES;

  const filteredVenues = useMemo(() => {
    let result = [...venues];
    if (selectedVenueType !== "all") {
      result = result.filter((v) => v.type === selectedVenueType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.building.toLowerCase().includes(q) ||
          v.type.toLowerCase().includes(q),
      );
    }
    return result;
  }, [venues, selectedVenueType, searchQuery]);

  const utilization = MOCK_UTILIZATION;

  const filteredUtilization = useMemo(() => {
    if (selectedVenueType === "all") return utilization;
    return utilization.filter((u) => u.type === selectedVenueType);
  }, [utilization, selectedVenueType]);

  const conflicts = useMemo(() => {
    if (conflictFilter === "all") return MOCK_CONFLICTS;
    return MOCK_CONFLICTS.filter((c) => c.severity === conflictFilter);
  }, [conflictFilter]);

  const upcomingBookings = MOCK_UPCOMING_BOOKINGS;

  const heatmapData = useMemo(() => generateHeatmapData(), []);

  const summary = useMemo<VenueAnalyticsSummary>(() => {
    const active = venues.filter((v) => v.status !== "maintenance");
    const totalBookings = filteredUtilization.reduce((acc, u) => acc + u.totalBookings, 0);
    const avgUtil =
      filteredUtilization.length > 0
        ? Math.round(
            filteredUtilization.reduce((acc, u) => acc + u.avgUtilization, 0) /
              filteredUtilization.length,
          )
        : 0;
    const totalRev = filteredUtilization.reduce((acc, u) => acc + u.revenue, 0);
    const avgSat =
      filteredUtilization.length > 0
        ? +(
            filteredUtilization.reduce((acc, u) => acc + u.satisfaction, 0) /
            filteredUtilization.length
          ).toFixed(1)
        : 0;

    const typeMap = new Map<VenueType, { total: number; count: number }>();
    filteredUtilization.forEach((u) => {
      const existing = typeMap.get(u.type) || { total: 0, count: 0 };
      typeMap.set(u.type, { total: existing.total + u.avgUtilization, count: existing.count + 1 });
    });
    const utilizationByType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      avg: Math.round(data.total / data.count),
      count: data.count,
    }));

    const dayCounts: Record<DayOfWeek, number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };
    upcomingBookings.forEach((b) => {
      const dow = new Date(b.date).getDay();
      const dayNames: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      dayCounts[dayNames[dow]] += 1;
    });
    const bookingsByDay = (Object.entries(dayCounts) as [DayOfWeek, number][]).map(
      ([day, count]) => ({ day, count }),
    );

    const topVenues = filteredUtilization
      .slice()
      .sort((a, b) => b.avgUtilization - a.avgUtilization)
      .slice(0, 5)
      .map((u) => ({ name: u.venueName, utilization: u.avgUtilization, revenue: u.revenue }));

    return {
      totalVenues: venues.length,
      activeVenues: active.length,
      totalBookingsThisMonth: totalBookings,
      avgUtilizationRate: avgUtil,
      totalRevenue: totalRev,
      avgSatisfaction: avgSat,
      pendingConflicts: MOCK_CONFLICTS.length,
      upcomingMaintenance: venues.filter((v) => v.status === "maintenance").length,
      weeklyTrend: 12,
      monthlyTrend: 8,
      utilizationByType,
      bookingsByDay,
      hourlyHeatmap: heatmapData,
      topVenues,
    };
  }, [venues, filteredUtilization, upcomingBookings, heatmapData]);

  const recommendations = useMemo<VenueRecommendation[]>(() => {
    const recs: VenueRecommendation[] = [
      {
        venueId: "V8",
        venueName: "Innovation Hub",
        matchScore: 95,
        reasons: [
          "Highest satisfaction (4.9)",
          "Strong tech event track record",
          "Hackathon-ready facilities",
        ],
        estimatedCost: 0,
        estimatedCapacity: 100,
      },
      {
        venueId: "V5",
        venueName: "Computer Lab A",
        matchScore: 92,
        reasons: ["Highest utilization (92%)", "Workshop favorite", "All computers available"],
        estimatedCost: 0,
        estimatedCapacity: 60,
      },
      {
        venueId: "V2",
        venueName: "Seminar Hall A",
        matchScore: 88,
        reasons: ["Popular for lectures", "Good mid-size capacity", "Air conditioning"],
        estimatedCost: 50,
        estimatedCapacity: 200,
      },
      {
        venueId: "V1",
        venueName: "Main Auditorium",
        matchScore: 85,
        reasons: ["Largest capacity", "Best for flagship events", "Recording & live stream"],
        estimatedCost: 0,
        estimatedCapacity: 800,
      },
    ];
    return recs;
  }, []);

  const toggleVenueFavorite = useCallback((venueId: string) => {
    // In a real app, this would call an API
    void venueId;
  }, []);

  return {
    venues: filteredVenues,
    utilization: filteredUtilization,
    conflicts,
    upcomingBookings,
    summary,
    recommendations,
    heatmapData,
    selectedVenueType,
    setSelectedVenueType,
    dateRange,
    setDateRange,
    searchQuery,
    setSearchQuery,
    selectedVenue,
    setSelectedVenue,
    conflictFilter,
    setConflictFilter,
    toggleVenueFavorite,
    venueTypes: VENUE_TYPES,
  };
}
