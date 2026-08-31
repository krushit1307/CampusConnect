import { describe, it, expect } from "vitest";
import {
  aggregateEventTransactions,
  formatCurrency,
  EventFinancialTransaction,
} from "./eventRoiVisualization";

describe("Event ROI & Sankey Flow Engine Utility (#4280)", () => {
  const mockProfitTxs: EventFinancialTransaction[] = [
    { id: "tx-1", eventId: "e-1", type: "revenue", category: "Ticket Sales", amount: 2000 },
    { id: "tx-2", eventId: "e-1", type: "revenue", category: "Sponsorships", amount: 1000 },
    { id: "tx-3", eventId: "e-1", type: "expense", category: "Catering", amount: 1200 },
    { id: "tx-4", eventId: "e-1", type: "expense", category: "Venue Hire", amount: 800 },
  ];

  const mockLossTxs: EventFinancialTransaction[] = [
    { id: "tx-1", eventId: "e-2", type: "revenue", category: "Ticket Sales", amount: 500 },
    { id: "tx-2", eventId: "e-2", type: "expense", category: "Catering", amount: 1500 },
    { id: "tx-3", eventId: "e-2", type: "expense", category: "AV & Lighting", amount: 600 },
  ];

  it("formats currency values correctly", () => {
    expect(formatCurrency(2500)).toBe("$2,500.00");
    expect(formatCurrency(-400)).toBe("-$400.00");
  });

  it("calculates Total Revenue, Total Expenses, Net Profit, and ROI percentage", () => {
    const summary = aggregateEventTransactions(mockProfitTxs, "Tech Gala 2026");

    expect(summary.totalRevenue).toBe(3000);
    expect(summary.totalExpenses).toBe(2000);
    expect(summary.netAmount).toBe(1000);
    expect(summary.isProfit).toBe(true);
    expect(summary.roiPercentage).toBe(50); // (1000 / 2000) * 100 = 50%
  });

  it("highlights Net Loss node in BOLD RED (#ef4444) when expenses exceed revenue", () => {
    const summaryLoss = aggregateEventTransactions(mockLossTxs, "Stargazing Party");

    expect(summaryLoss.isProfit).toBe(false);
    expect(summaryLoss.netAmount).toBe(-1600); // 500 - 2100 = -1600

    const netNode = summaryLoss.nodes.find((n) => n.nodeType === "net_outcome");
    expect(netNode?.color).toBe("#ef4444"); // Bold Red!
    expect(netNode?.name).toContain("Net Loss");
  });

  it("builds multi-tier Sankey nodes and links", () => {
    const summary = aggregateEventTransactions(mockProfitTxs, "Tech Gala 2026");

    expect(summary.nodes.some((n) => n.name === "Ticket Sales")).toBe(true);
    expect(summary.nodes.some((n) => n.name === "Catering")).toBe(true);
    expect(summary.links.some((l) => l.source.startsWith("rev-"))).toBe(true);
    expect(summary.links.some((l) => l.target.startsWith("exp-"))).toBe(true);
  });
});
