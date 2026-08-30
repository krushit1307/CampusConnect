// ─── Career & Internship Hub Types ────────────────────────────────────────

export type JobType = "internship" | "full-time" | "part-time" | "co-op" | "contract";
export type ExperienceLevel = "entry" | "mid" | "senior" | "executive";
export type ApplicationStatus =
  "saved" | "applied" | "screening" | "interview" | "offer" | "accepted" | "rejected" | "withdrawn";
export type CompanySize = "startup" | "small" | "medium" | "large" | "enterprise";
export type Industry =
  | "technology"
  | "finance"
  | "healthcare"
  | "education"
  | "manufacturing"
  | "media"
  | "consulting"
  | "nonprofit"
  | "government"
  | "retail"
  | "energy"
  | "legal";
export type RemotePolicy = "remote" | "hybrid" | "on-site";

export interface Company {
  id: string;
  name: string;
  logo: string;
  industry: Industry;
  size: CompanySize;
  hq: string;
  website: string;
  description: string;
  rating: number;
  reviewsCount: number;
  verified: boolean;
  openPositions: number;
  tags: string[];
}

export interface JobListing {
  id: string;
  companyId: string;
  company: Company;
  title: string;
  type: JobType;
  experienceLevel: ExperienceLevel;
  remotePolicy: RemotePolicy;
  location: string;
  salary?: { min: number; max: number; currency: string };
  description: string;
  requirements: string[];
  benefits: string[];
  postedAt: Date;
  deadline?: Date;
  applicantsCount: number;
  isUrgent: boolean;
  isSaved: boolean;
  tags: string[];
}

export interface Application {
  id: string;
  jobListingId: string;
  job: JobListing;
  status: ApplicationStatus;
  appliedAt: Date;
  updatedAt: Date;
  notes: string;
  nextStep?: string;
  nextStepDate?: Date;
  timeline: ApplicationEvent[];
}

export interface ApplicationEvent {
  id: string;
  status: ApplicationStatus;
  timestamp: Date;
  note: string;
}

export interface CareerFairEvent {
  id: string;
  name: string;
  description: string;
  date: Date;
  endDate: Date;
  location: string;
  virtual: boolean;
  companies: string[];
  tags: string[];
  registeredCount: number;
  isRegistered: boolean;
  image?: string;
}

export interface ResumeVersion {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  atsScore: number;
  sections: ResumeSection[];
  isDefault: boolean;
}

export interface ResumeSection {
  id: string;
  type: "experience" | "education" | "skills" | "projects" | "certifications";
  title: string;
  items: ResumeItem[];
}

export interface ResumeItem {
  id: string;
  title: string;
  subtitle: string;
  dateRange: string;
  description: string;
  highlights: string[];
}

export interface SkillEndorsement {
  skill: string;
  endorsements: number;
  endorsedBy: string[];
  verified: boolean;
}

export interface CareerProfile {
  id: string;
  headline: string;
  objective: string;
  skills: SkillEndorsement[];
  preferredIndustries: Industry[];
  preferredJobTypes: JobType[];
  preferredRemote: RemotePolicy[];
  expectedSalary?: { min: number; max: number };
  graduationYear: number;
  major: string;
  gpa?: number;
  openToWork: boolean;
}
