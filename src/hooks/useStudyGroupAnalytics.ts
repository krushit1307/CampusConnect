import differenceInCalendarWeeks from "date-fns/differenceInCalendarWeeks";
import subDays from "date-fns/subDays";
import format from "date-fns/format";
import startOfWeek from "date-fns/startOfWeek";
import addDays from "date-fns/addDays";
import getDay from "date-fns/getDay";
import { useState, useMemo } from "react";

export interface StudyActivity {
  date: string; // YYYY-MM-DD
  hoursStudied: number;
  sessionsAttended: number;
  groupIds: string[];
}

export interface StudyStreakData {
  currentStreak: number;
  longestStreak: number;
  totalStudyDays: number;
  totalHoursThisMonth: number;
  weeklyGoalHours: number;
  weeklyHoursCompleted: number;
  monthlyHoursTarget: number;
  monthlyHoursCompleted: number;
}

export interface StudyGroupRanking {
  groupId: string;
  groupName: string;
  courseCode: string;
  avgAttendance: number;
  totalSessions: number;
  avgHoursPerSession: number;
  memberRetentionRate: number;
  weeklyActiveHours: number;
  rank: number;
}

export interface StudyHourEntry {
  week: string;
  hours: number;
  sessions: number;
  target: number;
}

export interface UseStudyGroupAnalyticsReturn {
  activity: StudyActivity[];
  streakData: StudyStreakData;
  rankings: StudyGroupRanking[];
  weeklyHours: StudyHourEntry[];
  courseDistribution: Record<string, number>;
  isLoading: boolean;
}

/**
 * Generates deterministic mock study activity data for the last 365 days.
 * Uses a seeded pseudo-random approach based on the date so data is stable
 * across re-renders while still looking realistic.
 */
function generateActivityData(days: number = 365): StudyActivity[] {
  const activities: StudyActivity[] = [];
  const today = new Date();
  const groupIds = ["grp-401", "grp-402", "grp-403", "grp-404"];

  for (let i = days; i >= 0; i--) {
    const date = subDays(today, i);
    const dayOfWeek = getDay(date);
    const dayOfWeek0 = dayOfWeek === 0 ? 7 : dayOfWeek;
    const seed = (date.getFullYear() * 1000 + date.getMonth() * 31 + date.getDate()) % 100;

    // More activity on weekdays, especially mid-week
    const weekdayBoost = dayOfWeek0 <= 5 ? 1.5 : 0.4;
    const midweekBoost = dayOfWeek0 >= 2 && dayOfWeek0 <= 4 ? 1.3 : 1;
    const probability = 0.55 * weekdayBoost * midweekBoost;
    const hasStudySession = seed / 100 < probability;

    if (hasStudySession) {
      const hoursBase = 0.5 + (((seed * 7 + i * 3) % 10) / 10) * 3.5;
      const sessionsAttended = 1 + (seed % 3);
      const activeGroups = groupIds.filter((_, idx) => (seed >> idx) & 1);
      if (activeGroups.length === 0) activeGroups.push(groupIds[0]);

      activities.push({
        date: format(date, "yyyy-MM-dd"),
        hoursStudied: Math.round(hoursBase * 10) / 10,
        sessionsAttended,
        groupIds: activeGroups,
      });
    }
  }
  return activities;
}

function computeStreak(activity: StudyActivity[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (activity.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const dateSet = new Set(activity.map((a) => a.date));
  const today = new Date();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Calculate longest streak by scanning sorted activity dates
  const sortedDates = Array.from(dateSet).sort();
  let prevDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const currentDate = new Date(dateStr);
    if (prevDate !== null) {
      const diffMs = currentDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevDate = currentDate;
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Current streak: count consecutive study days backwards from today
  let checkDate = today;
  while (true) {
    if (dateSet.has(format(checkDate, "yyyy-MM-dd"))) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak };
}

export function useStudyGroupAnalytics(): UseStudyGroupAnalyticsReturn {
  const [isLoading] = useState(false);

  const activity = useMemo(() => generateActivityData(365), []);

  const streakData = useMemo<StudyStreakData>(() => {
    const { currentStreak, longestStreak } = computeStreak(activity);
    const today = new Date();
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthActivities = activity.filter((a) => new Date(a.date) >= thisMonthStart);
    const totalHoursThisMonth = thisMonthActivities.reduce((sum, a) => sum + a.hoursStudied, 0);
    const startOfWeekDate = startOfWeek(today, { weekStartsOn: 1 });
    const thisWeekActivities = activity.filter((a) => new Date(a.date) >= startOfWeekDate);
    const weeklyHoursCompleted = thisWeekActivities.reduce((sum, a) => sum + a.hoursStudied, 0);

    return {
      currentStreak,
      longestStreak,
      totalStudyDays: activity.length,
      totalHoursThisMonth: Math.round(totalHoursThisMonth * 10) / 10,
      weeklyGoalHours: 15,
      weeklyHoursCompleted: Math.round(weeklyHoursCompleted * 10) / 10,
      monthlyHoursTarget: 60,
      monthlyHoursCompleted: Math.round(totalHoursThisMonth * 10) / 10,
    };
  }, [activity]);

  const weeklyHours = useMemo<StudyHourEntry[]>(() => {
    const weeks: StudyHourEntry[] = [];
    const today = new Date();
    const start = startOfWeek(subDays(today, 364), { weekStartsOn: 1 });

    for (let w = 0; w < 52; w++) {
      const weekStart = addDays(start, w * 7);
      const weekEnd = addDays(weekStart, 6);
      const weekActivities = activity.filter((a) => {
        const d = new Date(a.date);
        return d >= weekStart && d <= weekEnd;
      });
      const hours = weekActivities.reduce((sum, a) => sum + a.hoursStudied, 0);
      const sessions = weekActivities.reduce((sum, a) => sum + a.sessionsAttended, 0);
      // Progressive target: increases slightly over time
      const target = 12 + Math.floor(w / 4);
      weeks.push({
        week: format(weekStart, "MMM dd"),
        hours: Math.round(hours * 10) / 10,
        sessions,
        target,
      });
    }
    return weeks;
  }, [activity]);

  const rankings = useMemo<StudyGroupRanking[]>(() => {
    const groups = [
      { id: "grp-401", name: "Graph Theory & DP Sprint", course: "CS301" },
      { id: "grp-402", name: "Schrödinger Equation Circle", course: "PHYS402" },
      { id: "grp-403", name: "Eigenvalues Study Lab", course: "MATH220" },
      {
        id: "grp-404",
        name: "NMR Spectroscopy Group",
        course: "CHEM210",
      },
      { id: "grp-405", name: "Algorithms Deep Dive", course: "CS401" },
      { id: "grp-406", name: "Thermodynamics Review", course: "PHYS301" },
    ];

    return groups
      .map((g, idx) => ({
        groupId: g.id,
        groupName: g.name,
        courseCode: g.course,
        avgAttendance: 65 + ((idx * 17 + 11) % 30),
        totalSessions: 12 + ((idx * 13 + 7) % 25),
        avgHoursPerSession: 1.5 + ((idx * 3 + 5) % 10) / 5,
        memberRetentionRate: 70 + ((idx * 23 + 19) % 28),
        weeklyActiveHours: 3 + ((idx * 11 + 3) % 12),
        rank: 0,
      }))
      .sort((a, b) => {
        const scoreA =
          a.avgAttendance * 0.3 + a.memberRetentionRate * 0.4 + a.weeklyActiveHours * 0.3;
        const scoreB =
          b.avgAttendance * 0.3 + b.memberRetentionRate * 0.4 + b.weeklyActiveHours * 0.3;
        return scoreB - scoreA;
      })
      .map((g, idx) => ({ ...g, rank: idx + 1 }));
  }, []);

  const courseDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    const courseMap: Record<string, string> = {
      "grp-401": "CS301",
      "grp-402": "PHYS402",
      "grp-403": "MATH220",
      "grp-404": "CHEM210",
    };
    activity.forEach((a) => {
      a.groupIds.forEach((gid) => {
        const course = courseMap[gid] || "Other";
        dist[course] = (dist[course] || 0) + a.hoursStudied;
      });
    });
    return dist;
  }, [activity]);

  return {
    activity,
    streakData,
    rankings,
    weeklyHours,
    courseDistribution,
    isLoading,
  };
}
