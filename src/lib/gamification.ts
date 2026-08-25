import { createClient } from '@supabase/supabase-js';
import { CheckInResponse } from '@/types/gamification';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PointEntry {
  userId: string;
  amount: number;
  reason: string;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  requiredEventsAttended: number;
  requiredTotalPoints: number;
}

export interface UserLeaderboardEntry {
  userId: string;
  name: string;
  totalPoints: number;
  eventsAttendedCount: number;
  badges: string[];
  rank: number;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first_rsvp",
    name: "First Step",
    description: "RSVP'd to your first campus event",
    requiredEventsAttended: 0,
    requiredTotalPoints: 10,
  },
  {
    id: "event_enthusiast",
    name: "Event Enthusiast",
    description: "Attended 5 verified campus events",
    requiredEventsAttended: 5,
    requiredTotalPoints: 100,
  },
  {
    id: "campus_legend",
    name: "Campus Legend",
    description: "Attended 10 verified campus events and earned 250 points",
    requiredEventsAttended: 10,
    requiredTotalPoints: 250,
  },
];

/**
 * Sums point entries to calculate total user points.
 */
export function calculateTotalUserPoints(entries: PointEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Evaluates which badges a user qualifies for based on points and verified event count.
 */
export function evaluateUnlockedBadges(totalPoints: number, eventsAttendedCount: number): string[] {
  return BADGE_DEFINITIONS.filter(
    (b) => totalPoints >= b.requiredTotalPoints && eventsAttendedCount >= b.requiredEventsAttended,
  ).map((b) => b.id);
}

/**
 * Computes sorted student leaderboard with rank assignments.
 */
export function rankLeaderboardUsers(
  users: Omit<UserLeaderboardEntry, "rank">[],
): UserLeaderboardEntry[] {
  const sorted = [...users].sort((a, b) => b.totalPoints - a.totalPoints);

  return sorted.map((user, index) => ({
    ...user,
    rank: index + 1,
  }));
}

/**
 * Awards points to a user for checking into an event.
 * Handles the exponential streak multiplier logic via the backend RPC.
 * 
 * @param userId - The ID of the user checking in
 * @param eventId - The ID of the event being checked into
 * @param basePoints - The base points awarded for this event
 * @returns Promise<CheckInResponse>
 */
export async function awardEventPoints(
  userId: string,
  eventId: string,
  basePoints: number
): Promise<CheckInResponse> {
  const { data, error } = await supabase.functions.invoke('award_points', {
    body: { userId, eventId, basePoints },
  });

  if (error) {
    console.error('Failed to award points:', error);
    throw new Error(error.message || 'Failed to process check-in rewards');
  }

  return data as CheckInResponse;
}

/**
 * Calculates the projected points for the next event in a series.
 * 
 * @param basePoints - The base points of the event
 * @param currentStreak - The user's current consecutive attendance count
 * @returns number - The projected final points
 */
export function calculateProjectedStreakPoints(basePoints: number, currentStreak: number): number {
  const nextStreak = currentStreak + 1;
  const multiplier = Math.pow(1.5, nextStreak);
  return Math.round(basePoints * multiplier);
}
