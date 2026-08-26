// =============================================================================
// File: src/services/festivalRoadmapService.ts
// Issue: #3944 - Build an 'Interactive "Event Roadmap" for Multi-Day Festivals'
// Description: Schedule matrix calculations, conflict detection algorithms,
//              iCalendar (.ics) exports, and multi-track session builders.
// =============================================================================

import { supabase } from "@/lib/supabase/client";
import type {
  FestivalTrack,
  FestivalSession,
  FestivalDaySchedule,
  PersonalItineraryItem,
  FestivalSpeaker,
} from "@/types/festivalRoadmap";

export const STANDARD_FESTIVAL_TRACKS: FestivalTrack[] = [
  {
    id: "track-mainstage",
    name: "Mainstage Keynotes",
    shortCode: "MAIN",
    colorHex: "#F59E0B", // Amber
    bgLightHex: "#FEF3C7",
    description: "Opening keynotes, industry panels, and marquee fireside chats.",
    iconName: "Sparkles",
  },
  {
    id: "track-ai",
    name: "AI & Machine Learning",
    shortCode: "AI/ML",
    colorHex: "#3B82F6", // Blue
    bgLightHex: "#DBEAFE",
    description: "Deep learning workshops, LLM architecture, and robotics demos.",
    iconName: "Cpu",
  },
  {
    id: "track-design",
    name: "Design & UX Systems",
    shortCode: "DESIGN",
    colorHex: "#EC4899", // Pink
    bgLightHex: "#FCE7F3",
    description: "Product design sprints, accessibility teardowns, and design systems.",
    iconName: "Palette",
  },
  {
    id: "track-startup",
    name: "Founders & Venture",
    shortCode: "STARTUP",
    colorHex: "#10B981", // Emerald
    bgLightHex: "#D1FAE5",
    description: "VC pitch competitions, term sheet workshops, and founder stories.",
    iconName: "Rocket",
  },
  {
    id: "track-security",
    name: "Security & Web3",
    shortCode: "CYBER",
    colorHex: "#8B5CF6", // Purple
    bgLightHex: "#EDE9FE",
    description: "Zero-trust architectures, capture-the-flag contests, and cryptography.",
    iconName: "Shield",
  },
];

/**
 * Converts HH:MM string to total minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Converts minutes from midnight into 12-hour AM/PM string format.
 */
export function minutesToTimeString(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  const minFormatted = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours12}:${minFormatted} ${ampm}`;
}

/**
 * Realistic mock dataset for a 3-Day University Innovation Summit.
 */
export function getMockFestivalSchedule(festivalId: string = "fest-summit-2026"): FestivalDaySchedule[] {
  const speakers: Record<string, FestivalSpeaker> = {
    s1: {
      id: "spk-1",
      name: "Dr. Elena Rostova",
      title: "VP of Foundation AI",
      companyOrOrg: "DeepMind Robotics",
      bio: "Pioneered multimodal autonomous agents and spatial neural representations.",
    },
    s2: {
      id: "spk-2",
      name: "Marcus Aurelius Vance",
      title: "General Partner",
      companyOrOrg: "Horizon Ventures",
      bio: "Invested in 40+ campus spinoffs with over $2B in aggregate market valuation.",
    },
    s3: {
      id: "spk-3",
      name: "Sophia Chen",
      title: "Principal Design Architect",
      companyOrOrg: "Figma Systems",
      bio: "Author of Modern Fluid Design Systems and Web Standards Working Group member.",
    },
    s4: {
      id: "spk-4",
      name: "Darius Thorne",
      title: "Chief Security Officer",
      companyOrOrg: "ZeroTrust Bio-Defense",
      bio: "Specializes in biometric cryptographic protocols and healthcare cybersecurity.",
    },
  };

  const day1Sessions: FestivalSession[] = [
    {
      id: "sess-101",
      dayNumber: 1,
      dateString: "2026-10-23",
      startTime: "09:00",
      endTime: "10:30",
      startMinutesFromMidnight: 540,
      durationMinutes: 90,
      title: "Summit Keynote: The Autonomous Software Horizon",
      abstract: "Opening plenary exploring the intersection of biological intelligence and neural agent architectures.",
      trackId: "track-mainstage",
      trackName: "Mainstage Keynotes",
      venueRoom: "Auditorium Hall A",
      buildingName: "Student Center Complex",
      capacity: 600,
      currentRsvpCount: 520,
      speakers: [speakers.s1, speakers.s2],
      tags: ["AI", "Keynote", "Plenary"],
      isKeynote: true,
    },
    {
      id: "sess-102",
      dayNumber: 1,
      dateString: "2026-10-23",
      startTime: "11:00",
      endTime: "12:30",
      startMinutesFromMidnight: 660,
      durationMinutes: 90,
      title: "Hands-on Workshop: Building Multimodal Neural Sidecars",
      abstract: "Interactive coding lab orchestrating real-time vision-language models with local tool dispatch.",
      trackId: "track-ai",
      trackName: "AI & Machine Learning",
      venueRoom: "Lab 304 (Bring Laptops)",
      buildingName: "Engineering Center",
      capacity: 80,
      currentRsvpCount: 78,
      speakers: [speakers.s1],
      tags: ["Python", "PyTorch", "Agents"],
    },
    {
      id: "sess-103",
      dayNumber: 1,
      dateString: "2026-10-23",
      startTime: "11:00",
      endTime: "12:15",
      startMinutesFromMidnight: 660,
      durationMinutes: 75,
      title: "Design Systems at Scale: From Token to Motion",
      abstract: "How modern product teams maintain mathematical design harmony across web and native devices.",
      trackId: "track-design",
      trackName: "Design & UX Systems",
      venueRoom: "Atrium Studio 1",
      buildingName: "Media Arts Building",
      capacity: 120,
      currentRsvpCount: 95,
      speakers: [speakers.s3],
      tags: ["Figma", "Design Tokens", "CSS"],
    },
    {
      id: "sess-104",
      dayNumber: 1,
      dateString: "2026-10-23",
      startTime: "13:30",
      endTime: "15:00",
      startMinutesFromMidnight: 810,
      durationMinutes: 90,
      title: "Venture Pitch Masterclass: Raising Pre-Seed on Campus",
      abstract: "Direct feedback on student startup pitches with live term sheet breakdowns and valuation heuristics.",
      trackId: "track-startup",
      trackName: "Founders & Venture",
      venueRoom: "Innovation Loft 2",
      buildingName: "Student Center Complex",
      capacity: 100,
      currentRsvpCount: 88,
      speakers: [speakers.s2],
      tags: ["Startups", "Venture", "Funding"],
    },
    {
      id: "sess-105",
      dayNumber: 1,
      dateString: "2026-10-23",
      startTime: "13:30",
      endTime: "15:00",
      startMinutesFromMidnight: 810,
      durationMinutes: 90,
      title: "Zero-Trust Cryptography & Threat Modeling Workshop",
      abstract: "Simulating adversarial nation-state intrusion scenarios and deploying WebAuthn Passkeys.",
      trackId: "track-security",
      trackName: "Security & Web3",
      venueRoom: "Cyber Range Room 110",
      buildingName: "Engineering Center",
      capacity: 70,
      currentRsvpCount: 65,
      speakers: [speakers.s4],
      tags: ["Security", "WebAuthn", "Crypto"],
    },
    {
      id: "sess-106",
      dayNumber: 1,
      dateString: "2026-10-23",
      startTime: "15:30",
      endTime: "17:00",
      startMinutesFromMidnight: 930,
      durationMinutes: 90,
      title: "Day 1 Mixer: Inter-Club Networking & Demo Alley",
      abstract: "Over 25 student engineering clubs showcase their latest robotics, rockets, and software builds.",
      trackId: "track-mainstage",
      trackName: "Mainstage Keynotes",
      venueRoom: "Grand Exhibition Hall",
      buildingName: "Student Center Complex",
      capacity: 500,
      currentRsvpCount: 420,
      speakers: [],
      tags: ["Networking", "Demos", "Food"],
    },
  ];

  const day2Sessions: FestivalSession[] = [
    {
      id: "sess-201",
      dayNumber: 2,
      dateString: "2026-10-24",
      startTime: "09:30",
      endTime: "11:00",
      startMinutesFromMidnight: 570,
      durationMinutes: 90,
      title: "Morning Plenary: The Ethics of Superhuman Bio-AI",
      abstract: "Examining regulatory guidelines (FDA, EMA) and patient autonomy in automated triage systems.",
      trackId: "track-mainstage",
      trackName: "Mainstage Keynotes",
      venueRoom: "Auditorium Hall A",
      buildingName: "Student Center Complex",
      capacity: 600,
      currentRsvpCount: 480,
      speakers: [speakers.s1, speakers.s4],
      tags: ["Bio-AI", "Ethics", "Medicine"],
      isKeynote: true,
    },
    {
      id: "sess-202",
      dayNumber: 2,
      dateString: "2026-10-24",
      startTime: "11:30",
      endTime: "13:00",
      startMinutesFromMidnight: 690,
      durationMinutes: 90,
      title: "Next-Gen Web Architecture: Streaming SSR & Edge Workers",
      abstract: "Building zero-latency reactive interfaces using Deno, Cloudflare Workers, and Supabase RPCs.",
      trackId: "track-ai",
      trackName: "AI & Machine Learning",
      venueRoom: "Lab 304",
      buildingName: "Engineering Center",
      capacity: 80,
      currentRsvpCount: 75,
      speakers: [speakers.s3],
      tags: ["React", "TypeScript", "Performance"],
    },
    {
      id: "sess-203",
      dayNumber: 2,
      dateString: "2026-10-24",
      startTime: "14:00",
      endTime: "17:30",
      startMinutesFromMidnight: 840,
      durationMinutes: 210,
      title: "Annual Hackathon Sprint: 3-Hour Rapid Prototyping Clash",
      abstract: "Teams build functional AI-powered accessibility utilities with live mentor judging.",
      trackId: "track-startup",
      trackName: "Founders & Venture",
      venueRoom: "Grand Exhibition Hall",
      buildingName: "Student Center Complex",
      capacity: 350,
      currentRsvpCount: 310,
      speakers: [speakers.s2, speakers.s3],
      tags: ["Hackathon", "Prizes", "Mentors"],
    },
  ];

  return [
    {
      dayNumber: 1,
      dateString: "2026-10-23",
      dayLabel: "Day 1 • Friday, Oct 23 (Kickoff & Deep Dives)",
      startHour: 9,
      endHour: 18,
      tracks: STANDARD_FESTIVAL_TRACKS,
      sessions: day1Sessions,
    },
    {
      dayNumber: 2,
      dateString: "2026-10-24",
      dayLabel: "Day 2 • Saturday, Oct 24 (Hackathon & Demos)",
      startHour: 9,
      endHour: 18,
      tracks: STANDARD_FESTIVAL_TRACKS,
      sessions: day2Sessions,
    },
  ];
}

/**
 * Schedule Conflict Detector: Identifies overlapping time blocks in user's
 * bookmarked personal itinerary.
 */
export function detectItineraryConflicts(
  bookmarkedSessions: FestivalSession[]
): {
  conflictSessionIds: Set<string>;
  conflictPairs: { sessionA: FestivalSession; sessionB: FestivalSession }[];
} {
  const conflictSessionIds = new Set<string>();
  const conflictPairs: { sessionA: FestivalSession; sessionB: FestivalSession }[] = [];

  for (let i = 0; i < bookmarkedSessions.length; i++) {
    for (let j = i + 1; j < bookmarkedSessions.length; j++) {
      const a = bookmarkedSessions[i];
      const b = bookmarkedSessions[j];

      if (a.dayNumber === b.dayNumber) {
        const aStart = a.startMinutesFromMidnight;
        const aEnd = a.startMinutesFromMidnight + a.durationMinutes;
        const bStart = b.startMinutesFromMidnight;
        const bEnd = b.startMinutesFromMidnight + b.durationMinutes;

        // Overlap condition: aStart < bEnd && bStart < aEnd
        if (aStart < bEnd && bStart < aEnd) {
          conflictSessionIds.add(a.id);
          conflictSessionIds.add(b.id);
          conflictPairs.push({ sessionA: a, sessionB: b });
        }
      }
    }
  }

  return { conflictSessionIds, conflictPairs };
}

/**
 * RFC 5545 Standard iCalendar (.ics) export builder.
 */
export function exportItineraryToICal(
  sessions: FestivalSession[],
  festivalTitle: string = "CampusConnect Innovation Summit 2026",
  fileName: string = "my_festival_itinerary.ics"
): void {
  const formatICalDate = (dateStr: string, timeStr: string) => {
    const cleanDate = dateStr.replace(/-/g, "");
    const cleanTime = timeStr.replace(/:/g, "") + "00";
    return `${cleanDate}T${cleanTime}`;
  };

  const vEvents = sessions.map((s) => {
    const dtStart = formatICalDate(s.dateString, s.startTime);
    const dtEnd = formatICalDate(s.dateString, s.endTime);
    const summary = `${s.isKeynote ? "⭐ " : ""}${s.title} [${s.trackName}]`;
    const description = `${s.abstract}\\n\\nSpeakers: ${s.speakers.map((sp) => `${sp.name} (${sp.companyOrOrg})`).join(", ")}`;
    const location = `${s.venueRoom}, ${s.buildingName}`;

    return [
      `BEGIN:VEVENT`,
      `UID:${s.id}@campusconnect.edu`,
      `DTSTAMP:${formatICalDate(new Date().toISOString().split("T")[0], "12:00")}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      `STATUS:CONFIRMED`,
      `END:VEVENT`,
    ].join("\r\n");
  });

  const icsContent = [
    `BEGIN:VCALENDAR`,
    `VERSION:2.0`,
    `PRODID:-//CampusConnect//Festival Roadmap Engine//EN`,
    `CALSCALE:GREGORIAN`,
    `METHOD:PUBLISH`,
    `X-WR-CALNAME:${festivalTitle} - My Itinerary`,
    ...vEvents,
    `END:VCALENDAR`,
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Persist user's personalized festival bookmarks in Supabase.
 */
export async function syncPersonalItinerary(
  userId: string,
  festivalEventId: string,
  bookmarkedSessionIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = {
      user_id: userId,
      festival_event_id: festivalEventId,
      session_ids_json: bookmarkedSessionIds,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("user_festival_itineraries")
      .upsert(payload, { onConflict: "user_id,festival_event_id" });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to persist itinerary" };
  }
}
