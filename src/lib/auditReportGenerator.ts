export interface AuditTransaction {
  id: string;
  amount: number; // Positive for Income, Negative for Expense
  transactionType: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  createdAt: string; // ISO string
}

export interface CategoryBreakdown {
  category: string;
  totalAmount: number;
  transactionCount: number;
}

export interface AuditReportPayload {
  clubName: string;
  treasurerName: string;
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
  };
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
  transactions: AuditTransaction[];
  generatedAt: string;
}

/**
 * Aggregates a list of transactions into a grouped category breakdown.
 */
export function aggregateByCategory(
  transactions: AuditTransaction[],
  type: "INCOME" | "EXPENSE",
): CategoryBreakdown[] {
  const filtered = transactions.filter((tx) => tx.transactionType === type);
  const categoryMap = new Map<string, CategoryBreakdown>();

  for (const tx of filtered) {
    const amount = Math.abs(tx.amount);
    const existing = categoryMap.get(tx.category);

    if (existing) {
      existing.totalAmount += amount;
      existing.transactionCount += 1;
    } else {
      categoryMap.set(tx.category, {
        category: tx.category,
        totalAmount: amount,
        transactionCount: 1,
      });
    }
  }

  // Sort descending by amount
  return Array.from(categoryMap.values())
    .map((c) => ({ ...c, totalAmount: Number(c.totalAmount.toFixed(2)) }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Prepares the complete structured payload required to render the multi-page PDF Audit Report.
 */
export function generateAuditReportPayload(
  clubName: string,
  treasurerName: string,
  transactions: AuditTransaction[],
  startDate: string,
  endDate: string,
  nowIso: string = new Date().toISOString(),
): AuditReportPayload {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of transactions) {
    if (tx.transactionType === "INCOME") {
      totalIncome += Math.abs(tx.amount);
    } else if (tx.transactionType === "EXPENSE") {
      totalExpense += Math.abs(tx.amount);
    }
  }

  const netBalance = totalIncome - totalExpense;

  return {
    clubName,
    treasurerName,
    reportPeriod: { startDate, endDate },
    summary: {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      netBalance: Number(netBalance.toFixed(2)),
    },
    incomeBreakdown: aggregateByCategory(transactions, "INCOME"),
    expenseBreakdown: aggregateByCategory(transactions, "EXPENSE"),
    transactions: [...transactions].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    ),
    generatedAt: nowIso,
  };
}
