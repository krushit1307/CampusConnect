import { describe, it, expect } from "vitest";
import {
  calculateClubBalanceSummary,
  generateAuditCsvReport,
  FinancialTransaction,
} from "./clubFinances";

describe("Club Budget & Expense Tracking Suite (#2735)", () => {
  const clubId = "club_acm_99";

  const sampleTransactions: FinancialTransaction[] = [
    {
      id: "tx_101",
      clubId,
      amount: 500.0,
      transactionType: "INCOME",
      category: "Student Union Grant",
      description: "Semester operational funding",
      createdAt: "2026-08-01T10:00:00Z",
    },
    {
      id: "tx_102",
      clubId,
      amount: -120.5,
      transactionType: "EXPENSE",
      category: "Food",
      description: "Pizza for welcome meeting",
      receiptUrl: "https://storage.campusconnect.edu/receipts/r102.jpg",
      createdAt: "2026-08-05T18:00:00Z",
    },
  ];

  it("calculates net balance, total income, and total expenses accurately", () => {
    const summary = calculateClubBalanceSummary(sampleTransactions, clubId);

    expect(summary.totalIncome).toBe(500.0);
    expect(summary.totalExpense).toBe(120.5);
    expect(summary.netBalance).toBe(379.5);
  });

  it("generates a cleanly formatted CSV audit report", () => {
    const csv = generateAuditCsvReport(sampleTransactions);

    expect(csv).toContain("Transaction ID,Date,Type,Category");
    expect(csv).toContain("tx_101,2026-08-01T10:00:00Z,INCOME");
    expect(csv).toContain('"Pizza for welcome meeting"');
    expect(csv).toContain("https://storage.campusconnect.edu/receipts/r102.jpg");
  });
});
