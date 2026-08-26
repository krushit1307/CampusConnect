import { describe, it, expect } from "vitest";
import { buildPublicTransparencyData, RawLedgerTransaction } from "./budgetTransparency";

describe("Club Budget Transparency Dashboard Suite (#2998)", () => {
  const clubId = "club_acm_10";

  const sampleLedger: RawLedgerTransaction[] = [
    {
      id: "tx1",
      clubId,
      amount: -300,
      transactionType: "EXPENSE",
      category: "Food",
      description: "Welcome Pizza",
      isConfidential: false,
      createdAt: "2026-08-01T10:00:00Z",
    },
    {
      id: "tx2",
      clubId,
      amount: -200,
      transactionType: "EXPENSE",
      category: "Venue",
      description: "Hall Rental",
      isConfidential: false,
      createdAt: "2026-08-15T10:00:00Z",
    },
    {
      id: "tx3",
      clubId,
      amount: -100,
      transactionType: "EXPENSE",
      category: "Accessibility Accommodation", // Sensitive line item
      description: "Specialized service",
      isConfidential: true, // Should be masked to Miscellaneous
      createdAt: "2026-09-01T10:00:00Z",
    },
  ];

  it("masks confidential expense categories into generic 'Miscellaneous' category", () => {
    const data = buildPublicTransparencyData(sampleLedger, clubId);

    const sensitiveCategory = data.categoryBreakdown.find(
      (c) => c.category === "Accessibility Accommodation",
    );
    expect(sensitiveCategory).toBeUndefined();

    const miscCategory = data.categoryBreakdown.find((c) => c.category === "Miscellaneous");
    expect(miscCategory).toBeDefined();
    expect(miscCategory?.totalAmount).toBe(100);
  });

  it("calculates accurate totals and month-over-month trend series", () => {
    const data = buildPublicTransparencyData(sampleLedger, clubId);

    expect(data.totalExpenses).toBe(600);
    expect(data.monthlyExpenses.length).toBe(2);

    // 2026-08: $300 + $200 = $500
    const aug = data.monthlyExpenses.find((m) => m.monthKey === "2026-08");
    expect(aug?.totalExpense).toBe(500);

    // 2026-09: $100
    const sep = data.monthlyExpenses.find((m) => m.monthKey === "2026-09");
    expect(sep?.totalExpense).toBe(100);
  });
});
