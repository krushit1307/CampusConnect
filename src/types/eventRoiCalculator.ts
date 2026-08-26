// =============================================================================
// File: src/types/eventRoiCalculator.ts
// Issue: #3941 - Build an 'Interactive Event Budget ROI' Calculator
// Description: Type definitions for event break-even models, fixed/variable costs,
//              attendance sensitivity matrix, and net profit projections.
// =============================================================================

export interface ExpenseItem {
  id: string;
  name: string;
  category: "venue" | "catering" | "marketing" | "production" | "permits" | "swag" | "misc";
  amount: number;
  isVariablePerAttendee: boolean; // if true, cost scales with attendee count
  costPerAttendee?: number;
}

export interface RevenueTier {
  id: string;
  tierName: string;
  ticketPrice: number;
  allocatedCapacityPercent: number; // e.g. 20% early bird, 70% GA, 10% VIP
}

export interface EventFinancialInputs {
  eventId: string;
  eventTitle: string;
  venueCapacity: number;
  expectedAttendanceRate: number; // 0.0 - 1.0 (e.g. 0.80 = 80%)
  averageTicketPrice: number;
  confirmedSponsorshipRevenue: number;
  studentGovtGrant: number;
  fixedExpenses: ExpenseItem[];
  variableCostPerAttendee: number;
}

export interface BreakEvenAnalysisResult {
  totalFixedCosts: number;
  variableCostPerAttendee: number;
  totalVariableCosts: number;
  totalEstimatedExpenses: number;
  grossTicketRevenue: number;
  totalRevenue: number; // ticket revenue + grants + sponsorships
  netProfitOrLoss: number;
  isProfitable: boolean;
  profitMarginPercent: number;
  roiPercentage: number;
  breakEvenTicketCount: number;
  breakEvenAttendanceRate: number; // percentage of venue capacity needed to break even
  marginOfSafetyTickets: number; // expected tickets - break-even tickets
  marginOfSafetyPercent: number;
  projectedAttendees: number;
}

export interface SensitivityMatrixCell {
  ticketPrice: number;
  attendancePercent: number;
  projectedAttendees: number;
  totalRevenue: number;
  netProfit: number;
  isProfitable: boolean;
}

export interface RoiScenarioComparison {
  scenarioName: "pessimistic" | "base" | "optimistic";
  attendanceRate: number;
  attendeeCount: number;
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  marginPercent: number;
}

export interface EventBudgetPlanPayload {
  eventId: string;
  venueCapacity: number;
  expectedAttendanceRate: number;
  averageTicketPrice: number;
  fixedCostsTotal: number;
  variableCostTotal: number;
  breakEvenTickets: number;
  projectedProfit: number;
  expenses: ExpenseItem[];
}
