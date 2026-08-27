// =============================================================================
// File: src/types/budgetSankey.ts
// Issue: #3947 - Build an 'Interactive "Event Budget vs Actual" Sankey Diagram'
// Description: Type definitions for Sankey nodes, links, financial flow metrics,
//              and budget vs actual variance tracking.
// =============================================================================

export type FlowNodeType = "source" | "category" | "vendor" | "status";

export interface SankeyNode {
  id: string;
  name: string;
  type: FlowNodeType;
  value: number;
  allocatedBudget?: number;
  actualSpent?: number;
  variance?: number;
  variancePercentage?: number;
  color?: string;
  depth?: number;
  icon?: string;
  metadata?: {
    vendorContact?: string;
    invoiceCount?: number;
    accountCode?: string;
    department?: string;
  };
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  budgetedValue?: number;
  actualValue?: number;
  color?: string;
  flowType?: "budget" | "actual" | "variance";
  category?: string;
  transactionCount?: number;
}

export interface SankeyGraphData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  currency: string;
  fiscalYear: number;
  lastUpdated: string;
}

export interface BudgetTransaction {
  id: string;
  clubId: string;
  eventId?: string;
  eventTitle?: string;
  sourceName: string;
  category: string;
  vendorName: string;
  budgetedAmount: number;
  actualAmount: number;
  transactionDate: string;
  status: "approved" | "pending" | "reconciled" | "disputed";
  description: string;
  invoiceUrl?: string;
  receiptNumber?: string;
  approvedBy?: string;
}

export interface BudgetSummaryKPIs {
  totalBudget: number;
  totalActualSpent: number;
  remainingBalance: number;
  burnRatePercentage: number;
  topSpendingCategory: {
    category: string;
    amount: number;
    percentOfTotal: number;
  };
  topVendor: {
    vendorName: string;
    amount: number;
  };
  totalTransactions: number;
  costEfficiencyScore: number; // 0 - 100
  isOverBudget: boolean;
}

export type SankeyViewMode = "budget" | "actual" | "comparison";

export interface SankeyFilterOptions {
  fiscalYear: number;
  eventId?: string;
  category?: string;
  viewMode: SankeyViewMode;
  searchQuery?: string;
}
