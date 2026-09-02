// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAssignments, daysUntil, formatCountdown, getStatus } from "./useAssignments";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  // Set to 2025-10-15 12:00:00
  vi.setSystemTime(new Date("2025-10-15T12:00:00"));
});

function futureDate(days: number): string {
  const d = new Date("2025-10-15T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

describe("daysUntil", () => {
  it("returns 0 for today", () => {
    expect(daysUntil(futureDate(0))).toBe(0);
  });

  it("returns positive for future", () => {
    expect(daysUntil(futureDate(5))).toBe(5);
  });

  it("returns negative for past", () => {
    expect(daysUntil(futureDate(-3))).toBe(-3);
  });
});

describe("useAssignments", () => {
  it("initialises with empty state", () => {
    const { result } = renderHook(() => useAssignments());
    expect(result.current.assignments).toHaveLength(0);
    expect(result.current.stats.total).toBe(0);
    expect(result.current.stats.pending).toBe(0);
    expect(result.current.stats.completed).toBe(0);
  });

  it("adds an assignment", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "Problem Set 5",
        courseName: "CS 101",
        courseCode: "CS101",
        description: "Binary trees",
        dueDate: futureDate(3),
        priority: "high",
        category: "homework",
        estimatedMinutes: 90,
      });
    });

    expect(result.current.assignments).toHaveLength(1);
    expect(result.current.assignments[0].title).toBe("Problem Set 5");
    expect(result.current.assignments[0].status).toBe("pending");
    expect(result.current.stats.pending).toBe(1);
  });

  it("marks assignment as overdue when due date is past", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "Late HW",
        courseName: "Math",
        courseCode: "MATH101",
        description: "",
        dueDate: futureDate(-2),
        priority: "medium",
        category: "homework",
        estimatedMinutes: 60,
      });
    });

    expect(result.current.assignments[0].status).toBe("overdue");
    expect(result.current.stats.overdue).toBe(1);
  });

  it("toggles complete status", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "Essay",
        courseName: "English",
        courseCode: "ENG101",
        description: "",
        dueDate: futureDate(5),
        priority: "low",
        category: "essay",
        estimatedMinutes: 120,
      });
    });

    const id = result.current.assignments[0].id;

    act(() => {
      result.current.toggleComplete(id);
    });

    expect(result.current.assignments[0].status).toBe("completed");
    expect(result.current.assignments[0].completedAt).not.toBeNull();
    expect(result.current.stats.completed).toBe(1);

    // Toggle back
    act(() => {
      result.current.toggleComplete(id);
    });

    expect(result.current.assignments[0].status).toBe("pending");
    expect(result.current.stats.completed).toBe(0);
  });

  it("removes an assignment", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "Test",
        courseName: "CS",
        courseCode: "CS101",
        description: "",
        dueDate: futureDate(1),
        priority: "medium",
        category: "other",
        estimatedMinutes: 30,
      });
    });

    const id = result.current.assignments[0].id;

    act(() => {
      result.current.removeAssignment(id);
    });

    expect(result.current.assignments).toHaveLength(0);
  });

  it("filters by category", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "HW",
        courseName: "CS",
        courseCode: "CS101",
        description: "",
        dueDate: futureDate(1),
        priority: "medium",
        category: "homework",
        estimatedMinutes: 30,
      });
    });

    act(() => {
      result.current.addAssignment({
        title: "Exam",
        courseName: "Math",
        courseCode: "MATH101",
        description: "",
        dueDate: futureDate(2),
        priority: "high",
        category: "exam",
        estimatedMinutes: 60,
      });
    });

    act(() => {
      result.current.setActiveFilter("homework");
    });

    expect(result.current.filteredAssignments).toHaveLength(1);
    expect(result.current.filteredAssignments[0].title).toBe("HW");
  });

  it("searches assignments", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "Problem Set 5",
        courseName: "CS 101",
        courseCode: "CS101",
        description: "Binary trees",
        dueDate: futureDate(1),
        priority: "medium",
        category: "homework",
        estimatedMinutes: 60,
      });
    });

    act(() => {
      result.current.addAssignment({
        title: "Lab Report",
        courseName: "Physics",
        courseCode: "PHY201",
        description: "Optics experiment",
        dueDate: futureDate(2),
        priority: "medium",
        category: "lab",
        estimatedMinutes: 45,
      });
    });

    act(() => {
      result.current.setSearchTerm("Problem");
    });

    expect(result.current.filteredAssignments).toHaveLength(1);
    expect(result.current.filteredAssignments[0].title).toBe("Problem Set 5");
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "Saved HW",
        courseName: "CS",
        courseCode: "CS101",
        description: "",
        dueDate: futureDate(3),
        priority: "medium",
        category: "homework",
        estimatedMinutes: 45,
      });
    });

    const stored = JSON.parse(localStorage.getItem("cc-assignments") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("Saved HW");
  });

  it("computes stats correctly", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "HW 1",
        courseName: "CS",
        courseCode: "CS101",
        description: "",
        dueDate: futureDate(0), // due today
        priority: "medium",
        category: "homework",
        estimatedMinutes: 60,
      });
    });

    act(() => {
      result.current.addAssignment({
        title: "HW 2",
        courseName: "CS",
        courseCode: "CS101",
        description: "",
        dueDate: futureDate(3), // due in 3 days
        priority: "high",
        category: "homework",
        estimatedMinutes: 90,
      });
    });

    expect(result.current.stats.total).toBe(2);
    expect(result.current.stats.dueToday).toBe(1);
    expect(result.current.stats.dueThisWeek).toBe(2);
    expect(result.current.stats.totalEstimatedMinutes).toBe(150);
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useAssignments());

    act(() => {
      result.current.addAssignment({
        title: "Test",
        courseName: "CS",
        courseCode: "CS101",
        description: "",
        dueDate: futureDate(1),
        priority: "medium",
        category: "other",
        estimatedMinutes: 30,
      });
    });

    act(() => {
      result.current.clearAllData();
    });

    expect(result.current.assignments).toHaveLength(0);
  });
});
