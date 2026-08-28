// ─── Dynamic Sponsor Lead Scoring Algorithm Types ─────────────────────────

export type LeadTier = "hot" | "warm" | "cool" | "low_match";

export type RecruitmentGoal =
  | "full_time"
  | "summer_internship"
  | "coop"
  | "research_grant"
  | "general_networking";

export interface ScoringVectorBreakdown {
  academicFitScore: number; // 0 - 100
  engagementDepthScore: number; // 0 - 100
  skillMatchScore: number; // 0 - 100
  recruitmentIntentScore: number; // 0 - 100
}

export interface ScoringVectorWeights {
  academicWeight: number; // e.g. 0.25
  engagementWeight: number; // e.g. 0.30
  skillWeight: number; // e.g. 0.25
  intentWeight: number; // e.g. 0.20
}

export interface SponsorScoringCriteria {
  sponsorId: string;
  sponsorName: string;
  targetMajors: string[]; // e.g. ["Computer Science", "Electrical Engineering", "Data Science"]
  targetGradYears: number[]; // e.g. [2026, 2027]
  requiredSkills: string[]; // e.g. ["React", "Python", "TypeScript", "AWS", "Machine Learning"]
  minGpa: number; // e.g. 3.2
  preferredGoals: RecruitmentGoal[];
  weights: ScoringVectorWeights;
}

export interface CandidateProfile {
  id: string;
  name: string;
  avatar: string;
  email: string;
  major: string;
  graduationYear: number;
  degreeLevel: "Bachelor's" | "Master's" | "Ph.D." | "Associate";
  gpa: number;
  skills: string[];
  seekingGoal: RecruitmentGoal;
  githubUrl?: string;
  linkedinUrl?: string;
  verifiedCertificatesCount: number;
  hackathonWinsCount: number;
}

export interface BoothInteractionLog {
  boothVisitDurationSeconds: number; // e.g. 360 sec (6 mins)
  interactedWithDemo: boolean;
  submittedResume: boolean;
  completedCodeChallenge: boolean;
  visitCount: number;
  recruiterRatingOverride?: number; // 1 to 5 stars optional manual boost
  recruiterNotes?: string;
  scannedAt: Date;
}

export interface ScannedSponsorLead {
  leadId: string;
  eventId: string;
  sponsorId: string;
  candidate: CandidateProfile;
  interaction: BoothInteractionLog;
}

export interface LeadScoreResult {
  leadId: string;
  candidateName: string;
  overallScore: number; // 0 - 100
  tier: LeadTier;
  vectors: ScoringVectorBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  recommendationReason: string;
  calculatedAt: Date;
}

export interface LeadScoringMetrics {
  totalLeadsScanned: number;
  hotLeadsCount: number;
  warmLeadsCount: number;
  coolLeadsCount: number;
  lowMatchLeadsCount: number;
  avgOverallScore: number;
}
