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
