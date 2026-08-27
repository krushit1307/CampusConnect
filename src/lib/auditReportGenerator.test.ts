import { describe, it, expect } from "vitest";
import {
  aggregateByCategory,
  generateAuditReportPayload,
  AuditTransaction,
} from "./auditReportGenerator";

describe("Exportable Audit Report Generator Suite (#2797)", () => {
  const sampleTransactions: AuditTransaction[] = [
    {
      id: "tx_1",
      amount: 1000.0,
      transactionType: "INCOME",
      category: "Union Grant",
      description: "Fall 2026 Funding",
      createdAt: "2026-09-01T10:00:00Z",
    },
    {
      id: "tx_2",
      amount: -150.0,
      transactionType: "EXPENSE",
      category: "Food",
      description: "Pizza",
      createdAt: "2026-09-05T12:00:00Z",
    },
    {
      id: "tx_3",
      amount: -50.0,
      transactionType: "EXPENSE",
      category: "Food",
      description: "Drinks",
      createdAt: "2026-09-06T15:00:00Z",
    },
    {
      id: "tx_4",
      amount: -200.0,
      transactionType: "EXPENSE",
      category: "Marketing",
      description: "Flyers",
      createdAt: "2026-09-10T09:00:00Z",
    },
  ];

  it("aggregates expenses by category correctly", () => {
    const expenseBreakdown = aggregateByCategory(sampleTransactions, "EXPENSE");

    expect(expenseBreakdown.length).toBe(2);

    // Marketing should be first (200) or Food (200) -> Both are 200, check existence
    const food = expenseBreakdown.find((c) => c.category === "Food");
    expect(food?.totalAmount).toBe(200.0);
    expect(food?.transactionCount).toBe(2);

    const marketing = expenseBreakdown.find((c) => c.category === "Marketing");
    expect(marketing?.totalAmount).toBe(200.0);
    expect(marketing?.transactionCount).toBe(1);
  });

  it("generates a fully structured payload for the PDF renderer with accurate math", () => {
    const payload = generateAuditReportPayload(
      "Chess Club",
      "Alice Treasurer",
      sampleTransactions,
      "2026-09-01",
      "2026-09-30",
    );

    expect(payload.clubName).toBe("Chess Club");
    expect(payload.treasurerName).toBe("Alice Treasurer");

    expect(payload.summary.totalIncome).toBe(1000.0);
    expect(payload.summary.totalExpense).toBe(400.0);
    expect(payload.summary.netBalance).toBe(600.0);

    expect(payload.incomeBreakdown.length).toBe(1);
    expect(payload.expenseBreakdown.length).toBe(2);

    expect(payload.transactions.length).toBe(4);
    expect(payload.generatedAt).toBeDefined();
  });
});
