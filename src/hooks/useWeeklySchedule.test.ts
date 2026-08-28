// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { useWeeklySchedule, type ScheduleEntry } from "./useWeeklySchedule";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

function makeEntry(overrides: Partial<ScheduleEntry> = {}): Omit<ScheduleEntry, "id"> {
  return {
    courseName: "Test Course",
    courseCode: "TEST101",
    instructor: "Prof. Test",
    location: "Room 101",
    day: "Mon",
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 30,
    color: "bg-blue-500",
    type: "lecture",
    ...overrides,
  };
}

describe("useWeeklySchedule", () => {
  it("initialises with empty state", () => {
    const { result } = renderHook(() => useWeeklySchedule());
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.stats.totalEntries).toBe(0);
    expect(result.current.stats.totalHoursPerWeek).toBe(0);
    expect(result.current.stats.conflicts).toHaveLength(0);
  });

  it("adds a schedule entry", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry());
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].courseName).toBe("Test Course");
    expect(result.current.stats.totalEntries).toBe(1);
    expect(result.current.stats.totalHoursPerWeek).toBe(1.5);
  });

  it("removes a schedule entry", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry());
    });

    const id = result.current.entries[0].id;

    act(() => {
      result.current.removeEntry(id);
    });

    expect(result.current.entries).toHaveLength(0);
    expect(result.current.stats.totalHoursPerWeek).toBe(0);
  });

  it("groups entries by day correctly", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry({ day: "Mon", courseName: "Monday Class" }));
    });

    act(() => {
      result.current.addEntry(makeEntry({ day: "Wed", courseName: "Wednesday Class" }));
    });

    expect(result.current.getEntriesForDay("Mon")).toHaveLength(1);
    expect(result.current.getEntriesForDay("Wed")).toHaveLength(1);
    expect(result.current.getEntriesForDay("Tue")).toHaveLength(0);
  });

  it("detects time conflicts", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry({
        day: "Mon",
        startHour: 9,
        startMinute: 0,
        endHour: 10,
        endMinute: 30,
        courseName: "Class A",
      }));
    });

    act(() => {
      result.current.addEntry(makeEntry({
        day: "Mon",
        startHour: 10,
        startMinute: 0,
        endHour: 11,
        endMinute: 0,
        courseName: "Class B",
      }));
    });

    // 30 min overlap (10:00 - 10:30)
    expect(result.current.stats.conflicts).toHaveLength(1);
    expect(result.current.stats.conflicts[0].overlapMinutes).toBe(30);
  });

  it("no conflict on different days", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry({
        day: "Mon",
        startHour: 9,
        startMinute: 0,
        endHour: 11,
        endMinute: 0,
      }));
    });

    act(() => {
      result.current.addEntry(makeEntry({
        day: "Tue",
        startHour: 9,
        startMinute: 0,
        endHour: 11,
        endMinute: 0,
      }));
    });

    expect(result.current.stats.conflicts).toHaveLength(0);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry({ courseName: "Saved Class" }));
    });

    const stored = JSON.parse(localStorage.getItem("cc-weekly-schedule") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].courseName).toBe("Saved Class");
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry());
    });

    act(() => {
      result.current.clearAllData();
    });

    expect(result.current.entries).toHaveLength(0);
    expect(result.current.stats.totalEntries).toBe(0);
  });

  it("counts unique courses", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    act(() => {
      result.current.addEntry(makeEntry({ courseCode: "CS101", courseName: "CS" }));
    });

    act(() => {
      result.current.addEntry(makeEntry({ courseCode: "CS101", courseName: "CS", day: "Wed" }));
    });

    act(() => {
      result.current.addEntry(makeEntry({ courseCode: "MATH201", courseName: "Math" }));
    });

    expect(result.current.stats.coursesCount).toBe(2);
    expect(result.current.stats.totalEntries).toBe(3);
  });

  it("nextColor cycles through colors", () => {
    const { result } = renderHook(() => useWeeklySchedule());

    const c1 = result.current.nextColor();
    const c2 = result.current.nextColor();
    const c3 = result.current.nextColor();

    expect(c1).toBe("bg-blue-500");
    expect(c2).toBe("bg-emerald-500");
    expect(c3).toBe("bg-violet-500");
  });
});
