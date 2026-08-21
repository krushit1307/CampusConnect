export interface RawLedgerTransaction {
  id: string;
  clubId: string;
  amount: number;
  transactionType: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  isConfidential?: boolean;
  createdAt: string; // ISO string
}

export interface PieChartCategoryData {
  category: string;
  totalAmount: number;
  percentage: number;
}

export interface MonthOverMonthData {
  monthKey: string; // e.g. "2026-08"
  totalExpense: number;
}

export interface PublicTransparencyDashboardData {
  clubId: string;
  totalExpenses: number;
  categoryBreakdown: PieChartCategoryData[];
  monthlyExpenses: MonthOverMonthData[];
}

/**
 * Aggregates raw ledger entries into public chart data while masking confidential line items.
 */
export function buildPublicTransparencyData(
  transactions: RawLedgerTransaction[],
  clubId: string,
): PublicTransparencyDashboardData {
  const clubExpenses = transactions.filter(
    (tx) => tx.clubId === clubId && tx.transactionType === "EXPENSE",
  );

  const categoryTotalsMap = new Map<string, number>();
  const monthlyTotalsMap = new Map<string, number>();
  let overallExpenseTotal = 0;

  for (const tx of clubExpenses) {
    const expenseAmount = Math.abs(tx.amount);
    overallExpenseTotal += expenseAmount;

    // Mask category as "Miscellaneous" if flagged as confidential
    const publicCategory = tx.isConfidential ? "Miscellaneous" : tx.category;
    const currentCategoryTotal = categoryTotalsMap.get(publicCategory) || 0;
    categoryTotalsMap.set(publicCategory, currentCategoryTotal + expenseAmount);

    // Group by YYYY-MM month key
    const monthKey = tx.createdAt.substring(0, 7);
    const currentMonthTotal = monthlyTotalsMap.get(monthKey) || 0;
    monthlyTotalsMap.set(monthKey, currentMonthTotal + expenseAmount);
  }

  // Format category breakdown for Pie Chart
  const categoryBreakdown: PieChartCategoryData[] = Array.from(categoryTotalsMap.entries())
    .map(([category, totalAmount]) => {
      const percentage =
        overallExpenseTotal > 0
          ? Number(((totalAmount / overallExpenseTotal) * 100).toFixed(1))
          : 0;
      return {
        category,
        totalAmount: Number(totalAmount.toFixed(2)),
        percentage,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Format monthly trend for Bar Chart
  const monthlyExpenses: MonthOverMonthData[] = Array.from(monthlyTotalsMap.entries())
    .map(([monthKey, totalExpense]) => ({
      monthKey,
      totalExpense: Number(totalExpense.toFixed(2)),
    }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  return {
    clubId,
    totalExpenses: Number(overallExpenseTotal.toFixed(2)),
    categoryBreakdown,
    monthlyExpenses,
  };
}
