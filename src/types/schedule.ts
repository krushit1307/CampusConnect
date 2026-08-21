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
