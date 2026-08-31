// =============================================================================
// File: src/types/taxExemptAudit.ts
// Feature: Automated "Tax-Exempt" Audit Trail Generator
// Description: Type definitions for Tax-Exempt status metadata, IRS Form 990-N/EZ
//              schedule line item breakdowns, SHA-256 digital seals, and exports.
// =============================================================================

export interface TaxExemptStatusInfo {
  einNumber: string; // e.g. "12-3456789"
  taxStatus: "501(c)(3) Public Charity" | "University Recognized Student Organization" | "Tax-Exempt Club";
  determinationYear: number;
  clubId: string;
  clubName: string;
  treasurerName: string;
}

export interface Form990LineCategory {
  lineCode: string; // e.g. "Line 1", "Line 2", "Line 10", "Line 13", "Line 16"
  lineName: string; // e.g. "Contributions, Gifts & Grants"
  type: "REVENUE" | "EXPENSE";
  totalAmount: number;
  transactionCount: number;
  percentOfTotal: number;
}

export interface CryptographicAuditSeal {
  sha256Hash: string;
  generatedAt: string; // ISO String
  signedByTreasurer: string;
  verificationStatus: "VERIFIED_GENUINE" | "TAMPER_EVIDENT";
}

export interface AuditTransactionItem {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // Positive for Revenue, Negative for Expense
  category: string;
  form990LineCode: string;
  receiptAttached: boolean;
}

export interface TaxExemptAuditReport {
  reportId: string;
  clubId: string;
  clubName: string;
  taxInfo: TaxExemptStatusInfo;
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    grossReceipts: number;
    totalRevenue: number;
    totalExpenses: number;
    netSurplusDeficit: number;
    beginningNetAssets: number;
    endingNetAssets: number;
  };
  revenueLines: Form990LineCategory[];
  expenseLines: Form990LineCategory[];
  transactions: AuditTransactionItem[];
  digitalSeal: CryptographicAuditSeal;
}
