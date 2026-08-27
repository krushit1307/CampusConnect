export interface ScheduleTrack {
  id: string;
  event_id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface ScheduleSession {
  id: string;
  event_id: string;
  track_id: string | null;
  track_name: string;
  title: string;
  description: string | null;
  speaker: string | null;
  location: string | null;
  start_time: string; // ISO
  end_time: string; // ISO
  is_favorited?: boolean; // hydrated client-side for the current user
}

export interface ScheduleDay {
  date: string; // yyyy-MM-dd
  label: string; // "Day 1 · Sat, Jun 14"
  sessions: ScheduleSession[];
}


/**
 * Schedule and Academic Conflict Types for CampusConnect
 * Defines interfaces for user class schedules and conflict detection.
 */

export interface ClassBlock {
  id: string;
  user_id: string;
  course_name: string;
  course_code: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time: string; // HH:mm format
  end_time: string; // HH:mm format
  is_mandatory: boolean;
  created_at: string;
}

export interface ScheduleSyncRequest {
  userId: string;
  icsUrl?: string;
  icsContent?: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictingCourses: string[];
  penaltyWaived: boolean;
}
