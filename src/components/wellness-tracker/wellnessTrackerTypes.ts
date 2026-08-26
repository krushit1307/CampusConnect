/**
 * Campus Wellness Tracker — Type Definitions
 *
 * Fitness activities, wellness challenges, mental health resources,
 * campus health events, and wellness analytics.
 */

export const ACTIVITY_TYPES = [
  'Running', 'Walking', 'Cycling', 'Swimming', 'Yoga', 'Weight Training',
  'Basketball', 'Soccer', 'Tennis', 'Dance', 'Meditation', 'Hiking',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const CHALLENGE_STATUSES = ['Upcoming', 'Active', 'Completed', 'Cancelled'] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const WELLNESS_CATEGORIES = ['Physical', 'Mental', 'Nutritional', 'Social', 'Sleep', 'Financial'] as const;
export type WellnessCategory = (typeof WELLNESS_CATEGORIES)[number];

export const MENTAL_HEALTH_TYPES = ['Counseling', 'Workshop', 'Support Group', 'Self-Help', 'Crisis Support', 'Peer Support'] as const;
export type MentalHealthType = (typeof MENTAL_HEALTH_TYPES)[number];

export const RESOURCE_TYPES = ['Article', 'Video', 'App', 'Hotline', 'In-Person', 'Online'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  'Running': '#ef4444', 'Walking': '#22c55e', 'Cycling': '#3b82f6',
  'Swimming': '#06b6d4', 'Yoga': '#8b5cf6', 'Weight Training': '#f59e0b',
  'Basketball': '#f97316', 'Soccer': '#14b8a6', 'Tennis': '#ec4899',
  'Dance': '#a855f7', 'Meditation': '#6366f1', 'Hiking': '#16a34a',
};

export const CATEGORY_COLORS: Record<WellnessCategory, string> = {
  'Physical': '#22c55e', 'Mental': '#8b5cf6', 'Nutritional': '#f59e0b',
  'Social': '#3b82f6', 'Sleep': '#6366f1', 'Financial': '#06b6d4',
};

export const CHALLENGE_COLORS: Record<ChallengeStatus, string> = {
  'Upcoming': '#3b82f6', 'Active': '#22c55e', 'Completed': '#6b7280', 'Cancelled': '#ef4444',
};

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  'Running': '🏃', 'Walking': '🚶', 'Cycling': '🚴', 'Swimming': '🏊',
  'Yoga': '🧘', 'Weight Training': '🏋️', 'Basketball': '🏀',
  'Soccer': '⚽', 'Tennis': '🎾', 'Dance': '💃', 'Meditation': '🧠', 'Hiking': '🥾',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface WellnessActivity {
  id: string;
  studentId: string;
  studentName: string;
  type: ActivityType;
  category: WellnessCategory;
  duration: number; // minutes
  calories: number;
  date: string;
  distance?: number; // km
  notes?: string;
  moodBefore: number; // 1-5
  moodAfter: number; // 1-5
  rating: number; // 1-5
}

export interface WellnessChallenge {
  id: string;
  title: string;
  description: string;
  category: WellnessCategory;
  status: ChallengeStatus;
  startDate: string;
  endDate: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  participantCount: number;
  maxParticipants: number;
  prize: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

export interface MentalHealthResource {
  id: string;
  title: string;
  type: MentalHealthType;
  resourceType: ResourceType;
  description: string;
  provider: string;
  isFree: boolean;
  rating: number;
  usageCount: number;
  category: WellnessCategory;
  contactInfo?: string;
  availability: string;
}

export interface HealthEvent {
  id: string;
  title: string;
  description: string;
  category: WellnessCategory;
  date: string;
  time: string;
  location: string;
  organizer: string;
  capacity: number;
  registered: number;
  isVirtual: boolean;
  tags: string[];
}

export interface WellnessTrend {
  month: string;
  avgCalories: number;
  avgMood: number;
  totalMinutes: number;
  activeStudents: number;
  challengesCompleted: number;
  eventsAttended: number;
}

export interface CategoryStats {
  category: WellnessCategory;
  activityCount: number;
  totalMinutes: number;
  avgRating: number;
  avgMoodImprovement: number;
  studentCount: number;
}

export interface WellnessSummary {
  totalActivities: number;
  totalStudents: number;
  avgCalories: number;
  avgMood: number;
  activeChallenges: number;
  totalParticipants: number;
  mentalHealthResources: number;
  upcomingEvents: number;
  avgDuration: number;
  topActivity: ActivityType;
}

export interface WellnessInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatMood(mood: number): string {
  if (mood >= 4.5) return '😄';
  if (mood >= 3.5) return '😊';
  if (mood >= 2.5) return '😐';
  if (mood >= 1.5) return '😟';
  return '😢';
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
