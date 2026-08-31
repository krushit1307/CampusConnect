/**
 * Career Services Portal — Type Definitions
 *
 * Job/internship postings, application tracking, resume reviews,
 * interview prep, mentorship matching, and career analytics.
 */

export const JOB_TYPES = ['Full-Time', 'Part-Time', 'Internship', 'Co-Op', 'Contract', 'Freelance'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_STATUSES = ['Open', 'Closed', 'Filled', 'Pending Review'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPLICATION_STATUSES = ['Applied', 'Under Review', 'Interview Scheduled', 'Offer Received', 'Rejected', 'Withdrawn'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Consulting', 'Education',
  'Manufacturing', 'Media', 'Retail', 'Energy', 'Government',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const SKILL_AREAS = [
  'Software Engineering', 'Data Science', 'Product Management', 'Design',
  'Marketing', 'Finance', 'Operations', 'Research', 'Sales', 'HR',
] as const;
export type SkillArea = (typeof SKILL_AREAS)[number];

// ── Color Maps ─────────────────────────────────────────────────────────────

export const JOB_TYPE_COLORS: Record<JobType, string> = {
  'Full-Time': '#3b82f6', 'Part-Time': '#8b5cf6', 'Internship': '#22c55e',
  'Co-Op': '#06b6d4', 'Contract': '#f59e0b', 'Freelance': '#ec4899',
};

export const APPLICATION_COLORS: Record<ApplicationStatus, string> = {
  'Applied': '#3b82f6', 'Under Review': '#eab308', 'Interview Scheduled': '#8b5cf6',
  'Offer Received': '#22c55e', 'Rejected': '#ef4444', 'Withdrawn': '#6b7280',
};

export const INDUSTRY_COLORS: Record<Industry, string> = {
  'Technology': '#3b82f6', 'Finance': '#22c55e', 'Healthcare': '#ef4444',
  'Consulting': '#8b5cf6', 'Education': '#f59e0b', 'Manufacturing': '#6b7280',
  'Media': '#ec4899', 'Retail': '#06b6d4', 'Energy': '#14b8a6', 'Government': '#6366f1',
};

export const JOB_TYPE_ICONS: Record<JobType, string> = {
  'Full-Time': '💼', 'Part-Time': '⏰', 'Internship': '🎓',
  'Co-Op': '🤝', 'Contract': '📄', 'Freelance': '🌍',
};

// ── Core Types ─────────────────────────────────────────────────────────────

export interface JobPosting {
  id: string;
  title: string;
  company: string;
  industry: Industry;
  type: JobType;
  status: JobStatus;
  description: string;
  requirements: string[];
  salaryMin?: number;
  salaryMax?: number;
  location: string;
  isRemote: boolean;
  deadline: string;
  postedAt: string;
  applicantCount: number;
  skills: string[];
  contactEmail: string;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  studentId: string;
  studentName: string;
  status: ApplicationStatus;
  appliedAt: string;
  lastUpdated: string;
  interviewDate?: string;
  offerAmount?: number;
  notes?: string;
}

export interface ResumeReview {
  id: string;
  studentId: string;
  studentName: string;
  reviewerName: string;
  score: number; // 0-100
  categories: { name: string; score: number }[];
  strengths: string[];
  improvements: string[];
  submittedAt: string;
  status: 'Pending' | 'Completed' | 'In Progress';
}

export interface InterviewPrep {
  id: string;
  company: string;
  role: string;
  type: 'Technical' | 'Behavioral' | 'Case Study' | 'System Design';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questions: string[];
  avgPreparationTime: number; // minutes
  successRate: number; // 0-100
  completedBy: number;
}

export interface CareerTrend {
  month: string;
  newPostings: number;
  totalApplications: number;
  interviewsScheduled: number;
  offersExtended: number;
  placementRate: number;
}

export interface CompanyStats {
  company: string;
  industry: Industry;
  postingsCount: number;
  totalApplicants: number;
  avgSalary: number;
  responseRate: number;
  hiredCount: number;
}

export interface CareerInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'critical' | 'info';
  metric: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
}

export interface CareerSummary {
  totalPostings: number;
  openPostings: number;
  totalApplications: number;
  interviewsScheduled: number;
  offersReceived: number;
  placementRate: number;
  avgSalary: number;
  topIndustry: Industry;
  topJobType: JobType;
  resumeReviews: number;
  avgResumeScore: number;
}

// ── Formatters ─────────────────────────────────────────────────────────────

export function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return 'Not specified';
  if (min && max) return `$${(min / 1000).toFixed(0)}k - $${(max / 1000).toFixed(0)}k`;
  if (min) return `From $${(min / 1000).toFixed(0)}k`;
  return `Up to $${(max! / 1000).toFixed(0)}k`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
