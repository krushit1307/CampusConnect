// ─── Course Review & Rating System Types ──────────────────────────────────

export type CourseLevel = "introductory" | "intermediate" | "advanced" | "graduate";
export type Semester = "fall" | "spring" | "summer" | "winter";
export type DifficultyRating = 1 | 2 | 3 | 4 | 5;
export type QualityRating = 1 | 2 | 3 | 4 | 5;
export type ReviewSortBy = "newest" | "highest-rated" | "lowest-rated" | "most-helpful";

export interface Department {
  id: string;
  name: string;
  code: string;
  school: string;
  courseCount: number;
  averageGpa: number;
  icon: string;
}

export interface Professor {
  id: string;
  name: string;
  department: string;
  title: string;
  email: string;
  office: string;
  officeHours: string;
  rating: number;
  difficulty: number;
  wouldTakeAgain: number;
  reviewsCount: number;
  coursesTaught: string[];
  tags: string[];
  avatar?: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  department: string;
  level: CourseLevel;
  credits: number;
  description: string;
  prerequisites: string[];
  corequisites: string[];
  professors: Professor[];
  rating: number;
  difficulty: number;
  wouldRecommend: number;
  reviewsCount: number;
  enrolledCount: number;
  gradeDistribution: GradeDistribution;
  tags: string[];
  prerequisitesMet?: boolean;
}

export interface GradeDistribution {
  "A+": number;
  A: number;
  "A-": number;
  "B+": number;
  B: number;
  "B-": number;
  "C+": number;
  C: number;
  "C-": number;
  D: number;
  F: number;
  W: number;
}

export interface CourseReview {
  id: string;
  courseId: string;
  professorId: string;
  professorName: string;
  authorName: string;
  authorYear: string;
  semester: Semester;
  year: number;
  quality: QualityRating;
  difficulty: DifficultyRating;
  grade: string;
  wouldRecommend: boolean;
  wouldTakeAgain: boolean;
  title: string;
  comment: string;
  pros: string[];
  cons: string[];
  tags: string[];
  helpfulCount: number;
  unhelpfulCount: number;
  createdAt: Date;
}

export interface StudyGroup {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  name: string;
  description: string;
  maxMembers: number;
  currentMembers: number;
  schedule: string;
  location: string;
  creator: string;
  members: string[];
  isPublic: boolean;
  createdAt: Date;
}

export interface CourseFilterState {
  searchQuery: string;
  departments: string[];
  levels: CourseLevel[];
  minRating: number;
  maxDifficulty: number;
  minCredits: number;
  maxCredits: number;
  sortBy: "rating" | "difficulty" | "reviews" | "code" | "name";
}

export interface ProfessorFilterState {
  searchQuery: string;
  departments: string[];
  minRating: number;
  sortBy: "rating" | "difficulty" | "reviews" | "name";
}
