export interface EventFinancialTransaction {
  id: string;
  eventId: string;
  type: "revenue" | "expense";
  category: string;
  amount: number;
  description?: string;
}

export interface SankeyNode {
  id: string;
  name: string;
  nodeType: "revenue_source" | "pool" | "expense_category" | "net_outcome";
  color: string;
  value: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface EventRoiSummary {
  eventId: string;
  eventTitle: string;
  totalRevenue: number;
  totalExpenses: number;
  netAmount: number;
  roiPercentage: number;
  isProfit: boolean;
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/**
 * Formats a numeric amount into USD currency string (#4280).
 */
export function formatCurrency(amount: number): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(abs);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Aggregates event transactions into a multi-tier Sankey Flow and calculates ROI (#4280).
 */
export function aggregateEventTransactions(
  transactions: EventFinancialTransaction[],
  eventTitle: string = "Campus Event"
): EventRoiSummary {
  if (!transactions || transactions.length === 0) {
    return {
      eventId: "default",
      eventTitle,
      totalRevenue: 0,
      totalExpenses: 0,
      netAmount: 0,
      roiPercentage: 0,
      isProfit: true,
      nodes: [],
      links: [],
    };
  }

  const eventId = transactions[0]?.eventId || "evt-1";
  const revenueMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  let totalRevenue = 0;
  let totalExpenses = 0;

  transactions.forEach((tx) => {
    const amt = Math.max(0, tx.amount);
    if (tx.type === "revenue") {
      totalRevenue += amt;
      revenueMap.set(tx.category, (revenueMap.get(tx.category) || 0) + amt);
    } else if (tx.type === "expense") {
      totalExpenses += amt;
      expenseMap.set(tx.category, (expenseMap.get(tx.category) || 0) + amt);
    }
  });

  const netAmount = totalRevenue - totalExpenses;
  const isProfit = netAmount >= 0;
  const roiPercentage =
    totalExpenses > 0
      ? Math.round(((totalRevenue - totalExpenses) / totalExpenses) * 1000) / 10
      : 0;

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  // Pool Node
  const poolNodeId = "pool-event-capital";
  nodes.push({
    id: poolNodeId,
    name: `${eventTitle} Budget Pool`,
    nodeType: "pool",
    color: "#3b82f6", // Blue
    value: totalRevenue,
  });

  // Revenue Source Nodes & Links -> Pool
  Array.from(revenueMap.entries()).forEach(([cat, val]) => {
    const nodeId = `rev-${cat.toLowerCase().replace(/\s+/g, "-")}`;
    nodes.push({
      id: nodeId,
      name: cat,
      nodeType: "revenue_source",
      color: "#06b6d4", // Cyan
      value: val,
    });
    links.push({
      source: nodeId,
      target: poolNodeId,
      value: val,
    });
  });

  // Expense Category Nodes & Links Pool -> Expenses
  Array.from(expenseMap.entries()).forEach(([cat, val]) => {
    const nodeId = `exp-${cat.toLowerCase().replace(/\s+/g, "-")}`;
    nodes.push({
      id: nodeId,
      name: cat,
      nodeType: "expense_category",
      color: "#f59e0b", // Amber
      value: val,
    });
    links.push({
      source: poolNodeId,
      target: nodeId,
      value: val,
    });
  });

  // Final Net Outcome Node (Emerald for Profit, BOLD RED for Loss per Issue #4280)
  const netNodeId = "net-outcome";
  nodes.push({
    id: netNodeId,
    name: isProfit ? `Net Profit (${formatCurrency(netAmount)})` : `Net Loss (${formatCurrency(netAmount)})`,
    nodeType: "net_outcome",
    color: isProfit ? "#10b981" : "#ef4444", // Bold Red on Loss!
    value: Math.abs(netAmount),
  });

  if (isProfit && netAmount > 0) {
    links.push({
      source: poolNodeId,
      target: netNodeId,
      value: netAmount,
    });
  }

  return {
    eventId,
    eventTitle,
    totalRevenue,
    totalExpenses,
    netAmount,
    roiPercentage,
    isProfit,
    nodes,
    links,
  };
}
