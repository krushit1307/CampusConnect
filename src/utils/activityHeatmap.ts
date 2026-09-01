/**
 * Activity Heatmap — Data generation, computation, and aggregation utilities.
 *
 * Provides mock campus event data and functions to compute:
 * - Day × hour activity grids
 * - Location-level activity rankings
 * - Club engagement scores
 * - RSVP velocity over time
 * - Category distribution across time periods
 */

// ── Types ──────────────────────────────────────────────────────────

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const ALL_HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM – 11 PM

export type EventCategory =
  | "academic"
  | "cultural"
  | "sports"
  | "tech"
  | "social"
  | "workshop"
  | "seminar"
  | "concert"
  | "exhibition"
  | "networking";

export interface CampusEvent {
  id: string;
  title: string;
  category: EventCategory;
  dayOfWeek: DayOfWeek;
  startHour: number;
  durationHours: number;
  location: string;
  club: string;
  rsvpCount: number;
  capacity: number;
  weekNumber: number; // 1-12 for the semester
}

export interface TimeSlotActivity {
  day: DayOfWeek;
  hour: number;
  eventCount: number;
  totalRsvps: number;
  avgFillRate: number;
  categories: Record<EventCategory, number>;
}

export interface LocationActivity {
  location: string;
  totalEvents: number;
  totalRsvps: number;
  avgFillRate: number;
  peakHour: number;
  peakDay: DayOfWeek;
}

export interface ClubEngagement {
  club: string;
  totalEvents: number;
  totalRsvps: number;
  avgFillRate: number;
  engagementScore: number; // composite 0-100
}

export interface RSVPVelocityPoint {
  week: number;
  label: string;
  totalRsvps: number;
  avgDailyRsvps: number;
  topCategory: EventCategory;
}

export interface CategoryDistribution {
  category: EventCategory;
  count: number;
  percentage: number;
  avgFillRate: number;
}

export interface HeatmapDataset {
  timeSlots: TimeSlotActivity[];
  locations: LocationActivity[];
  clubs: ClubEngagement[];
  rsvpVelocity: RSVPVelocityPoint[];
  categories: CategoryDistribution[];
  summaryStats: SummaryStats;
}

export interface SummaryStats {
  totalEvents: number;
  totalRsvps: number;
  avgFillRate: number;
  peakDay: DayOfWeek;
  peakHour: number;
  mostActiveClub: string;
  busiestLocation: string;
  weeklyGrowthRate: number;
}

// ── Constants ──────────────────────────────────────────────────────

const LOCATIONS = [
  "Main Auditorium",
  "CS Lab B",
  "Seminar Hall 1",
  "Seminar Hall 2",
  "Sports Complex",
  "Open Air Theatre",
  "Convention Center",
  "Innovation Hub",
  "Art Gallery",
  "Student Center",
  "Food Court",
  "Computer Lab A",
  "Computer Lab B",
  "Engineering Lab",
];

const CLUBS = [
  "CS Club",
  "Music Society",
  "Drama Club",
  "Photography Club",
  "E-Cell",
  "Robotics Club",
  "AI/ML Club",
  "Sports Council",
  "Film Society",
  "Dance Club",
  "International Club",
  "Debate Society",
  "Art Society",
  "Photography Club",
  "Literary Society",
];

const CATEGORY_TITLES: Record<EventCategory, string[]> = {
  academic: [
    "Midterm Review Session",
    "Guest Lecture Series",
    "Study Group Meetup",
    "Research Presentation",
  ],
  cultural: ["Cultural Night", "Folk Dance Workshop", "Language Exchange", "Heritage Exhibition"],
  sports: [
    "Inter-Department Tournament",
    "Yoga Morning Session",
    "Cricket Practice",
    "Fitness Challenge",
  ],
  tech: ["Hackathon Sprint", "Tech Talk: Cloud", "Code Review Session", "DevOps Workshop"],
  social: ["Open Mic Night", "Board Game Night", "Movie Screening", "Potluck Dinner"],
  workshop: ["Git & GitHub Workshop", "Figma Design Sprint", "React Deep Dive", "SQL Masterclass"],
  seminar: [
    "Industry Panel Discussion",
    "Career Guidance Seminar",
    "Ethics in Tech Talk",
    "Startup Q&A",
  ],
  concert: ["Acoustic Jam Session", "Classical Music Night", "Band Rehearsal Show", "EDM Night"],
  exhibition: ["Photography Exhibition", "Art Show Case", "Innovation Expo", "Science Fair"],
  networking: ["Alumni Mixer", "Corporate Connect", "Startup Pitch Night", "Career Fair"],
};

// ── Seeded Pseudo-Random ──────────────────────────────────────────

function mulberry32(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

// ── Activity Hot Zones ─────────────────────────────────────────────
// Certain day/hour combos are naturally busier on a campus

const HOT_ZONES: Partial<Record<string, number>> = {
  "Mon-10": 1.4,
  "Mon-14": 1.3,
  "Tue-11": 1.5,
  "Tue-15": 1.2,
  "Wed-10": 1.3,
  "Wed-16": 1.4,
  "Thu-11": 1.2,
  "Thu-14": 1.3,
  "Fri-10": 1.6,
  "Fri-15": 1.5,
  "Sat-10": 1.8,
  "Sat-11": 2.0,
  "Sat-14": 1.7,
  "Sun-11": 1.3,
};

// ── Mock Data Generator ────────────────────────────────────────────

export function generateMockEvents(seed = 42, weekCount = 12): CampusEvent[] {
  const rand = seededRandom(seed);
  const events: CampusEvent[] = [];
  const categories: EventCategory[] = [
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

  let id = 1;

  for (let week = 1; week <= weekCount; week++) {
    // 8-14 events per week
    const eventsThisWeek = Math.floor(rand() * 7) + 8;

    for (let e = 0; e < eventsThisWeek; e++) {
      const category = categories[Math.floor(rand() * categories.length)];
      const dayIdx = Math.floor(rand() * 7);
      const day = ALL_DAYS[dayIdx];
      const hour = ALL_HOURS[Math.floor(rand() * ALL_HOURS.length)];
      const dur = rand() > 0.7 ? 2 : 1;
      const location = LOCATIONS[Math.floor(rand() * LOCATIONS.length)];
      const club = CLUBS[Math.floor(rand() * CLUBS.length)];
      const titles = CATEGORY_TITLES[category];
      const title = titles[Math.floor(rand() * titles.length)];
      const capacity = [50, 100, 150, 200, 300, 500][Math.floor(rand() * 6)];

      // Hot zone multiplier
      const hotKey = `${day}-${hour}`;
      const hotMult = HOT_ZONES[hotKey] || 1.0;

      // Fill rate depends on category + hot zone
      const baseFill = 0.3 + rand() * 0.5;
      const fillRate = Math.min(baseFill * hotMult, 1.0);
      const rsvpCount = Math.round(capacity * fillRate);

      events.push({
        id: `ev-${id++}`,
        title,
        category,
        dayOfWeek: day,
        startHour: hour,
        durationHours: dur,
        location,
        club,
        rsvpCount,
        capacity,
        weekNumber: week,
      });
    }
  }

  return events;
}

// ── Computations ───────────────────────────────────────────────────

export function computeTimeSlotGrid(events: CampusEvent[]): TimeSlotActivity[] {
  const slots: Map<string, TimeSlotActivity> = new Map();

  // Initialize all slots
  for (const day of ALL_DAYS) {
    for (const hour of ALL_HOURS) {
      const key = `${day}-${hour}`;
      slots.set(key, {
        day,
        hour,
        eventCount: 0,
        totalRsvps: 0,
        avgFillRate: 0,
        categories: {
          academic: 0,
          cultural: 0,
          sports: 0,
          tech: 0,
          social: 0,
          workshop: 0,
          seminar: 0,
          concert: 0,
          exhibition: 0,
          networking: 0,
        },
      });
    }
  }

  for (const event of events) {
    for (let h = 0; h < event.durationHours; h++) {
      const key = `${event.dayOfWeek}-${event.startHour + h}`;
      const slot = slots.get(key);
      if (slot) {
        slot.eventCount++;
        slot.totalRsvps += event.rsvpCount;
        slot.categories[event.category]++;
      }
    }
  }

  // Compute avg fill rates
  for (const slot of slots.values()) {
    const slotEvents = events.filter(
      (e) =>
        e.dayOfWeek === slot.day &&
        e.startHour <= slot.hour &&
        e.startHour + e.durationHours > slot.hour,
    );
    if (slotEvents.length > 0) {
      slot.avgFillRate =
        slotEvents.reduce((sum, e) => sum + e.rsvpCount / e.capacity, 0) / slotEvents.length;
    }
  }

  return Array.from(slots.values());
}

export function computeLocationActivity(events: CampusEvent[]): LocationActivity[] {
  const locationMap = new Map<string, { events: CampusEvent[] }>();

  for (const event of events) {
    if (!locationMap.has(event.location)) {
      locationMap.set(event.location, { events: [] });
    }
    locationMap.get(event.location)!.events.push(event);
  }

  return Array.from(locationMap.entries())
    .map(([location, data]) => {
      const evts = data.events;
      const totalRsvps = evts.reduce((s, e) => s + e.rsvpCount, 0);
      const avgFillRate = evts.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / evts.length;

      // Find peak hour
      const hourCounts = new Map<number, number>();
      for (const e of evts) {
        hourCounts.set(e.startHour, (hourCounts.get(e.startHour) || 0) + 1);
      }
      let peakHour = 10;
      let maxCount = 0;
      for (const [h, c] of hourCounts) {
        if (c > maxCount) {
          maxCount = c;
          peakHour = h;
        }
      }

      // Find peak day
      const dayCounts = new Map<string, number>();
      for (const e of evts) {
        dayCounts.set(e.dayOfWeek, (dayCounts.get(e.dayOfWeek) || 0) + 1);
      }
      let peakDay: DayOfWeek = "Mon";
      let maxDayCount = 0;
      for (const [d, c] of dayCounts) {
        if (c > maxDayCount) {
          maxDayCount = c;
          peakDay = d as DayOfWeek;
        }
      }

      return {
        location,
        totalEvents: evts.length,
        totalRsvps,
        avgFillRate,
        peakHour,
        peakDay,
      };
    })
    .sort((a, b) => b.totalEvents - a.totalEvents);
}

export function computeClubEngagement(events: CampusEvent[]): ClubEngagement[] {
  const clubMap = new Map<string, CampusEvent[]>();

  for (const event of events) {
    if (!clubMap.has(event.club)) {
      clubMap.set(event.club, []);
    }
    clubMap.get(event.club)!.push(event);
  }

  const raw = Array.from(clubMap.entries()).map(([club, evts]) => {
    const totalRsvps = evts.reduce((s, e) => s + e.rsvpCount, 0);
    const avgFillRate = evts.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / evts.length;

    // Composite score: event count (30%) + RSVP volume (30%) + fill rate (40%)
    const eventScore = Math.min(evts.length / 15, 1);
    const rsvpScore = Math.min(totalRsvps / 2000, 1);
    const fillScore = avgFillRate;
    const engagementScore = Math.round(
      (eventScore * 0.3 + rsvpScore * 0.3 + fillScore * 0.4) * 100,
    );

    return { club, totalEvents: evts.length, totalRsvps, avgFillRate, engagementScore };
  });

  return raw.sort((a, b) => b.engagementScore - a.engagementScore);
}

export function computeRSVPVelocity(events: CampusEvent[], weekCount = 12): RSVPVelocityPoint[] {
  const weeks: RSVPVelocityPoint[] = [];
  const categories: EventCategory[] = [
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

  for (let w = 1; w <= weekCount; w++) {
    const weekEvents = events.filter((e) => e.weekNumber === w);
    const totalRsvps = weekEvents.reduce((s, e) => s + e.rsvpCount, 0);

    // Top category by RSVP count
    const catCounts = new Map<EventCategory, number>();
    for (const e of weekEvents) {
      catCounts.set(e.category, (catCounts.get(e.category) || 0) + e.rsvpCount);
    }
    let topCat: EventCategory = "tech";
    let maxCat = 0;
    for (const [c, n] of catCounts) {
      if (n > maxCat) {
        maxCat = n;
        topCat = c;
      }
    }

    weeks.push({
      week: w,
      label: `W${w}`,
      totalRsvps,
      avgDailyRsvps: Math.round(totalRsvps / 7),
      topCategory: topCat,
    });
  }

  return weeks;
}

export function computeCategoryDistribution(events: CampusEvent[]): CategoryDistribution[] {
  const catCounts = new Map<EventCategory, { count: number; fillSum: number }>();

  for (const event of events) {
    const existing = catCounts.get(event.category) || { count: 0, fillSum: 0 };
    existing.count++;
    existing.fillSum += event.rsvpCount / event.capacity;
    catCounts.set(event.category, existing);
  }

  const totalEvents = events.length;

  return Array.from(catCounts.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      percentage: Math.round((data.count / totalEvents) * 100),
      avgFillRate: data.fillSum / data.count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeSummaryStats(events: CampusEvent[]): SummaryStats {
  const totalRsvps = events.reduce((s, e) => s + e.rsvpCount, 0);
  const avgFillRate = events.reduce((s, e) => s + e.rsvpCount / e.capacity, 0) / events.length;

  // Peak day
  const dayCounts = new Map<string, number>();
  for (const e of events) {
    dayCounts.set(e.dayOfWeek, (dayCounts.get(e.dayOfWeek) || 0) + 1);
  }
  let peakDay: DayOfWeek = "Mon";
  let maxDay = 0;
  for (const [d, c] of dayCounts) {
    if (c > maxDay) {
      maxDay = c;
      peakDay = d as DayOfWeek;
    }
  }

  // Peak hour
  const hourCounts = new Map<number, number>();
  for (const e of events) {
    hourCounts.set(e.startHour, (hourCounts.get(e.startHour) || 0) + 1);
  }
  let peakHour = 10;
  let maxHour = 0;
  for (const [h, c] of hourCounts) {
    if (c > maxHour) {
      maxHour = c;
      peakHour = h;
    }
  }

  // Most active club
  const clubCounts = new Map<string, number>();
  for (const e of events) {
    clubCounts.set(e.club, (clubCounts.get(e.club) || 0) + 1);
  }
  let mostActiveClub = "CS Club";
  let maxClub = 0;
  for (const [cl, c] of clubCounts) {
    if (c > maxClub) {
      maxClub = c;
      mostActiveClub = cl;
    }
  }

  // Busiest location
  const locCounts = new Map<string, number>();
  for (const e of events) {
    locCounts.set(e.location, (locCounts.get(e.location) || 0) + 1);
  }
  let busiestLocation = "Main Auditorium";
  let maxLoc = 0;
  for (const [l, c] of locCounts) {
    if (c > maxLoc) {
      maxLoc = c;
      busiestLocation = l;
    }
  }

  // Weekly growth rate (first half vs second half)
  const halfWeek = Math.floor(events.reduce((s, e) => Math.max(s, e.weekNumber), 0) / 2);
  const firstHalf = events.filter((e) => e.weekNumber <= halfWeek);
  const secondHalf = events.filter((e) => e.weekNumber > halfWeek);
  const firstRsvps = firstHalf.reduce((s, e) => s + e.rsvpCount, 0);
  const secondRsvps = secondHalf.reduce((s, e) => s + e.rsvpCount, 0);
  const weeklyGrowthRate = firstRsvps > 0 ? (secondRsvps - firstRsvps) / firstRsvps : 0;

  return {
    totalEvents: events.length,
    totalRsvps,
    avgFillRate,
    peakDay,
    peakHour,
    mostActiveClub,
    busiestLocation,
    weeklyGrowthRate,
  };
}

// ── Full Dataset Builder ───────────────────────────────────────────

export function buildHeatmapDataset(seed = 42, weekCount = 12): HeatmapDataset {
  const events = generateMockEvents(seed, weekCount);

  return {
    timeSlots: computeTimeSlotGrid(events),
    locations: computeLocationActivity(events),
    clubs: computeClubEngagement(events),
    rsvpVelocity: computeRSVPVelocity(events, weekCount),
    categories: computeCategoryDistribution(events),
    summaryStats: computeSummaryStats(events),
  };
}

// ── Heatmap Color Scale ────────────────────────────────────────────

export function getHeatColor(value: number, max: number): string {
  if (max === 0) return "rgba(255,255,255,0.02)";
  const ratio = Math.min(value / max, 1);

  if (ratio === 0) return "rgba(255,255,255,0.03)";
  if (ratio < 0.2) return "rgba(99,102,241,0.15)";
  if (ratio < 0.4) return "rgba(99,102,241,0.3)";
  if (ratio < 0.6) return "rgba(139,92,246,0.45)";
  if (ratio < 0.8) return "rgba(236,72,153,0.6)";
  return "rgba(244,63,94,0.8)";
}

export function getFillRateColor(rate: number): string {
  if (rate >= 0.9) return "#ef4444";
  if (rate >= 0.7) return "#f59e0b";
  if (rate >= 0.5) return "#06b6d4";
  return "#10b981";
}

// ── Category Colors ────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<EventCategory, string> = {
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

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  academic: "Academic",
  cultural: "Cultural",
  sports: "Sports",
  tech: "Tech",
  social: "Social",
  workshop: "Workshop",
  seminar: "Seminar",
  concert: "Concert",
  exhibition: "Exhibition",
  networking: "Networking",
};
