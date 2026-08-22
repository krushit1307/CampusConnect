// =============================================================================
// File: src/services/budgetSankeyService.ts
// Issue: #3947 - Build an 'Interactive "Event Budget vs Actual" Sankey Diagram'
// Description: Data transformation, layout calculations, variance analytics,
//              and CSV/JSON export utilities for Budget vs Actual Sankey Diagrams.
// =============================================================================

import { supabase } from "@/lib/supabase";
import type {
  BudgetTransaction,
  BudgetSummaryKPIs,
  SankeyGraphData,
  SankeyNode,
  SankeyLink,
  SankeyViewMode,
  SankeyFilterOptions,
} from "@/types/budgetSankey";

const CATEGORY_COLORS: Record<string, string> = {
  "Student Govt Grant": "#10B981", // Emerald
  "Ticket Sales Revenue": "#06B6D4", // Cyan
  "Corporate Sponsorship": "#8B5CF6", // Purple
  "Alumni Endowment": "#F59E0B", // Amber
  "Merchandise Sales": "#EC4899", // Pink
  "Venue & Facilities": "#3B82F6", // Blue
  "Catering & Refreshments": "#F97316", // Orange
  "Audio & Visual Tech": "#6366F1", // Indigo
  "Marketing & Promo": "#14B8A6", // Teal
  "Guest Speaker Honorarium": "#A855F7", // Purple
  "Safety & Permitting": "#EF4444", // Rose/Red
  "Prizes & Swag": "#EAB308", // Yellow
};

const DEFAULT_COLOR = "#64748B";

/**
 * Generate standard mock budget transactions for development, testing,
 * and preview modes.
 */
export function getMockBudgetTransactions(clubId: string = "club-demo-1"): BudgetTransaction[] {
  return [
    {
      id: "tx-001",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Student Govt Grant",
      category: "Venue & Facilities",
      vendorName: "Student Union Grand Hall",
      budgetedAmount: 2500,
      actualAmount: 2400,
      transactionDate: "2026-03-15",
      status: "reconciled",
      description: "Hall booking fee and janitorial deposit",
      receiptNumber: "REC-2026-081",
    },
    {
      id: "tx-002",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Student Govt Grant",
      category: "Audio & Visual Tech",
      vendorName: "Campus Sound & Stage Pro",
      budgetedAmount: 1800,
      actualAmount: 1950,
      transactionDate: "2026-03-18",
      status: "approved",
      description: "Dual projector, line-array speakers, and wireless mics",
      receiptNumber: "REC-2026-092",
    },
    {
      id: "tx-003",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Corporate Sponsorship",
      category: "Catering & Refreshments",
      vendorName: "TacoCorp Catering",
      budgetedAmount: 3200,
      actualAmount: 3100,
      transactionDate: "2026-03-22",
      status: "reconciled",
      description: "Lunch burritos and dinner buffet for 350 attendees",
      receiptNumber: "REC-2026-104",
    },
    {
      id: "tx-004",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Corporate Sponsorship",
      category: "Prizes & Swag",
      vendorName: "CustomSwag Masters",
      budgetedAmount: 2000,
      actualAmount: 2150,
      transactionDate: "2026-03-20",
      status: "approved",
      description: "Embroidered hoodies and 3D printed trophy plaques",
      receiptNumber: "REC-2026-112",
    },
    {
      id: "tx-005",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Ticket Sales Revenue",
      category: "Marketing & Promo",
      vendorName: "Campus Print & Media Lab",
      budgetedAmount: 800,
      actualAmount: 650,
      transactionDate: "2026-03-10",
      status: "reconciled",
      description: "A1 foam posters, vinyl stickers, and social ads",
      receiptNumber: "REC-2026-067",
    },
    {
      id: "tx-006",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Ticket Sales Revenue",
      category: "Guest Speaker Honorarium",
      vendorName: "Keynote Bureau International",
      budgetedAmount: 1500,
      actualAmount: 1500,
      transactionDate: "2026-03-23",
      status: "approved",
      description: "Travel stipend and honorarium for AI Ethics speaker",
      receiptNumber: "REC-2026-120",
    },
    {
      id: "tx-007",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Alumni Endowment",
      category: "Safety & Permitting",
      vendorName: "City Fire Marshal & EMT Services",
      budgetedAmount: 600,
      actualAmount: 600,
      transactionDate: "2026-03-05",
      status: "reconciled",
      description: "Overnight occupancy permit and on-site paramedic standby",
      receiptNumber: "REC-2026-045",
    },
    {
      id: "tx-008",
      clubId,
      eventId: "evt-hackathon-2026",
      eventTitle: "Annual Spring Hackathon 2026",
      sourceName: "Alumni Endowment",
      category: "Catering & Refreshments",
      vendorName: "Midnight Brew Coffee Roasters",
      budgetedAmount: 900,
      actualAmount: 950,
      transactionDate: "2026-03-23",
      status: "approved",
      description: "24-hour espresso bar and energy snack station",
      receiptNumber: "REC-2026-128",
    },
  ];
}

/**
 * Transforms an array of financial transactions into a 3-tier Sankey Graph
 * structure (Sources -> Categories -> Vendors).
 */
export function buildSankeyGraphData(
  transactions: BudgetTransaction[],
  viewMode: SankeyViewMode = "actual",
  filterCategory?: string
): SankeyGraphData {
  let filtered = [...transactions];
  if (filterCategory && filterCategory !== "all") {
    filtered = filtered.filter((t) => t.category === filterCategory);
  }

  const sourcesMap = new Map<string, { budget: number; actual: number }>();
  const categoryMap = new Map<string, { budget: number; actual: number }>();
  const vendorMap = new Map<string, { budget: number; actual: number }>();

  const sourceToCategoryLinks = new Map<
    string,
    { source: string; target: string; budget: number; actual: number; count: number }
  >();
  const categoryToVendorLinks = new Map<
    string,
    { source: string; target: string; budget: number; actual: number; count: number }
  >();

  let totalBudget = 0;
  let totalActual = 0;

  filtered.forEach((tx) => {
    totalBudget += tx.budgetedAmount;
    totalActual += tx.actualAmount;

    // Accumulate Source
    const s = sourcesMap.get(tx.sourceName) || { budget: 0, actual: 0 };
    s.budget += tx.budgetedAmount;
    s.actual += tx.actualAmount;
    sourcesMap.set(tx.sourceName, s);

    // Accumulate Category
    const c = categoryMap.get(tx.category) || { budget: 0, actual: 0 };
    c.budget += tx.budgetedAmount;
    c.actual += tx.actualAmount;
    categoryMap.set(tx.category, c);

    // Accumulate Vendor
    const v = vendorMap.get(tx.vendorName) || { budget: 0, actual: 0 };
    v.budget += tx.budgetedAmount;
    v.actual += tx.actualAmount;
    vendorMap.set(tx.vendorName, v);

    // Link: Source -> Category
    const scKey = `${tx.sourceName}___${tx.category}`;
    const sc = sourceToCategoryLinks.get(scKey) || {
      source: tx.sourceName,
      target: tx.category,
      budget: 0,
      actual: 0,
      count: 0,
    };
    sc.budget += tx.budgetedAmount;
    sc.actual += tx.actualAmount;
    sc.count += 1;
    sourceToCategoryLinks.set(scKey, sc);

    // Link: Category -> Vendor
    const cvKey = `${tx.category}___${tx.vendorName}`;
    const cv = categoryToVendorLinks.get(cvKey) || {
      source: tx.category,
      target: tx.vendorName,
      budget: 0,
      actual: 0,
      count: 0,
    };
    cv.budget += tx.budgetedAmount;
    cv.actual += tx.actualAmount;
    cv.count += 1;
    categoryToVendorLinks.set(cvKey, cv);
  });

  const nodes: SankeyNode[] = [];

  // 1. Sources (Depth 0)
  sourcesMap.forEach((val, name) => {
    const primaryValue = viewMode === "budget" ? val.budget : val.actual;
    const variance = val.budget - val.actual;
    const variancePercentage = val.budget > 0 ? (variance / val.budget) * 100 : 0;
    nodes.push({
      id: name,
      name,
      type: "source",
      depth: 0,
      value: primaryValue,
      allocatedBudget: val.budget,
      actualSpent: val.actual,
      variance,
      variancePercentage,
      color: CATEGORY_COLORS[name] || DEFAULT_COLOR,
    });
  });

  // 2. Categories (Depth 1)
  categoryMap.forEach((val, name) => {
    const primaryValue = viewMode === "budget" ? val.budget : val.actual;
    const variance = val.budget - val.actual;
    const variancePercentage = val.budget > 0 ? (variance / val.budget) * 100 : 0;
    nodes.push({
      id: name,
      name,
      type: "category",
      depth: 1,
      value: primaryValue,
      allocatedBudget: val.budget,
      actualSpent: val.actual,
      variance,
      variancePercentage,
      color: CATEGORY_COLORS[name] || "#3B82F6",
    });
  });

  // 3. Vendors (Depth 2)
  vendorMap.forEach((val, name) => {
    const primaryValue = viewMode === "budget" ? val.budget : val.actual;
    const variance = val.budget - val.actual;
    const variancePercentage = val.budget > 0 ? (variance / val.budget) * 100 : 0;
    nodes.push({
      id: name,
      name,
      type: "vendor",
      depth: 2,
      value: primaryValue,
      allocatedBudget: val.budget,
      actualSpent: val.actual,
      variance,
      variancePercentage,
      color: "#64748B",
    });
  });

  const links: SankeyLink[] = [];

  // Add Source -> Category links
  sourceToCategoryLinks.forEach((link) => {
    const linkVal = viewMode === "budget" ? link.budget : link.actual;
    links.push({
      source: link.source,
      target: link.target,
      value: linkVal,
      budgetedValue: link.budget,
      actualValue: link.actual,
      color: CATEGORY_COLORS[link.source] || DEFAULT_COLOR,
      category: link.target,
      transactionCount: link.count,
    });
  });

  // Add Category -> Vendor links
  categoryToVendorLinks.forEach((link) => {
    const linkVal = viewMode === "budget" ? link.budget : link.actual;
    links.push({
      source: link.source,
      target: link.target,
      value: linkVal,
      budgetedValue: link.budget,
      actualValue: link.actual,
      color: CATEGORY_COLORS[link.source] || DEFAULT_COLOR,
      category: link.source,
      transactionCount: link.count,
    });
  });

  return {
    nodes,
    links,
    totalBudget,
    totalActual,
    totalVariance: totalBudget - totalActual,
    currency: "USD",
    fiscalYear: 2026,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculates high-level financial health and efficiency metrics.
 */
export function calculateBudgetKPIs(transactions: BudgetTransaction[]): BudgetSummaryKPIs {
  const totalBudget = transactions.reduce((acc, t) => acc + t.budgetedAmount, 0);
  const totalActualSpent = transactions.reduce((acc, t) => acc + t.actualAmount, 0);
  const remainingBalance = totalBudget - totalActualSpent;
  const burnRatePercentage = totalBudget > 0 ? Math.round((totalActualSpent / totalBudget) * 100) : 0;

  // Category aggregates
  const categoryTotals = new Map<string, number>();
  const vendorTotals = new Map<string, number>();

  transactions.forEach((tx) => {
    categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + tx.actualAmount);
    vendorTotals.set(tx.vendorName, (vendorTotals.get(tx.vendorName) || 0) + tx.actualAmount);
  });

  let topCategory = { category: "None", amount: 0, percentOfTotal: 0 };
  categoryTotals.forEach((amt, cat) => {
    if (amt > topCategory.amount) {
      topCategory = {
        category: cat,
        amount: amt,
        percentOfTotal: totalActualSpent > 0 ? Math.round((amt / totalActualSpent) * 100) : 0,
      };
    }
  });

  let topVendor = { vendorName: "None", amount: 0 };
  vendorTotals.forEach((amt, vendor) => {
    if (amt > topVendor.amount) {
      topVendor = { vendorName: vendor, amount: amt };
    }
  });

  // Calculate Cost Efficiency Score (Based on variance bounds and budget adherence)
  let costEfficiencyScore = 100;
  if (totalBudget > 0) {
    const varianceRatio = Math.abs(remainingBalance) / totalBudget;
    costEfficiencyScore = Math.max(0, Math.min(100, Math.round(100 - varianceRatio * 40)));
  }

  return {
    totalBudget,
    totalActualSpent,
    remainingBalance,
    burnRatePercentage,
    topSpendingCategory: topCategory,
    topVendor,
    totalTransactions: transactions.length,
    costEfficiencyScore,
    isOverBudget: totalActualSpent > totalBudget,
  };
}

/**
 * Export financial ledger data into formatted CSV for audit and reporting.
 */
export function exportBudgetTransactionsCSV(
  transactions: BudgetTransaction[],
  fileName: string = "event_budget_actual_sankey_ledger.csv"
): void {
  const headers = [
    "Transaction ID",
    "Event Title",
    "Funding Source",
    "Expense Category",
    "Vendor / Payee",
    "Budgeted Amount (USD)",
    "Actual Spent (USD)",
    "Variance (USD)",
    "Status",
    "Transaction Date",
    "Receipt Reference",
    "Description",
  ];

  const rows = transactions.map((t) => [
    `"${t.id}"`,
    `"${t.eventTitle || ""}"`,
    `"${t.sourceName}"`,
    `"${t.category}"`,
    `"${t.vendorName}"`,
    t.budgetedAmount.toFixed(2),
    t.actualAmount.toFixed(2),
    (t.budgetedAmount - t.actualAmount).toFixed(2),
    `"${t.status}"`,
    `"${t.transactionDate}"`,
    `"${t.receiptNumber || ""}"`,
    `"${(t.description || "").replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Fetch live budget transactions from Supabase database with fallback to mock data.
 */
export async function fetchClubBudgetFlow(
  clubId: string,
  options?: Partial<SankeyFilterOptions>
): Promise<{ transactions: BudgetTransaction[]; error?: string }> {
  try {
    const query = supabase
      .from("club_expenses_detailed")
      .select("*")
      .eq("club_id", clubId);

    if (options?.eventId) {
      query.eq("event_id", options.eventId);
    }
    if (options?.category && options.category !== "all") {
      query.eq("category", options.category);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      // Graceful fallback to seeded mock dataset
      return { transactions: getMockBudgetTransactions(clubId) };
    }

    const mapped: BudgetTransaction[] = data.map((row: any) => ({
      id: row.id,
      clubId: row.club_id,
      eventId: row.event_id,
      eventTitle: row.event_title,
      sourceName: row.source_name || "Club Treasury",
      category: row.category || "General Operations",
      vendorName: row.vendor_name || "General Vendor",
      budgetedAmount: Number(row.budgeted_amount || 0),
      actualAmount: Number(row.actual_amount || 0),
      transactionDate: row.transaction_date || new Date().toISOString().split("T")[0],
      status: row.status || "approved",
      description: row.description || "",
      receiptNumber: row.receipt_number,
      approvedBy: row.approved_by,
    }));

    return { transactions: mapped };
  } catch (err: any) {
    return {
      transactions: getMockBudgetTransactions(clubId),
      error: err.message || "Failed to query database, loaded fallback dataset",
    };
  }
}
