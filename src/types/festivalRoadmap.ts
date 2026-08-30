// =============================================================================
// File: src/types/festivalRoadmap.ts
// Issue: #3944 - Build an 'Interactive "Event Roadmap" for Multi-Day Festivals'
// Description: Type definitions for multi-day, multi-track conference roadmaps,
//              concurrent session scheduling, conflict detection, and personal itineraries.
// =============================================================================

export interface FestivalTrack {
  id: string;
  name: string;
  shortCode: string;
  colorHex: string;
  bgLightHex: string;
  description: string;
  iconName?: string;
}

export interface FestivalSpeaker {
  id: string;
  name: string;
  title: string;
  companyOrOrg: string;
  avatarUrl?: string;
  bio?: string;
  linkedinUrl?: string;
}

export interface FestivalSession {
  id: string;
  dayNumber: number; // 1, 2, 3, etc.
  dateString: string; // YYYY-MM-DD
  startTime: string; // HH:MM in 24h format, e.g. "09:00"
  endTime: string; // HH:MM in 24h format, e.g. "10:30"
  startMinutesFromMidnight: number; // e.g. 540
  durationMinutes: number; // e.g. 90
  title: string;
  abstract: string;
  trackId: string;
  trackName: string;
  venueRoom: string;
  buildingName: string;
  capacity: number;
  currentRsvpCount: number;
  speakers: FestivalSpeaker[];
  tags: string[];
  isKeynote?: boolean;
  requiresRegistration?: boolean;
  slideDeckUrl?: string;
}

export interface PersonalItineraryItem {
  id: string;
  userId: string;
  festivalEventId: string;
  sessionId: string;
  session: FestivalSession;
  hasConflict?: boolean;
  conflictWithSessionTitle?: string;
  addedAt: string;
}

export interface FestivalDaySchedule {
  dayNumber: number;
  dateString: string;
  dayLabel: string; // e.g. "Day 1 - Friday, Oct 24"
  startHour: number; // e.g. 9 for 09:00 AM
  endHour: number; // e.g. 20 for 08:00 PM
  tracks: FestivalTrack[];
  sessions: FestivalSession[];
}

export interface FestivalRoadmapFilterState {
  selectedDay: number;
  selectedTrackId: string; // "all" or specific track ID
  searchQuery: string;
  showOnlyBookmarked: boolean;
  selectedTag?: string;
}
