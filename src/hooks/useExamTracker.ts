import { useState, useMemo, useCallback } from "react";
import subDays from "date-fns/subDays";
import format from "date-fns/format";
import differenceInCalendarDays from "date-fns/differenceInCalendarDays";
import addDays from "date-fns/addDays";
import startOfWeek from "date-fns/startOfWeek";
import endOfWeek from "date-fns/endOfWeek";
import eachDayOfInterval from "date-fns/eachDayOfInterval";

export type ExamPriority = "midterm" | "final" | "quiz" | "practical";
export type AssignmentStatus = "pending" | "submitted" | "graded" | "late";
export type PriorityLevel = "critical" | "high" | "medium" | "low";

export interface Exam {
  id: string;
  courseCode: string;
  courseName: string;
  title: string;
  examType: ExamPriority;
  date: string; // ISO date
  startTime: string;
  endTime: string;
  location: string;
  weight: number; // percentage of final grade
  syllabusTopics: string[];
  studyHoursCompleted: number;
  studyHoursTarget: number;
  notes: string;
}

export interface Assignment {
  id: string;
  courseCode: string;
  courseName: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  status: AssignmentStatus;
  grade: number | null;
  maxGrade: number;
  weight: number;
  estimatedHours: number;
  hoursSpent: number;
  submissionUrl: string;
}

export interface CourseGrade {
  courseCode: string;
  courseName: string;
  currentGrade: number;
  targetGrade: number;
  assignments: { name: string; grade: number; maxGrade: number; weight: number }[];
  exams: { name: string; grade: number | null; weight: number }[];
}

export interface StudyPlanDay {
  date: string;
  coursesToStudy: string[];
  totalHours: number;
  examsPreparing: string[];
  assignmentsDue: string[];
}

export interface UseExamTrackerReturn {
  exams: Exam[];
  assignments: Assignment[];
  courseGrades: CourseGrade[];
  studyPlan: StudyPlanDay[];
  stats: {
    upcomingExams: number;
    pendingAssignments: number;
    overdueAssignments: number;
    averageGrade: number;
    totalStudyHours: number;
    daysUntilNextExam: number;
    nextExamTitle: string;
    completionRate: number;
  };
  addExam: (exam: Omit<Exam, "id">) => void;
  removeExam: (id: string) => void;
  updateExamStudy: (id: string, hours: number) => void;
  addAssignment: (assignment: Omit<Assignment, "id">) => void;
  removeAssignment: (id: string) => void;
  updateAssignmentStatus: (id: string, status: AssignmentStatus) => void;
  updateAssignmentGrade: (id: string, grade: number) => void;
  updateAssignmentHours: (id: string, hours: number) => void;
}

const MOCK_EXAMS: Exam[] = [
  {
    id: "exam-1",
    courseCode: "CS301",
    courseName: "Data Structures & Algorithms",
    title: "Midterm: Trees & Graphs",
    examType: "midterm",
    date: format(addDays(new Date(), 5), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "11:00",
    location: "Engineering Hall, Room 301",
    weight: 25,
    syllabusTopics: [
      "Binary Trees",
      "BST Operations",
      "Graph Traversal",
      "Dijkstra Algorithm",
      "Dynamic Programming Basics",
    ],
    studyHoursCompleted: 8,
    studyHoursTarget: 20,
    notes: "Focus on graph algorithms and tree rotations",
  },
  {
    id: "exam-2",
    courseCode: "MATH220",
    courseName: "Linear Algebra",
    title: "Quiz 3: Eigenvalues & SVD",
    examType: "quiz",
    date: format(addDays(new Date(), 2), "yyyy-MM-dd"),
    startTime: "14:00",
    endTime: "14:45",
    location: "Math Building, Lecture Hall B",
    weight: 10,
    syllabusTopics: [
      "Eigenvalue Computation",
      "Characteristic Polynomial",
      "SVD Decomposition",
      "Rank-Nullity Theorem",
    ],
    studyHoursCompleted: 3,
    studyHoursTarget: 8,
    notes: "Quick quiz - focus on computation speed",
  },
  {
    id: "exam-3",
    courseCode: "PHYS402",
    courseName: "Quantum Physics II",
    title: "Midterm: Wave Functions",
    examType: "midterm",
    date: format(addDays(new Date(), 12), "yyyy-MM-dd"),
    startTime: "10:00",
    endTime: "12:30",
    location: "Physics Lab, Room 105",
    weight: 30,
    syllabusTopics: [
      "Schrödinger Equation",
      "Wave Function Normalization",
      "Infinite Square Well",
      "Harmonic Oscillator",
      "Perturbation Theory",
    ],
    studyHoursCompleted: 2,
    studyHoursTarget: 25,
    notes: "Heavy math - practice normalization problems",
  },
  {
    id: "exam-4",
    courseCode: "CHEM210",
    courseName: "Organic Chemistry",
    title: "Practical: NMR Analysis",
    examType: "practical",
    date: format(addDays(new Date(), 8), "yyyy-MM-dd"),
    startTime: "13:00",
    endTime: "16:00",
    location: "Chemistry Annex, Lab 3",
    weight: 15,
    syllabusTopics: [
      "NMR Spectroscopy",
      "IR Spectroscopy",
      "Mass Spectrometry",
      "Structure Elucidation",
    ],
    studyHoursCompleted: 4,
    studyHoursTarget: 12,
    notes: "Practice interpreting spectra",
  },
  {
    id: "exam-5",
    courseCode: "CS301",
    courseName: "Data Structures & Algorithms",
    title: "Final: Comprehensive",
    examType: "final",
    date: format(addDays(new Date(), 45), "yyyy-MM-dd"),
    startTime: "08:00",
    endTime: "11:00",
    location: "Main Auditorium",
    weight: 35,
    syllabusTopics: [
      "All Chapters",
      "Advanced Graph Algorithms",
      "NP-Completeness",
      "Amortized Analysis",
    ],
    studyHoursCompleted: 0,
    studyHoursTarget: 40,
    notes: "Cumulative - start early",
  },
];

const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "asgn-1",
    courseCode: "CS301",
    courseName: "Data Structures & Algorithms",
    title: "Problem Set 5: Graph Algorithms",
    description: "Implement Dijkstra, Bellman-Ford, and A* on provided test graphs.",
    dueDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
    dueTime: "23:59",
    status: "pending",
    grade: null,
    maxGrade: 100,
    weight: 5,
    estimatedHours: 8,
    hoursSpent: 4.5,
    submissionUrl: "",
  },
  {
    id: "asgn-2",
    courseCode: "MATH220",
    courseName: "Linear Algebra",
    title: "Problem Set 7: SVD & Applications",
    description: "Compute SVD for 4x4 matrices and apply to image compression.",
    dueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
    dueTime: "17:00",
    status: "pending",
    grade: null,
    maxGrade: 50,
    weight: 3,
    estimatedHours: 5,
    hoursSpent: 3,
    submissionUrl: "",
  },
  {
    id: "asgn-3",
    courseCode: "PHYS402",
    courseName: "Quantum Physics II",
    title: "Lab Report: Double Slit Experiment",
    description: "Write analysis of interference patterns and probability density.",
    dueDate: format(addDays(new Date(), -2), "yyyy-MM-dd"),
    dueTime: "23:59",
    status: "late",
    grade: null,
    maxGrade: 100,
    weight: 5,
    estimatedHours: 6,
    hoursSpent: 2,
    submissionUrl: "",
  },
  {
    id: "asgn-4",
    courseCode: "CHEM210",
    courseName: "Organic Chemistry",
    title: "NMR Spectrum Analysis Worksheet",
    description: "Identify unknown compounds from provided NMR spectra.",
    dueDate: format(addDays(new Date(), 6), "yyyy-MM-dd"),
    dueTime: "12:00",
    status: "pending",
    grade: null,
    maxGrade: 30,
    weight: 4,
    estimatedHours: 3,
    hoursSpent: 0,
    submissionUrl: "",
  },
  {
    id: "asgn-5",
    courseCode: "CS301",
    courseName: "Data Structures & Algorithms",
    title: "Problem Set 4: BST & AVL Trees",
    description: "Implement AVL tree rotations and rebalancing.",
    dueDate: format(addDays(new Date(), -5), "yyyy-MM-dd"),
    dueTime: "23:59",
    status: "graded",
    grade: 92,
    maxGrade: 100,
    weight: 5,
    estimatedHours: 7,
    hoursSpent: 9,
    submissionUrl: "",
  },
  {
    id: "asgn-6",
    courseCode: "MATH220",
    courseName: "Linear Algebra",
    title: "Problem Set 6: Eigenvalues",
    description: "Find eigenvalues, eigenvectors, and diagonalize matrices.",
    dueDate: format(addDays(new Date(), -7), "yyyy-MM-dd"),
    dueTime: "17:00",
    status: "graded",
    grade: 46,
    maxGrade: 50,
    weight: 3,
    estimatedHours: 4,
    hoursSpent: 5.5,
    submissionUrl: "",
  },
  {
    id: "asgn-7",
    courseCode: "PHYS402",
    courseName: "Quantum Physics II",
    title: "Homework 3: Infinite Square Well",
    description: "Solve 1D and 2D infinite square well problems.",
    dueDate: format(addDays(new Date(), -10), "yyyy-MM-dd"),
    dueTime: "23:59",
    status: "graded",
    grade: 27,
    maxGrade: 30,
    weight: 4,
    estimatedHours: 5,
    hoursSpent: 6,
    submissionUrl: "",
  },
];

const MOCK_GRADES: CourseGrade[] = [
  {
    courseCode: "CS301",
    courseName: "Data Structures & Algorithms",
    currentGrade: 89.5,
    targetGrade: 90,
    assignments: [
      { name: "PS1: Arrays & Lists", grade: 95, maxGrade: 100, weight: 5 },
      { name: "PS2: Stacks & Queues", grade: 88, maxGrade: 100, weight: 5 },
      { name: "PS3: Hash Tables", grade: 91, maxGrade: 100, weight: 5 },
      { name: "PS4: BST & AVL", grade: 92, maxGrade: 100, weight: 5 },
    ],
    exams: [
      { name: "Quiz 1", grade: 18, weight: 5 },
      { name: "Midterm", grade: null, weight: 25 },
      { name: "Final", grade: null, weight: 35 },
    ],
  },
  {
    courseCode: "MATH220",
    courseName: "Linear Algebra",
    currentGrade: 93.2,
    targetGrade: 95,
    assignments: [
      { name: "PS5: Vector Spaces", grade: 48, maxGrade: 50, weight: 3 },
      { name: "PS6: Eigenvalues", grade: 46, maxGrade: 50, weight: 3 },
    ],
    exams: [
      { name: "Quiz 1", grade: 9, weight: 5 },
      { name: "Quiz 2", grade: 10, weight: 5 },
      { name: "Midterm", grade: 88, weight: 25 },
    ],
  },
  {
    courseCode: "PHYS402",
    courseName: "Quantum Physics II",
    currentGrade: 82.7,
    targetGrade: 85,
    assignments: [
      { name: "HW1: Wave-Particle Duality", grade: 25, maxGrade: 30, weight: 4 },
      { name: "HW2: Heisenberg Uncertainty", grade: 22, maxGrade: 30, weight: 4 },
      { name: "HW3: Infinite Square Well", grade: 27, maxGrade: 30, weight: 4 },
    ],
    exams: [
      { name: "Quiz 1", grade: 8, weight: 5 },
      { name: "Midterm", grade: null, weight: 30 },
    ],
  },
  {
    courseCode: "CHEM210",
    courseName: "Organic Chemistry",
    currentGrade: 91.0,
    targetGrade: 90,
    assignments: [
      { name: "Lab Report 1", grade: 28, maxGrade: 30, weight: 5 },
      { name: "Lab Report 2", grade: 27, maxGrade: 30, weight: 5 },
    ],
    exams: [
      { name: "Midterm", grade: 85, weight: 20 },
      { name: "Practical", grade: null, weight: 15 },
    ],
  },
];

export function useExamTracker(): UseExamTrackerReturn {
  const [exams, setExams] = useState<Exam[]>(MOCK_EXAMS);
  const [assignments, setAssignments] = useState<Assignment[]>(MOCK_ASSIGNMENTS);

  const addExam = useCallback((exam: Omit<Exam, "id">) => {
    setExams((prev) => [...prev, { ...exam, id: `exam-${Date.now()}` }]);
  }, []);

  const removeExam = useCallback((id: string) => {
    setExams((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateExamStudy = useCallback((id: string, hours: number) => {
    setExams((prev) => prev.map((e) => (e.id === id ? { ...e, studyHoursCompleted: hours } : e)));
  }, []);

  const addAssignment = useCallback((assignment: Omit<Assignment, "id">) => {
    setAssignments((prev) => [...prev, { ...assignment, id: `asgn-${Date.now()}` }]);
  }, []);

  const removeAssignment = useCallback((id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const updateAssignmentStatus = useCallback((id: string, status: AssignmentStatus) => {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  const updateAssignmentGrade = useCallback((id: string, grade: number) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, grade, status: "graded" as const } : a)),
    );
  }, []);

  const updateAssignmentHours = useCallback((id: string, hours: number) => {
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, hoursSpent: hours } : a)));
  }, []);

  const stats = useMemo(() => {
    const today = new Date();
    const upcoming = exams.filter((e) => differenceInCalendarDays(new Date(e.date), today) >= 0);
    const sortedExams = upcoming.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const nextExam = sortedExams[0];

    const pendingAsignments = assignments.filter(
      (a) => a.status === "pending" || a.status === "late",
    );
    const overdueCount = assignments.filter(
      (a) => a.status === "pending" && differenceInCalendarDays(new Date(a.dueDate), today) < 0,
    ).length;

    const gradedAssignments = assignments.filter((a) => a.status === "graded" && a.grade !== null);
    const avgGrade =
      gradedAssignments.length > 0
        ? gradedAssignments.reduce((s, a) => s + ((a.grade || 0) / a.maxGrade) * 100, 0) /
          gradedAssignments.length
        : 0;

    const totalStudy = exams.reduce((s, e) => s + e.studyHoursCompleted, 0);

    const completedAssignments = assignments.filter((a) => a.status === "graded").length;
    const completionRate =
      assignments.length > 0 ? Math.round((completedAssignments / assignments.length) * 100) : 0;

    return {
      upcomingExams: upcoming.length,
      pendingAssignments: pendingAsignments.length,
      overdueAssignments: overdueCount,
      averageGrade: Math.round(avgGrade * 10) / 10,
      totalStudyHours: totalStudy,
      daysUntilNextExam: nextExam ? differenceInCalendarDays(new Date(nextExam.date), today) : 999,
      nextExamTitle: nextExam?.title || "No upcoming exams",
      completionRate,
    };
  }, [exams, assignments]);

  const courseGrades = useMemo(() => MOCK_GRADES, []);

  const studyPlan = useMemo(() => {
    const today = new Date();
    const plan: StudyPlanDay[] = [];
    const upcomingExams = exams.filter(
      (e) =>
        differenceInCalendarDays(new Date(e.date), today) >= 0 &&
        differenceInCalendarDays(new Date(e.date), today) <= 14,
    );

    for (let i = 0; i < 14; i++) {
      const day = addDays(today, i);
      const dateStr = format(day, "yyyy-MM-dd");
      const examsThatDay = upcomingExams.filter((e) => e.date === dateStr);
      const dueAssignments = assignments.filter(
        (a) => a.dueDate === dateStr && (a.status === "pending" || a.status === "late"),
      );

      const coursesToStudy = [
        ...new Set([
          ...examsThatDay.map((e) => e.courseCode),
          ...dueAssignments.map((a) => a.courseCode),
        ]),
      ];

      // Distribute study hours based on exam urgency
      let totalHours = 0;
      upcomingExams.forEach((e) => {
        const daysUntil = differenceInCalendarDays(new Date(e.date), day);
        if (daysUntil >= 0 && daysUntil <= 7) {
          const urgency = Math.max(0.5, 3 - daysUntil * 0.3);
          totalHours += urgency;
        }
      });
      dueAssignments.forEach((a) => {
        const daysUntil = differenceInCalendarDays(new Date(a.dueDate), day);
        if (daysUntil >= 0 && daysUntil <= 3) {
          totalHours += 1.5;
        }
      });

      plan.push({
        date: dateStr,
        coursesToStudy,
        totalHours: Math.round(totalHours * 10) / 10,
        examsPreparing: examsThatDay.map((e) => e.title),
        assignmentsDue: dueAssignments.map((a) => a.title),
      });
    }
    return plan;
  }, [exams, assignments]);

  return {
    exams,
    assignments,
    courseGrades,
    studyPlan,
    stats,
    addExam,
    removeExam,
    updateExamStudy,
    addAssignment,
    removeAssignment,
    updateAssignmentStatus,
    updateAssignmentGrade,
    updateAssignmentHours,
  };
}
