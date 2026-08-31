export type CourseLevel = 'intro' | 'intermediate' | 'advanced' | 'capstone';
export type CourseCategory = 'core' | 'math' | 'systems' | 'theory' | 'ai' | 'elective';

export interface Course {
  id: string;
  code: string; // e.g. CS 101
  title: string;
  credits: number;
  category: CourseCategory;
  level: CourseLevel;
  description: string;
  prerequisites: string[]; // List of course codes required
  corequisites?: string[];
  unlocked?: boolean;
  completed?: boolean;
  inProgress?: boolean;
  grade?: string;
}

export interface SemesterPlan {
  id: string;
  term: 'Fall' | 'Spring' | 'Summer';
  year: number;
  courses: Course[];
  maxCredits: number;
}

export interface DegreeRequirementGroup {
  id: string;
  name: string;
  requiredCredits: number;
  completedCredits: number;
  color: string;
}

export interface DegreePlanState {
  major: string;
  totalRequiredCredits: number;
  completedCredits: number;
  semesters: SemesterPlan[];
  requirements: DegreeRequirementGroup[];
}
