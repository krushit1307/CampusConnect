/**
 * TypeScript Data Models & Interfaces for Enterprise Research Grant Telemetry Module
 */

export type GrantCategory =
  | 'FEDERAL_FUNDED'
  | 'CORPORATE_SPONSORED'
  | 'DEFENSE_CONTRACT'
  | 'FOUNDATION_GRANT';

export type GrantStatus =
  | 'ACTIVE_DISBURSEMENT'
  | 'UNDER_AUDIT_REVIEW'
  | 'COMPLETED_SUCCESSFUL';

export interface ResearchGrantRecord {
  id: string;
  projectTitle: string;
  principalInvestigator: string;
  academicDepartment: string;
  fundingAgency: string;
  totalGrantAmountUSD: number;
  disbursedFundsUSD: number;
  grantCategory: GrantCategory;
  grantStatus: GrantStatus;
  awardDate: string;
  complianceRating: number;
}

export interface GrantMilestone {
  milestoneId: string;
  grantId: string;
  title: string;
  targetDate: string;
  status: 'VERIFIED' | 'IN_PROGRESS' | 'PENDING_REVIEW';
  trancheAmountUSD: number;
}

export interface GrantFilterState {
  searchQuery: string;
  categoryFilter: GrantCategory | 'ALL';
  statusFilter: GrantStatus | 'ALL';
  minGrantAmountUSD: number;
}

export interface GrantTelemetryManifest {
  timestamp: string;
  totalFundingUSD: number;
  totalActiveGrants: number;
  filteredCount: number;
  records: ResearchGrantRecord[];
}
