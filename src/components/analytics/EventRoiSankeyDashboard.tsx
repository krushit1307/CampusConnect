import React, { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Filter,
  Receipt,
  Sparkles,
} from "lucide-react";
import {
  EventFinancialTransaction,
  EventRoiSummary,
  aggregateEventTransactions,
  formatCurrency,
} from "@/lib/eventRoiVisualization";
import { cn } from "@/lib/utils";

export interface EventRoiSankeyDashboardProps {
  eventId?: string;
  eventTitle?: string;
  initialTransactions?: EventFinancialTransaction[];
  className?: string;
}

export const MOCK_EVENT_TRANSACTIONS: EventFinancialTransaction[] = [
  { id: "tx-1", eventId: "evt-gala-1", type: "revenue", category: "Ticket Sales", amount: 2000, description: "VIP & Early Bird ticket sales" },
  { id: "tx-2", eventId: "evt-gala-1", type: "revenue", category: "Sponsorships", amount: 1500, description: "Google & Microsoft event grants" },
  { id: "tx-3", eventId: "evt-gala-1", type: "revenue", category: "University Grant", amount: 800, description: "Student Activities Board Allocation" },
  { id: "tx-4", eventId: "evt-gala-1", type: "expense", category: "Catering & Refreshments", amount: 1800, description: "Buffet & beverages for 250 attendees" },
  { id: "tx-5", eventId: "evt-gala-1", type: "expense", category: "Venue Rental", amount: 900, description: "Main Auditorium evening booking" },
  { id: "tx-6", eventId: "evt-gala-1", type: "expense", category: "AV & Lighting Equipment", amount: 400, description: "Microphones & stage spotlighting" },
  { id: "tx-7", eventId: "evt-gala-1", type: "expense", category: "Marketing & Posters", amount: 200, description: "Vinyl banners & campus posters" },
];

export const EventRoiSankeyDashboard: React.FC<EventRoiSankeyDashboardProps> = ({
  eventId = "evt-gala-1",
  eventTitle = "Annual Campus Tech & Innovation Gala 2026",
  initialTransactions = MOCK_EVENT_TRANSACTIONS,
  className,
}) => {
  const [transactions, setTransactions] = useState<EventFinancialTransaction[]>(initialTransactions);
  const [filterType, setFilterType] = useState<"all" | "revenue" | "expense">("all");

  const roiSummary: EventRoiSummary = aggregateEventTransactions(transactions, eventTitle);

  const filteredTxs = transactions.filter((tx) => filterType === "all" || tx.type === filterType);

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-indigo-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-indigo-950">
            <PieChart className="w-5 h-5 text-indigo-700" />
            <span>Interactive "Event ROI" Visualization Dashboard — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Dynamic capital flow visualizer. Maps revenue inflows into expense categories and highlights net profit vs bold red loss nodes.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>Financial Sankey Flow</span>
        </span>
      </div>

      {/* Overview Metric Cards Grid */}
      <div className="p-5 bg-slate-50 border-b-2 border-black grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Revenue Inflows</span>
          <span className="text-2xl font-black text-emerald-600">{formatCurrency(roiSummary.totalRevenue)}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Tickets, Grants & Sponsors</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Expense Outflows</span>
          <span className="text-2xl font-black text-amber-600">{formatCurrency(roiSummary.totalExpenses)}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Catering, Venue & AV</span>
        </div>

        {/* Net Outcome Card (Bold Red on Net Loss per Issue #4280) */}
        <div
          className={cn(
            "p-3.5 border-2 border-black rounded-lg space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
            roiSummary.isProfit ? "bg-emerald-50" : "bg-red-100 border-red-600"
          )}
        >
          <span
            className={cn(
              "text-[10px] font-bold uppercase block",
              roiSummary.isProfit ? "text-emerald-900" : "text-red-900"
            )}
          >
            {roiSummary.isProfit ? "Net Profit" : "Net Loss"}
          </span>
          <span
            data-testid="net-outcome-amount"
            className={cn("text-2xl font-black", roiSummary.isProfit ? "text-emerald-600" : "text-red-600")}
          >
            {formatCurrency(roiSummary.netAmount)}
          </span>
          <span
            className={cn("text-[11px] font-sans block font-medium", roiSummary.isProfit ? "text-emerald-800" : "text-red-900")}
          >
            {roiSummary.isProfit ? "Surplus retained" : "⚠️ Deficit / Loss on Event"}
          </span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Financial ROI Rate</span>
          <span
            className={cn(
              "text-2xl font-black flex items-center gap-1",
              roiSummary.roiPercentage >= 0 ? "text-emerald-600" : "text-red-600"
            )}
          >
            {roiSummary.roiPercentage >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
            {roiSummary.roiPercentage > 0 ? `+${roiSummary.roiPercentage}%` : `${roiSummary.roiPercentage}%`}
          </span>
          <span className="text-[11px] font-sans text-gray-600 block">Return on capital invested</span>
        </div>
      </div>

      {/* Main Grid: Sankey Capital Flow Diagram & Ledger Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Visual Capital Flow Diagram (Sankey Flow Visualizer) */}
        <div className="lg:col-span-2 p-5 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-white">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Capital Flow Diagram (Revenue &rarr; Pool &rarr; Expenses & Net Outcome)
            </h4>
            <span className="text-[11px] font-sans text-gray-500">Multi-Tier Financial Map</span>
          </div>

          {/* Interactive Sankey Flow Visualizer Nodes */}
          <div className="p-4 border-2 border-black rounded-lg bg-slate-900 text-white space-y-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono text-xs">
            <div className="grid grid-cols-3 gap-4 border-b border-slate-700 pb-2 text-[10px] text-gray-400 uppercase font-bold">
              <div>1. Revenue Inflows</div>
              <div>2. Central Budget Pool</div>
              <div>3. Outflows & Net Outcome</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* Column 1: Revenue Source Nodes */}
              <div className="space-y-2">
                {roiSummary.nodes
                  .filter((n) => n.nodeType === "revenue_source")
                  .map((node) => (
                    <div
                      key={node.id}
                      className="p-2.5 rounded border border-cyan-500/40 bg-cyan-950/30 flex justify-between items-center text-xs"
                    >
                      <span className="font-bold text-cyan-300 truncate">{node.name}</span>
                      <span className="font-mono text-cyan-400 font-bold">{formatCurrency(node.value)}</span>
                    </div>
                  ))}
              </div>

              {/* Column 2: Pool Node */}
              <div className="p-4 border-2 border-blue-400 rounded-lg bg-blue-950/40 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-300 block">Event Capital Pool</span>
                <span className="text-xl font-black text-blue-200 block">{formatCurrency(roiSummary.totalRevenue)}</span>
              </div>

              {/* Column 3: Expense Nodes + Net Outcome Node */}
              <div className="space-y-2">
                {roiSummary.nodes
                  .filter((n) => n.nodeType === "expense_category")
                  .map((node) => (
                    <div
                      key={node.id}
                      className="p-2 border border-amber-500/40 bg-amber-950/30 flex justify-between items-center text-xs"
                    >
                      <span className="font-bold text-amber-300 truncate">{node.name}</span>
                      <span className="font-mono text-amber-400 font-bold">{formatCurrency(node.value)}</span>
                    </div>
                  ))}

                {/* Net Outcome Node (BOLD RED ON LOSS per Issue #4280) */}
                {roiSummary.nodes
                  .filter((n) => n.nodeType === "net_outcome")
                  .map((node) => (
                    <div
                      key={node.id}
                      data-testid="net-outcome-node"
                      className={cn(
                        "p-2.5 rounded border-2 flex justify-between items-center text-xs font-black shadow-md",
                        roiSummary.isProfit
                          ? "bg-emerald-950/60 border-emerald-500 text-emerald-300"
                          : "bg-red-950/90 border-red-600 text-red-300 font-black animate-pulse" // BOLD RED LOSS!
                      )}
                    >
                      <span>{node.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Breakdown Ledger Table */}
        <div className="lg:col-span-1 p-5 bg-slate-50 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-indigo-600" />
              Transactions Breakdown
            </h4>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded border",
                  filterType === "all" ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-300"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("revenue")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded border",
                  filterType === "revenue" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-300"
                )}
              >
                Inflows
              </button>
              <button
                type="button"
                onClick={() => setFilterType("expense")}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded border",
                  filterType === "expense" ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-700 border-gray-300"
                )}
              >
                Outflows
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredTxs.map((tx) => (
              <div
                key={tx.id}
                className="p-3 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">{tx.category}</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      tx.type === "revenue" ? "text-emerald-600" : "text-amber-600"
                    )}
                  >
                    {tx.type === "revenue" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </span>
                </div>
                {tx.description && (
                  <p className="text-[11px] font-sans text-gray-600 leading-snug">{tx.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
