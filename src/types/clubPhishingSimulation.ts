/**
 * Type definitions for Automated Club Leadership Mandatory Phishing Simulation & Security Training.
 * Issue: #5096 - Automated "Club Leadership" Mandatory Phishing Simulation
 */

export type PhishingSimulationStatus =
  | "SCHEDULED"
  | "DELIVERED"
  | "PASSED_REPORTED"
  | "FAILED_CLICKED"
  | "FAILED_CREDENTIALS"
  | "RETRAINING_REQUIRED"
  | "COMPLIANT_CLEARED";

export type PhishingScenarioCategory =
  | "URGENT_GRANT_WIRE"
  | "FACULTY_SPONSOR_APPROVAL"
  | "EVENT_VENUE_CONTRACT"
  | "STUDENT_UNION_DUES_AUDIT"
  | "EQUIPMENT_PURCHASE_RECEIPT";

export interface PhishingTemplate {
  id: string;
  category: PhishingScenarioCategory;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyPreview: string;
  difficultyRating: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  redFlags: string[];
}

export interface OfficerSimulationResult {
  id: string;
  campaignId: string;
  clubId: string;
  clubName: string;
  officerUserId: string;
  officerName: string;
  officerEmail: string;
  officerRole: "President" | "Treasurer" | "Secretary" | "Vice President";
  templateId: string;
  scenarioTitle: string;
  status: PhishingSimulationStatus;
  deliveredAt: string;
  openedAt?: string | null;
  reportedAt?: string | null;
  clickedAt?: string | null;
  submittedCredentialsAt?: string | null;
  retrainingCompletedAt?: string | null;
  isBudgetAuthorizationGated: boolean;
}

export interface PhishingSimulationCampaign {
  id: string;
  title: string;
  targetAcademicTerm: string;
  totalOfficersTargeted: number;
  reportedCount: number;
  clickedCount: number;
  credentialsSubmittedCount: number;
  retrainingRequiredCount: number;
  status: "DRAFT" | "ACTIVE" | "COMPLETED";
  createdAt: string;
}

export interface PhishingSecuritySummary {
  clubId: string;
  clubName: string;
  totalLeadershipOfficers: number;
  compliantCount: number;
  gatedCount: number;
  passRatePercentage: number;
  overallRiskGrade: "A_EXCELLENT" | "B_GOOD" | "C_NEEDS_IMPROVEMENT" | "D_HIGH_RISK";
  activeRetrainingMandates: number;
}
