/**
 * Campus Event Calendar — Type Definitions
 *
 * Event management, RSVP tracking, venue scheduling,
 * recurring events, and attendance analytics.
 */

export const EVENT_CATEGORIES = [
  'Academic', 'Social', 'Sports', 'Workshop', 'Conference',
  'Club Meeting', 'Career Fair', 'Cultural', 'Volunteer', 'Fundraiser',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_STATUSES = ['Upcoming', 'Live', 'Completed', 'Cancelled', 'Postponed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const RSVP_STATUSES = ['Going', 'Maybe', 'Not Going', 'Waitlisted'] as const;
export type RSVPStatus = (typeof RSVP_STATUSES)[number];

export const VENUE_TYPES = ['Auditorium', 'Classroom', 'Outdoor', 'Virtual', 'Lab', 'Gym', 'Cafeteria'] as const;
export type VenueType = (typeof VENUE_TYPES)[number];

export const RECURRING_PATTERNS = ['None', 'Weekly', 'Bi-Weekly', 'Monthly', 'Semester'] as const;
export type RecurringPattern = (typeof RECURRING_PATTERNS)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  'Academic': '#3b82f6', 'Social': '#8b5cf6', 'Sports': '#22c55e',
  'Workshop': '#f59e0b', 'Conference': '#06b6d4', 'Club Meeting': '#ec4899',
  'Career Fair': '#f97316', 'Cultural': '#a855f7', 'Volunteer': '#14b8a6', 'Fundraiser': '#ef4444',
};

export const STATUS_COLORS: Record<EventStatus, string> = {
  'Upcoming': '#3b82f6', 'Live': '#22c55e', 'Completed': '#6b7280',
  'Cancelled': '#ef4444', 'Postponed': '#eab308',
};

export const CATEGORY_ICONS: Record<EventCategory, string> = {
  'Academic': '📖', 'Social': '🎉', 'Sports': '⚽', 'Workshop': '🔧',
  'Conference': '🎤', 'Club Meeting': '👥', 'Career Fair': '💼',
  'Cultural': '🎭', 'Volunteer': '🤝', 'Fundraiser': '💰',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  status: EventStatus;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  venueType: VenueType;
  organizer: string;
  organizerClub?: string;
  maxCapacity: number;
  currentRSVPs: number;
  waitlistCount: number;
  recurring: RecurringPattern;
  tags: string[];
  isFeatured: boolean;
  coverImage?: string;
  contactEmail: string;
  createdAt: string;
}

export interface EventRSVP {
  id: string;
  eventId: string;
  eventTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: RSVPStatus;
  checkedIn: boolean;
  rsvpedAt: string;
  feedback?: string;
  rating?: number; // 1-5
}

export interface VenueBooking {
  id: string;
  venue: string;
  venueType: VenueType;
  eventId: string;
  eventTitle: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  bookedBy: string;
  capacity: number;
  equipment: string[];
}

export interface EventTrend {
  month: string;
  totalEvents: number;
  totalAttendees: number;
  avgAttendance: number;
  topCategory: EventCategory;
  newClubs: number;
  repeatAttendees: number;
}

export interface ClubActivity {
  clubName: string;
  totalEvents: number;
  totalAttendees: number;
  avgRating: number;
  upcomingEvents: number;
  memberCount: number;
  topCategory: EventCategory;
  engagementScore: number; // 0-100
}

export interface EventInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

export interface EventSummary {
  totalEvents: number;
  upcomingEvents: number;
  liveEvents: number;
  completedEvents: number;
  totalRSVPs: number;
  avgAttendanceRate: number;
  totalVenues: number;
  totalClubs: number;
  avgRating: number;
  capacityUtilization: number;
  topCategory: EventCategory;
  totalAttendees: number;
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function formatCapacity(current: number, max: number): string {
  const pct = Math.round((current / max) * 100);
  return `${current}/${max} (${pct}%)`;
}

export function getCapacityColor(current: number, max: number): string {
  const pct = (current / max) * 100;
  if (pct >= 95) return '#ef4444';
  if (pct >= 75) return '#eab308';
  return '#22c55e';
}
