// =============================================================================
// File: src/components/budget/EventBudgetSankeyDiagram.tsx
// Issue: #3947 - Build an 'Interactive "Event Budget vs Actual" Sankey Diagram'
// Description: High-density, interactive SVG Sankey Diagram visualizing multi-tier
//              funds flow (Sources -> Categories -> Vendors) with variance metrics,
//              interactive link inspection, and CSV export.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Download,
  Filter,
  Layers,
  FileSpreadsheet,
  Info,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  PieChart,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  BudgetTransaction,
  SankeyNode,
  SankeyLink,
  SankeyViewMode,
} from "@/types/budgetSankey";
import {
  buildSankeyGraphData,
  calculateBudgetKPIs,
  exportBudgetTransactionsCSV,
  getMockBudgetTransactions,
} from "@/services/budgetSankeyService";

interface EventBudgetSankeyDiagramProps {
  clubId?: string;
  clubName?: string;
  initialTransactions?: BudgetTransaction[];
  onTransactionSelect?: (transaction: BudgetTransaction) => void;
}

export const EventBudgetSankeyDiagram: React.FC<EventBudgetSankeyDiagramProps> = ({
  clubId = "club-demo-1",
  clubName = "Robotics & Innovation Guild",
  initialTransactions,
  onTransactionSelect,
}) => {
  const [transactions] = useState<BudgetTransaction[]>(
    initialTransactions && initialTransactions.length > 0
      ? initialTransactions
      : getMockBudgetTransactions(clubId)
  );

  const [viewMode, setViewMode] = useState<SankeyViewMode>("actual");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<SankeyNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<SankeyLink | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("sankey");

  // Extract unique categories for filtering
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [transactions]);

  // Derived graph & KPI datasets
  const graphData = useMemo(() => {
    return buildSankeyGraphData(transactions, viewMode, selectedCategory);
  }, [transactions, viewMode, selectedCategory]);

  const kpis = useMemo(() => {
    return calculateBudgetKPIs(transactions);
  }, [transactions]);

  // Filtered transactions for Inspector modal
  const inspectorTransactions = useMemo(() => {
    if (selectedLink) {
      return transactions.filter(
        (t) =>
          (t.sourceName === selectedLink.source && t.category === selectedLink.target) ||
          (t.category === selectedLink.source && t.vendorName === selectedLink.target)
      );
    }
    if (selectedNode) {
      return transactions.filter(
        (t) =>
          t.sourceName === selectedNode.name ||
          t.category === selectedNode.name ||
          t.vendorName === selectedNode.name
      );
    }
    return [];
  }, [selectedNode, selectedLink, transactions]);

  // Layout calculations for custom SVG Sankey diagram
  const svgWidth = 840;
  const svgHeight = 440;
  const paddingX = 40;
  const paddingY = 30;
  const colWidth = 14;

  const colX = [
    paddingX, // Depth 0: Sources
    svgWidth / 2 - colWidth / 2, // Depth 1: Categories
    svgWidth - paddingX - colWidth, // Depth 2: Vendors
  ];

  // Group nodes by depth
  const depthNodes = useMemo(() => {
    const d0 = graphData.nodes.filter((n) => n.depth === 0);
    const d1 = graphData.nodes.filter((n) => n.depth === 1);
    const d2 = graphData.nodes.filter((n) => n.depth === 2);
    return [d0, d1, d2];
  }, [graphData.nodes]);

  // Compute node Y positions and heights
  const layoutNodes = useMemo(() => {
    const result = new Map<string, { x: number; y: number; height: number; node: SankeyNode }>();
    const usableHeight = svgHeight - paddingY * 2;

    depthNodes.forEach((nodes, colIndex) => {
      const totalVal = nodes.reduce((sum, n) => sum + (n.value || 1), 0);
      const gap = nodes.length > 1 ? Math.min(16, (usableHeight * 0.25) / (nodes.length - 1)) : 0;
      const heightForNodes = usableHeight - gap * (nodes.length - 1);

      let currentY = paddingY;
      nodes.forEach((n) => {
        const h = Math.max(18, Math.round(((n.value || 1) / (totalVal || 1)) * heightForNodes));
        result.set(n.id, {
          x: colX[colIndex],
          y: currentY,
          height: h,
          node: n,
        });
        currentY += h + gap;
      });
    });

    return result;
  }, [depthNodes, svgHeight, colX]);

  // Helper to generate SVG Bézier ribbon curve paths
  const generateLinkPath = (link: SankeyLink) => {
    const src = layoutNodes.get(link.source);
    const tgt = layoutNodes.get(link.target);
    if (!src || !tgt) return "";

    const x0 = src.x + colWidth;
    const y0 = src.y + src.height / 2;
    const x1 = tgt.x;
    const y1 = tgt.y + tgt.height / 2;
    const curvature = 0.5;
    const xi = d3Interpolate(x0, x1, curvature);

    const thickness = Math.max(
      4,
      Math.min(32, ((link.value || 1) / (graphData.totalActual || graphData.totalBudget || 1)) * 120)
    );

    const half = thickness / 2;
    return `M ${x0} ${y0 - half} 
            C ${xi} ${y0 - half}, ${x1 - (xi - x0)} ${y1 - half}, ${x1} ${y1 - half} 
            L ${x1} ${y1 + half} 
            C ${x1 - (xi - x0)} ${y1 + half}, ${xi} ${y0 + half}, ${x0} ${y0 + half} 
            Z`;
  };

  function d3Interpolate(a: number, b: number, factor: number) {
    return a + (b - a) * factor;
  }

  const handleNodeClick = (node: SankeyNode) => {
    setSelectedLink(null);
    setSelectedNode(node);
    setIsInspectorOpen(true);
  };

  const handleLinkClick = (link: SankeyLink) => {
    setSelectedNode(null);
    setSelectedLink(link);
    setIsInspectorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls Station */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <DollarSign className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Event Budget vs. Actual Flow
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Interactive Financial Sankey Diagram & Transparancy Ledger • {clubName}
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border-2 border-black bg-zinc-100 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setViewMode("actual")}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                  viewMode === "actual"
                    ? "bg-black text-white dark:bg-lime dark:text-black"
                    : "text-zinc-700 hover:text-black dark:text-zinc-300"
                }`}
              >
                Actual Spend
              </button>
              <button
                type="button"
                onClick={() => setViewMode("budget")}
                className={`px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors ${
                  viewMode === "budget"
                    ? "bg-black text-white dark:bg-lime dark:text-black"
                    : "text-zinc-700 hover:text-black dark:text-zinc-300"
                }`}
              >
                Planned Budget
              </button>
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                aria-label="Filter expenditure category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="neu-border h-9 bg-white px-3 font-mono text-xs font-bold uppercase text-zinc-800 dark:bg-zinc-800 dark:text-white"
              >
                <option value="all">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* CSV Export */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportBudgetTransactionsCSV(transactions)}
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* High-Level Metric KPI Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Total Budget
            </span>
            <div className="mt-1 font-mono text-lg font-black text-zinc-900 dark:text-white">
              ${kpis.totalBudget.toLocaleString()}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <Layers className="h-3 w-3" /> Allocated Total
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Actual Outflow
            </span>
            <div className="mt-1 font-mono text-lg font-black text-blue-600 dark:text-blue-400">
              ${kpis.totalActualSpent.toLocaleString()}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <Receipt className="h-3 w-3" /> Reconciled Spend
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Remaining Variance
            </span>
            <div
              className={`mt-1 font-mono text-lg font-black ${
                kpis.remainingBalance >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {kpis.remainingBalance >= 0 ? "+" : ""}${kpis.remainingBalance.toLocaleString()}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              {kpis.remainingBalance >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-rose-500" />
              )}
              {kpis.burnRatePercentage}% Burn Rate
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Top Category
            </span>
            <div className="mt-1 truncate font-mono text-sm font-black text-zinc-900 dark:text-white">
              {kpis.topSpendingCategory.category}
            </div>
            <div className="mt-0.5 font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              ${kpis.topSpendingCategory.amount.toLocaleString()} (
              {kpis.topSpendingCategory.percentOfTotal}%)
            </div>
          </div>

          <div className="neu-border bg-zinc-50 p-3.5 dark:bg-zinc-800/80">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Cost Efficiency
            </span>
            <div className="mt-1 font-mono text-lg font-black text-amber-600 dark:text-amber-400">
              {kpis.costEfficiencyScore}/100
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
              <Sparkles className="h-3 w-3 text-amber-500" /> High Adherence
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Visualizer Surface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="neu-border grid w-full max-w-md grid-cols-2 bg-white p-1 dark:bg-zinc-900">
          <TabsTrigger
            value="sankey"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Sankey Flow Visualizer
          </TabsTrigger>
          <TabsTrigger
            value="table"
            className="font-mono text-xs font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white dark:data-[state=active]:bg-lime dark:data-[state=active]:text-black"
          >
            Itemized Ledger Table
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Interactive Sankey Diagram */}
        <TabsContent value="sankey" className="mt-4">
          <div className="neu-border relative overflow-x-auto bg-white p-4 dark:bg-zinc-900">
            {/* Column Title Legend */}
            <div className="mb-2 grid grid-cols-3 px-8 text-center font-mono text-xs font-black uppercase text-zinc-600 dark:text-zinc-400">
              <div className="text-left">1. Funding Sources</div>
              <div className="text-center">2. Allocation Categories</div>
              <div className="text-right">3. Vendors & Payees</div>
            </div>

            {/* SVG Visual Flow Diagram */}
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full select-none"
              style={{ minWidth: "700px" }}
            >
              <defs>
                {graphData.links.map((link, idx) => {
                  const src = layoutNodes.get(link.source);
                  const tgt = layoutNodes.get(link.target);
                  const srcColor = src?.node.color || "#3B82F6";
                  const tgtColor = tgt?.node.color || "#64748B";
                  return (
                    <linearGradient
                      key={`grad-${idx}`}
                      id={`grad-${link.source}-${link.target}`.replace(/\s+/g, "_")}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor={srcColor} stopOpacity={0.65} />
                      <stop offset="100%" stopColor={tgtColor} stopOpacity={0.65} />
                    </linearGradient>
                  );
                })}
              </defs>

              {/* Render Flow Links */}
              <g className="sankey-links">
                {graphData.links.map((link) => {
                  const linkKey = `${link.source}___${link.target}`;
                  const isHovered = hoveredLinkId === linkKey;
                  const isSourceHovered = hoveredNodeId === link.source;
                  const isTargetHovered = hoveredNodeId === link.target;
                  const isActive = isHovered || isSourceHovered || isTargetHovered;

                  return (
                    <path
                      key={linkKey}
                      d={generateLinkPath(link)}
                      fill={`url(#${`grad-${link.source}-${link.target}`.replace(/\s+/g, "_")})`}
                      opacity={hoveredNodeId || hoveredLinkId ? (isActive ? 0.95 : 0.15) : 0.65}
                      stroke={isActive ? "#000" : "none"}
                      strokeWidth={isActive ? 1.5 : 0}
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredLinkId(linkKey)}
                      onMouseLeave={() => setHoveredLinkId(null)}
                      onClick={() => handleLinkClick(link)}
                    >
                      <title>{`${link.source} → ${link.target}: $${link.value.toLocaleString()} (${viewMode.toUpperCase()})`}</title>
                    </path>
                  );
                })}
              </g>

              {/* Render Nodes */}
              <g className="sankey-nodes">
                {Array.from(layoutNodes.entries()).map(([id, { x, y, height, node }]) => {
                  const isHovered = hoveredNodeId === id;
                  const isConnected =
                    hoveredLinkId &&
                    (hoveredLinkId.startsWith(`${id}___`) || hoveredLinkId.endsWith(`___${id}`));
                  const isHighlighted = isHovered || isConnected;

                  const textAnchor =
                    node.depth === 0 ? "start" : node.depth === 2 ? "end" : "middle";
                  const textX =
                    node.depth === 0 ? x + colWidth + 8 : node.depth === 2 ? x - 8 : x + colWidth / 2;
                  const textY = y + height / 2 + 4;

                  return (
                    <g
                      key={id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredNodeId(id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onClick={() => handleNodeClick(node)}
                    >
                      {/* Node Rect */}
                      <rect
                        x={x}
                        y={y}
                        width={colWidth}
                        height={height}
                        fill={node.color || "#3B82F6"}
                        stroke="#000"
                        strokeWidth={isHighlighted ? 2.5 : 1.5}
                        rx={2}
                        className="transition-all duration-150"
                      />

                      {/* Node Text Label */}
                      <text
                        x={textX}
                        y={textY}
                        textAnchor={textAnchor}
                        className="select-none font-mono text-[11px] font-bold"
                        fill="currentColor"
                      >
                        <tspan className="fill-zinc-900 dark:fill-zinc-100">{node.name}</tspan>
                        <tspan className="fill-zinc-500 text-[10px]">
                          {" "}
                          (${node.value.toLocaleString()})
                        </tspan>
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Interactive hint banner */}
            <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-blue-500" />
                <span>
                  Click any ribbon flow or node card to inspect granular transaction receipts &
                  vendor invoices.
                </span>
              </div>
              <span className="font-mono font-bold uppercase">
                Showing: {viewMode === "actual" ? "Actual Reconciled Spend" : "Initial Planned Budget"}
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Itemized Ledger Table */}
        <TabsContent value="table" className="mt-4">
          <div className="neu-border overflow-hidden bg-white dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b-2 border-black bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                  <tr>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">ID</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Funding Source</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Category</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white">Vendor / Payee</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white text-right">Budget</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white text-right">Actual</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white text-right">Variance</th>
                    <th className="p-3 font-black uppercase text-zinc-900 dark:text-white text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {transactions.map((tx) => {
                    const variance = tx.budgetedAmount - tx.actualAmount;
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => onTransactionSelect?.(tx)}
                        className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      >
                        <td className="p-3 font-bold text-zinc-600 dark:text-zinc-400">{tx.id}</td>
                        <td className="p-3 font-semibold text-zinc-900 dark:text-white">{tx.sourceName}</td>
                        <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">{tx.category}</td>
                        <td className="p-3 text-zinc-700 dark:text-zinc-300">{tx.vendorName}</td>
                        <td className="p-3 text-right font-semibold">${tx.budgetedAmount.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-zinc-900 dark:text-white">
                          ${tx.actualAmount.toLocaleString()}
                        </td>
                        <td
                          className={`p-3 text-right font-bold ${
                            variance >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {variance >= 0 ? "+" : ""}${variance.toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tx.status === "reconciled"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Inspector Modal for Flow Path / Node Details */}
      <Dialog open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
        <DialogContent className="neu-border max-w-2xl bg-white p-6 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase text-zinc-900 dark:text-white">
              <Building2 className="h-5 w-5 text-blue-600" />
              {selectedLink
                ? `Flow Path: ${selectedLink.source} → ${selectedLink.target}`
                : `Entity Inspector: ${selectedNode?.name}`}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              Audit trail, line-item ledger entries, and vendor reconciliation details.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Metric Summary Box */}
            <div className="grid grid-cols-3 gap-2 rounded border-2 border-black bg-zinc-50 p-3 dark:bg-zinc-800">
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500">Allocated Budget</span>
                <p className="font-mono text-sm font-bold text-zinc-900 dark:text-white">
                  ${selectedLink?.budgetedValue?.toLocaleString() ||
                    selectedNode?.allocatedBudget?.toLocaleString() ||
                    "0"}
                </p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500">Actual Outflow</span>
                <p className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                  ${selectedLink?.actualValue?.toLocaleString() ||
                    selectedNode?.actualSpent?.toLocaleString() ||
                    "0"}
                </p>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-500">Variance</span>
                <p className="font-mono text-sm font-bold text-emerald-600">
                  ${((selectedLink?.budgetedValue || selectedNode?.allocatedBudget || 0) -
                    (selectedLink?.actualValue || selectedNode?.actualSpent || 0)).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Itemized Transactions */}
            <div>
              <h4 className="mb-2 font-mono text-xs font-black uppercase text-zinc-800 dark:text-zinc-200">
                Itemized Receipts & Invoices ({inspectorTransactions.length})
              </h4>
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {inspectorTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="neu-border flex items-center justify-between bg-white p-3 dark:bg-zinc-800"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                        {tx.description}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                        {tx.vendorName} • {tx.transactionDate} • Ref: {tx.receiptNumber || "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-black text-zinc-900 dark:text-white">
                        ${tx.actualAmount.toLocaleString()}
                      </p>
                      <span className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventBudgetSankeyDiagram;
