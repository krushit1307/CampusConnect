// @vitest-environment jsdom

import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  useGradeCalculator,
  gradeToGPA,
  gradeToLetter,
} from "./useGradeCalculator";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe("gradeToGPA", () => {
  it("converts letter grades correctly", () => {
    expect(gradeToGPA("A", "letter")).toBe(4.0);
    expect(gradeToGPA("A-", "letter")).toBe(3.7);
    expect(gradeToGPA("B+", "letter")).toBe(3.3);
    expect(gradeToGPA("B", "letter")).toBe(3.0);
    expect(gradeToGPA("C", "letter")).toBe(2.0);
    expect(gradeToGPA("F", "letter")).toBe(0);
  });

  it("converts percentage grades correctly", () => {
    expect(gradeToGPA("95", "percentage")).toBe(4.0);
    expect(gradeToGPA("91", "percentage")).toBe(3.7);
    expect(gradeToGPA("85", "percentage")).toBe(3.0);
    expect(gradeToGPA("75", "percentage")).toBe(2.0);
    expect(gradeToGPA("55", "percentage")).toBe(0);
  });

  it("converts numeric GPA grades correctly", () => {
    expect(gradeToGPA("4.0", "gpa4")).toBe(4.0);
    expect(gradeToGPA("3.5", "gpa4")).toBe(3.5);
    expect(gradeToGPA("2.8", "gpa4")).toBe(2.8);
    expect(gradeToGPA("0", "gpa4")).toBe(0);
  });

  it("returns 0 for invalid input", () => {
    expect(gradeToGPA("", "letter")).toBe(0);
    expect(gradeToGPA("abc", "percentage")).toBe(0);
  });
});

describe("gradeToLetter", () => {
  it("converts percentage to letter grade", () => {
    expect(gradeToLetter("95", "percentage")).toBe("A+");
    expect(gradeToLetter("90", "percentage")).toBe("A");
    expect(gradeToLetter("83", "percentage")).toBe("B+");
    expect(gradeToLetter("73", "percentage")).toBe("C+");
    expect(gradeToLetter("50", "percentage")).toBe("F");
  });

  it("returns letter as-is when type is letter", () => {
    expect(gradeToLetter("A", "letter")).toBe("A");
    expect(gradeToLetter("B-", "letter")).toBe("B-");
  });
});

describe("useGradeCalculator", () => {
  it("initialises with empty state", () => {
    const { result } = renderHook(() => useGradeCalculator());

    expect(result.current.courses).toHaveLength(0);
    expect(result.current.stats.cumulativeGPA).toBe(0);
    expect(result.current.stats.totalCredits).toBe(0);
    expect(result.current.stats.totalCourseCount).toBe(0);
  });

  it("adds a course and updates stats", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Calculus I", 4, "letter", "A", "Fall 2025");
    });

    expect(result.current.courses).toHaveLength(1);
    expect(result.current.stats.totalCourseCount).toBe(1);
    expect(result.current.stats.totalCredits).toBe(4);
    expect(result.current.stats.cumulativeGPA).toBe(4.0);
  });

  it("calculates cumulative GPA across multiple courses", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Calc I", 4, "letter", "A", "Fall 2025");
    });

    act(() => {
      result.current.addCourse("English", 3, "letter", "B", "Fall 2025");
    });

    // GPA = (4.0*4 + 3.0*3) / (4+3) = 25/7 ≈ 3.57
    expect(result.current.stats.cumulativeGPA).toBeCloseTo(3.57, 1);
    expect(result.current.stats.totalCredits).toBe(7);
    expect(result.current.stats.totalCourseCount).toBe(2);
  });

  it("persists data to localStorage", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Physics", 3, "letter", "A-", "Spring 2026");
    });

    const stored = JSON.parse(localStorage.getItem("cc-grade-calculator") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("Physics");
  });

  it("removes a course", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Physics", 3, "letter", "A", "Fall 2025");
    });

    const courseId = result.current.courses[0].id;

    act(() => {
      result.current.removeCourse(courseId);
    });

    expect(result.current.courses).toHaveLength(0);
    expect(result.current.stats.totalCredits).toBe(0);
  });

  it("updates a course", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Physics", 3, "letter", "B", "Fall 2025");
    });

    const courseId = result.current.courses[0].id;

    act(() => {
      result.current.updateCourse(courseId, { grade: "A" });
    });

    expect(result.current.courses[0].grade).toBe("A");
    expect(result.current.stats.cumulativeGPA).toBe(4.0);
  });

  it("toggles dropped status", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Physics", 3, "letter", "A", "Fall 2025");
    });

    const courseId = result.current.courses[0].id;

    act(() => {
      result.current.toggleDropped(courseId);
    });

    expect(result.current.courses[0].isDropped).toBe(true);
    expect(result.current.stats.totalCourseCount).toBe(0); // dropped excluded
    expect(result.current.stats.cumulativeGPA).toBe(0);

    act(() => {
      result.current.toggleDropped(courseId);
    });

    expect(result.current.courses[0].isDropped).toBe(false);
    expect(result.current.stats.totalCourseCount).toBe(1);
  });

  it("clears all data", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Physics", 3, "letter", "A", "Fall 2025");
    });

    act(() => {
      result.current.clearAllData();
    });

    expect(result.current.courses).toHaveLength(0);
    expect(result.current.stats.cumulativeGPA).toBe(0);
  });

  it("groups courses by semester", () => {
    const { result } = renderHook(() => useGradeCalculator());

    act(() => {
      result.current.addCourse("Calc I", 4, "letter", "A", "Fall 2025");
    });

    act(() => {
      result.current.addCourse("English", 3, "letter", "B", "Fall 2025");
    });

    act(() => {
      result.current.addCourse("Physics", 3, "letter", "A", "Spring 2026");
    });

    expect(result.current.stats.semesters).toHaveLength(2);
    expect(result.current.stats.semesters[0].name).toBe("Fall 2025");
    expect(result.current.stats.semesters[0].courses).toHaveLength(2);
    expect(result.current.stats.semesters[1].name).toBe("Spring 2026");
    expect(result.current.stats.semesters[1].courses).toHaveLength(1);
  });
});
