// ─── Dynamic Budget Surplus Re-Allocator Types ────────────────────────────

export type InvestmentCategory =
  | "asset-replacement"
  | "community-donation"
  | "skill-development"
  | "infrastructure"
  | "event-equipment"
  | "emergency-fund";

export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export type FundingRequestStatus = "draft" | "pending" | "approved" | "rejected" | "executed";
export type AssetCondition = "excellent" | "good" | "fair" | "poor" | "critical";

export interface ClubBudget {
  clubId: string;
  clubName: string;
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
  totalBudget: number;
  spent: number;
  remaining: number;
  surplusThreshold: number;
  lastAuditDate: Date;
  treasurerName: string;
}

export interface DepreciatingAsset {
  id: string;
  clubId: string;
  name: string;
  category: string;
  purchaseDate: Date;
  purchasePrice: number;
  currentValue: number;
  condition: AssetCondition;
  expectedLifespanYears: number;
  replacementCost: number;
  depreciationRate: number;
  lastMaintenanceDate?: Date;
  warrantyExpiry?: Date;
  notes: string;
}

export interface InvestmentSuggestion {
  id: string;
  category: InvestmentCategory;
  title: string;
  description: string;
  estimatedCost: number;
  impactScore: number;
  urgency: UrgencyLevel;
  roi: string;
  longTermBenefit: string;
  relatedAssetId?: string;
  tags: string[];
  approved: boolean;
  executed: boolean;
}

export interface CommunityInvestment {
  id: string;
  organizationName: string;
  cause: string;
  suggestedAmount: number;
  gamificationPoints: number;
  impactDescription: string;
  taxDeductible: boolean;
  verified: boolean;
  tags: string[];
}

export interface FundingRequest {
  id: string;
  clubId: string;
  title: string;
  description: string;
  amount: number;
  category: InvestmentCategory;
  justification: string;
  supportingDocuments: string[];
  status: FundingRequestStatus;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  relatedSuggestionId: string;
}

export interface FiscalDeadline {
  id: string;
  clubId: string;
  deadlineDate: Date;
  daysRemaining: number;
  reclaimThreshold: number;
  currentBalance: number;
  alertTriggered: boolean;
  warningLevel: "safe" | "caution" | "warning" | "critical";
}

export interface SurplusAnalysis {
  totalSurplus: number;
  surplusPercentage: number;
  daysUntilDeadline: number;
  recommendedTotalAllocation: number;
  suggestions: InvestmentSuggestion[];
  communityInvestments: CommunityInvestment[];
  totalSuggestedCost: number;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface AuditLogEntry {
  id: string;
  clubId: string;
  action: string;
  timestamp: Date;
  performedBy: string;
  details: string;
}
