import { useState, useCallback, useEffect, useMemo } from "react";

export interface StudyDay {
  date: string; // YYYY-MM-DD
  minutes: number;
  sessions: number;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  totalDaysStudied: number;
  totalMinutes: number;
  totalSessions: number;
  averageMinutesPerDay: number;
}

const STORAGE_KEY = "cc-study-streak";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function loadDays(): Record<string, StudyDay> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDays(days: Record<string, StudyDay>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}

function computeStats(days: Record<string, StudyDay>): StreakStats {
  const entries = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalDaysStudied: 0,
      totalMinutes: 0,
      totalSessions: 0,
      averageMinutesPerDay: 0,
    };
  }

  const totalMinutes = entries.reduce((sum, d) => sum + d.minutes, 0);
  const totalSessions = entries.reduce((sum, d) => sum + d.sessions, 0);

  // Compute streaks
  let longestStreak = 1;
  let currentStreak = 1;
  const today = todayStr();
  const yesterday = daysAgoStr(1);

  // Check if today or yesterday has entries (streak is still alive)
  const lastDate = entries[entries.length - 1].date;
  const gapToToday = daysBetween(lastDate, today);

  if (gapToToday > 1) {
    // Streak is broken
    currentStreak = 0;
  }

  // Calculate longest streak
  let runLength = 1;
  for (let i = 1; i < entries.length; i++) {
    const gap = daysBetween(entries[i - 1].date, entries[i].date);
    if (gap === 1) {
      runLength++;
    } else {
      longestStreak = Math.max(longestStreak, runLength);
      runLength = 1;
    }
  }
  longestStreak = Math.max(longestStreak, runLength);

  // Calculate current streak (counting backwards from last entry)
  if (currentStreak > 0) {
    currentStreak = 1;
    for (let i = entries.length - 1; i > 0; i--) {
      const gap = daysBetween(entries[i - 1].date, entries[i].date);
      if (gap === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalDaysStudied: entries.length,
    totalMinutes,
    totalSessions,
    averageMinutesPerDay: Math.round(totalMinutes / entries.length),
  };
}

export interface UseStudyStreakReturn {
  days: Record<string, StudyDay>;
  stats: StreakStats;
  heatmapData: { date: string; level: 0 | 1 | 2 | 3 | 4; minutes: number }[];
  logStudySession: (minutes: number) => void;
  getDayMinutes: (dateStr: string) => number;
  clearAllData: () => void;
}

export function useStudyStreak(): UseStudyStreakReturn {
  const [days, setDays] = useState<Record<string, StudyDay>>(loadDays);

  useEffect(() => {
    saveDays(days);
  }, [days]);

  const stats = useMemo(() => computeStats(days), [days]);

  const heatmapData = useMemo(() => {
    const result: {
      date: string;
      level: 0 | 1 | 2 | 3 | 4;
      minutes: number;
    }[] = [];

    // Last 180 days (roughly 6 months of GitHub-style heatmap)
    for (let i = 179; i >= 0; i--) {
      const dateStr = daysAgoStr(i);
      const entry = days[dateStr];
      const minutes = entry?.minutes ?? 0;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (minutes > 0 && minutes <= 30) level = 1;
      else if (minutes > 30 && minutes <= 60) level = 2;
      else if (minutes > 60 && minutes <= 120) level = 3;
      else if (minutes > 120) level = 4;

      result.push({ date: dateStr, level, minutes });
    }

    return result;
  }, [days]);

  const logStudySession = useCallback((minutes: number) => {
    const today = todayStr();
    setDays((prev) => {
      const existing = prev[today];
      return {
        ...prev,
        [today]: {
          date: today,
          minutes: (existing?.minutes ?? 0) + minutes,
          sessions: (existing?.sessions ?? 0) + 1,
        },
      };
    });
  }, []);

  const getDayMinutes = useCallback(
    (dateStr: string) => days[dateStr]?.minutes ?? 0,
    [days],
  );

  const clearAllData = useCallback(() => {
    setDays({});
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { days, stats, heatmapData, logStudySession, getDayMinutes, clearAllData };
}
