import { useState, useCallback, useEffect, useMemo } from "react";

export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export interface ScheduleEntry {
  id: string;
  courseName: string;
  courseCode: string;
  instructor: string;
  location: string;
  day: DayOfWeek;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  color: string;
  type: "lecture" | "lab" | "tutorial" | "seminar" | "office-hours";
}

export interface TimeConflict {
  entryA: ScheduleEntry;
  entryB: ScheduleEntry;
  overlapMinutes: number;
}

export interface ScheduleStats {
  totalEntries: number;
  totalHoursPerWeek: number;
  coursesCount: number;
  busiestDay: DayOfWeek;
  busiestDayHours: number;
  freeDays: DayOfWeek[];
  conflicts: TimeConflict[];
}

const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SLOT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
];

const ENTRY_TYPE_LABELS: Record<ScheduleEntry["type"], { label: string; icon: string }> = {
  lecture: { label: "Lecture", icon: "\u{1F4D6}" },
  lab: { label: "Lab", icon: "\u{1F52C}" },
  tutorial: { label: "Tutorial", icon: "\u{1F4DD}" },
  seminar: { label: "Seminar", icon: "\u{1F5E3}\uFE0F" },
  "office-hours": { label: "Office Hours", icon: "\u{1F3E2}" },
};

const STORAGE_KEY = "cc-weekly-schedule";

function loadEntries(): ScheduleEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: ScheduleEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function timeToMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function durationMinutes(entry: ScheduleEntry): number {
  const start = timeToMinutes(entry.startHour, entry.startMinute);
  const end = timeToMinutes(entry.endHour, entry.endMinute);
  return Math.max(0, end - start);
}

function detectConflicts(entries: ScheduleEntry[]): TimeConflict[] {
  const conflicts: TimeConflict[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a.day !== b.day) continue;
      const aStart = timeToMinutes(a.startHour, a.startMinute);
      const aEnd = timeToMinutes(a.endHour, a.endMinute);
      const bStart = timeToMinutes(b.startHour, b.startMinute);
      const bEnd = timeToMinutes(b.endHour, b.endMinute);
      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);
      if (overlapStart < overlapEnd) {
        conflicts.push({
          entryA: a,
          entryB: b,
          overlapMinutes: overlapEnd - overlapStart,
        });
      }
    }
  }
  return conflicts;
}

export interface UseWeeklyScheduleReturn {
  entries: ScheduleEntry[];
  stats: ScheduleStats;
  addEntry: (data: Omit<ScheduleEntry, "id">) => void;
  removeEntry: (id: string) => void;
  updateEntry: (id: string, patch: Partial<Omit<ScheduleEntry, "id">>) => void;
  clearAllData: () => void;
  getEntriesForDay: (day: DayOfWeek) => ScheduleEntry[];
  nextColor: () => string;
  allDays: DayOfWeek[];
  slotColors: string[];
  entryTypes: typeof ENTRY_TYPE_LABELS;
  minutesToTime: typeof minutesToTimeStr;
}

export function useWeeklySchedule(): UseWeeklyScheduleReturn {
  const [entries, setEntries] = useState<ScheduleEntry[]>(loadEntries);
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    saveEntries(entries);
  }, [entries]);

  const stats = useMemo((): ScheduleStats => {
    const conflicts = detectConflicts(entries);
    const totalMinutes = entries.reduce((sum, e) => sum + durationMinutes(e), 0);
    const uniqueCourses = new Set(entries.map((e) => e.courseCode)).size;

    const dayMinutes: Record<DayOfWeek, number> = {
      Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0,
    };
    entries.forEach((e) => {
      dayMinutes[e.day] += durationMinutes(e);
    });

    let busiestDay: DayOfWeek = "Mon";
    let busiestMin = 0;
    for (const day of DAYS) {
      if (dayMinutes[day] > busiestMin) {
        busiestMin = dayMinutes[day];
        busiestDay = day;
      }
    }

    const freeDays = DAYS.filter((d) => dayMinutes[d] === 0);

    return {
      totalEntries: entries.length,
      totalHoursPerWeek: totalMinutes / 60,
      coursesCount: uniqueCourses,
      busiestDay,
      busiestDayHours: busiestMin / 60,
      freeDays,
      conflicts,
    };
  }, [entries]);

  const getEntriesForDay = useCallback(
    (day: DayOfWeek) =>
      entries
        .filter((e) => e.day === day)
        .sort((a, b) => timeToMinutes(a.startHour, a.startMinute) - timeToMinutes(b.startHour, b.startMinute)),
    [entries],
  );

  const addEntry = useCallback((data: Omit<ScheduleEntry, "id">) => {
    const newEntry: ScheduleEntry = {
      ...data,
      id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setEntries((prev) => [...prev, newEntry]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<Omit<ScheduleEntry, "id">>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const clearAllData = useCallback(() => {
    setEntries([]);
    setColorIndex(0);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const nextColor = useCallback(() => {
    const color = SLOT_COLORS[colorIndex % SLOT_COLORS.length];
    setColorIndex((prev) => prev + 1);
    return color;
  }, [colorIndex]);

  return {
    entries,
    stats,
    addEntry,
    removeEntry,
    updateEntry,
    clearAllData,
    getEntriesForDay,
    nextColor,
    allDays: DAYS,
    slotColors: SLOT_COLORS,
    entryTypes: ENTRY_TYPE_LABELS,
    minutesToTime: minutesToTimeStr,
  };
}

export { DAYS, SLOT_COLORS, ENTRY_TYPE_LABELS };
