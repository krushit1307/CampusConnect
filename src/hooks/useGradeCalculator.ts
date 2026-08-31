import { useState, useCallback, useEffect, useMemo } from "react";

export type GradeType = "letter" | "percentage" | "gpa4";

export interface Course {
  id: string;
  name: string;
  credits: number;
  gradeType: GradeType;
  grade: string; // letter (A+, A, ..., F), percentage (0-100), or gpa (0.0-4.0)
  semester: string; // e.g. "Fall 2025"
  isDropped: boolean;
}

export interface Semester {
  name: string;
  courses: Course[];
  semesterGPA: number;
  totalCredits: number;
}

export interface GradeCalculatorStats {
  cumulativeGPA: number;
  totalCredits: number;
  totalCourseCount: number;
  semesters: Semester[];
  gradeDistribution: Record<string, number>;
  targetGPACreditsNeeded: number | null;
}

// Grade point maps
const LETTER_TO_GPA: Record<string, number> = {
  "A+": 4.0,
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  "D+": 1.3,
  D: 1.0,
  "D-": 0.7,
  F: 0.0,
};

const LETTER_GRADES = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
];

function gradeToGPA(grade: string, type: GradeType): number {
  switch (type) {
    case "letter":
      return LETTER_TO_GPA[grade] ?? 0;
    case "percentage": {
      const num = parseFloat(grade);
      if (isNaN(num) || num < 0) return 0;
      if (num >= 93) return 4.0;
      if (num >= 90) return 3.7;
      if (num >= 87) return 3.3;
      if (num >= 83) return 3.0;
      if (num >= 80) return 2.7;
      if (num >= 77) return 2.3;
      if (num >= 73) return 2.0;
      if (num >= 70) return 1.7;
      if (num >= 67) return 1.3;
      if (num >= 63) return 1.0;
      if (num >= 60) return 0.7;
      return 0;
    }
    case "gpa4": {
      const num = parseFloat(grade);
      return isNaN(num) ? 0 : Math.min(4.0, Math.max(0, num));
    }
    default:
      return 0;
  }
}

function gradeToLetter(grade: string, type: GradeType): string {
  switch (type) {
    case "letter":
      return grade;
    case "percentage": {
      const num = parseFloat(grade);
      if (isNaN(num) || num < 0) return "F";
      if (num >= 93) return "A+";
      if (num >= 90) return "A";
      if (num >= 87) return "A-";
      if (num >= 83) return "B+";
      if (num >= 80) return "B";
      if (num >= 77) return "B-";
      if (num >= 73) return "C+";
      if (num >= 70) return "C";
      if (num >= 67) return "C-";
      if (num >= 63) return "D+";
      if (num >= 60) return "D";
      return "F";
    }
    case "gpa4": {
      const num = parseFloat(grade);
      if (isNaN(num) || num < 0) return "F";
      if (num >= 3.85) return "A";
      if (num >= 3.5) return "A-";
      if (num >= 3.15) return "B+";
      if (num >= 2.85) return "B";
      if (num >= 2.5) return "B-";
      if (num >= 2.15) return "C+";
      if (num >= 1.85) return "C";
      if (num >= 1.5) return "C-";
      if (num >= 1.15) return "D+";
      if (num >= 0.85) return "D";
      return "F";
    }
    default:
      return "F";
  }
}

function computeSemesterGPA(courses: Course[]): {
  gpa: number;
  totalCredits: number;
  totalPoints: number;
} {
  const active = courses.filter((c) => !c.isDropped);
  if (active.length === 0) return { gpa: 0, totalCredits: 0, totalPoints: 0 };

  let totalPoints = 0;
  let totalCredits = 0;

  for (const course of active) {
    const gpaPoints = gradeToGPA(course.grade, course.gradeType);
    totalPoints += gpaPoints * course.credits;
    totalCredits += course.credits;
  }

  return {
    gpa: totalCredits > 0 ? totalPoints / totalCredits : 0,
    totalCredits,
    totalPoints,
  };
}

const STORAGE_KEY = "cc-grade-calculator";

function loadCourses(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCourses(courses: Course[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

export interface UseGradeCalculatorReturn {
  courses: Course[];
  stats: GradeCalculatorStats;
  addCourse: (name: string, credits: number, gradeType: GradeType, grade: string, semester: string) => void;
  removeCourse: (id: string) => void;
  updateCourse: (id: string, patch: Partial<Omit<Course, "id">>) => void;
  toggleDropped: (id: string) => void;
  clearAllData: () => void;
  calculateTargetGPA: (currentGPA: number, currentCredits: number, targetGPA: number) => number;
}

export function useGradeCalculator(): UseGradeCalculatorReturn {
  const [courses, setCourses] = useState<Course[]>(loadCourses);

  useEffect(() => {
    saveCourses(courses);
  }, [courses]);

  const stats = useMemo((): GradeCalculatorStats => {
    const active = courses.filter((c) => !c.isDropped);
    const semesters = new Map<string, Course[]>();

    for (const course of active) {
      const existing = semesters.get(course.semester) ?? [];
      existing.push(course);
      semesters.set(course.semester, existing);
    }

    const semesterList: Semester[] = [];
    let totalPoints = 0;
    let totalCredits = 0;

    for (const [name, semesterCourses] of semesters) {
      const { gpa, totalCredits: semCredits, totalPoints: semPoints } =
        computeSemesterGPA(semesterCourses);
      totalPoints += semPoints;
      totalCredits += semCredits;
      semesterList.push({
        name,
        courses: semesterCourses,
        semesterGPA: gpa,
        totalCredits: semCredits,
      });
    }

    const cumulativeGPA = totalCredits > 0 ? totalPoints / totalCredits : 0;

    // Grade distribution
    const gradeDist: Record<string, number> = {};
    for (const course of active) {
      const letter = gradeToLetter(course.grade, course.gradeType);
      gradeDist[letter] = (gradeDist[letter] ?? 0) + 1;
    }

    return {
      cumulativeGPA,
      totalCredits,
      totalCourseCount: active.length,
      semesters: semesterList,
      gradeDistribution: gradeDist,
      targetGPACreditsNeeded: null,
    };
  }, [courses]);

  const addCourse = useCallback(
    (
      name: string,
      credits: number,
      gradeType: GradeType,
      grade: string,
      semester: string,
    ) => {
      const newCourse: Course = {
        id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        credits,
        gradeType,
        grade,
        semester,
        isDropped: false,
      };
      setCourses((prev) => [...prev, newCourse]);
    },
    [],
  );

  const removeCourse = useCallback((id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const updateCourse = useCallback((id: string, patch: Partial<Omit<Course, "id">>) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  const toggleDropped = useCallback((id: string) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isDropped: !c.isDropped } : c)),
    );
  }, []);

  const clearAllData = useCallback(() => {
    setCourses([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const calculateTargetGPA = useCallback(
    (currentGPA: number, currentCredits: number, targetGPA: number): number => {
      const targetPoints = targetGPA * 100; // scale for precision
      const currentPoints = currentGPA * currentCredits;
      const needed = targetPoints - currentPoints;
      // Credits needed at 4.0 GPA to reach target
      if (needed <= 0) return 0;
      return Math.ceil(needed / 4.0);
    },
    [],
  );

  return {
    courses,
    stats,
    addCourse,
    removeCourse,
    updateCourse,
    toggleDropped,
    clearAllData,
    calculateTargetGPA,
  };
}

export { LETTER_GRADES, LETTER_TO_GPA, gradeToGPA, gradeToLetter };
