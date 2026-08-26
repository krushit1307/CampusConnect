// ─── Automated Club Leadership Background Checks Types ────────────────────

export type ScreeningStatus =
  | "pending"
  | "in_screening"
  | "cleared"
  | "flagged_for_review"
  | "rejected";

export type ComplianceRiskFlag =
  | "low_gpa"
  | "academic_probation"
  | "disciplinary_record"
  | "financial_hold"
  | "missing_safety_training"
  | "part_time_enrollment";

export interface AcademicStandingCheck {
  gpa: number;
  minGpaRequired: number; // e.g. 2.5
  isAcademicProbation: boolean;
  creditHoursEnrolled: number;
  minCreditsRequired: number; // e.g. 12 credits for full-time
  passed: boolean;
}

export interface JudicialConductCheck {
  hasActiveDisciplinaryAction: boolean;
  hasHazingViolations: boolean;
  hasHonorCodeSuspension: boolean;
  recordsCount: number;
  passed: boolean;
}

export interface FinancialClearanceCheck {
  outstandingDebtCents: number;
  unpaidDuesCents: number;
  hasFinancialHold: boolean;
  passed: boolean;
}

export interface SafetyTrainingCheck {
  hasCompletedTitleIX: boolean;
  hasCompletedHazingPrevention: boolean;
  hasCompletedFinancialLeadership: boolean;
  completedAt?: Date;
  passed: boolean;
}

export interface BackgroundCheckVectorResults {
  academic: AcademicStandingCheck;
  judicial: JudicialConductCheck;
  financial: FinancialClearanceCheck;
  safetyTraining: SafetyTrainingCheck;
}

export interface LeadershipBackgroundCheckRecord {
  id: string; // e.g. "LBC-9041"
  transitionId: string;
  clubId: string;
  clubName: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  roleTitle: string; // e.g. "Club President", "Treasurer"
  status: ScreeningStatus;
  riskFlags: ComplianceRiskFlag[];
  vectors: BackgroundCheckVectorResults;
  initiatedAt: Date;
  completedAt?: Date;
  advisorOverride?: {
    advisorName: string;
    overrideDecision: "cleared" | "rejected";
    notes: string;
    overriddenAt: Date;
  };
}
