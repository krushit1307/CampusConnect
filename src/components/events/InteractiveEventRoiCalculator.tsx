// =============================================================================
// File: src/components/events/InteractiveEventRoiCalculator.tsx
// Issue: #3941 - Build an 'Interactive Event Budget ROI' Calculator
// Description: High-density interactive break-even simulator, 2D sensitivity
//              matrix heatmap, expense line-item editor, and financial export.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  Trash2,
  Sliders,
  Scale,
  Sparkles,
  Layers,
  Save,
  Check,
  Building,
  Users,
  Grid,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  EventFinancialInputs,
  ExpenseItem,
  BreakEvenAnalysisResult,
} from "@/types/eventRoiCalculator";
import {
  getDefaultEventFinancialInputs,
  calculateEventBreakEven,
  generateSensitivityMatrix,
  generateScenarioComparisons,
  exportEventBudgetRoiCSV,
  saveEventBudgetForecast,
} from "@/services/eventRoiCalculatorService";

interface InteractiveEventRoiCalculatorProps {
  eventId?: string;
  eventTitle?: string;
  initialInputs?: EventFinancialInputs;
}

export const InteractiveEventRoiCalculator: React.FC<InteractiveEventRoiCalculatorProps> = ({
  eventId = "evt-demo-1",
  eventTitle = "Annual Spring Gala & Awards Night",
  initialInputs,
}) => {
  const [inputs, setInputs] = useState<EventFinancialInputs>(
    initialInputs || getDefaultEventFinancialInputs(eventId)
  );

  const [activeTab, setActiveTab] = useState("calculator");
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Dynamic calculations
  const analysis: BreakEvenAnalysisResult = useMemo(() => {
    return calculateEventBreakEven(inputs);
  }, [inputs]);

  const sensitivity = useMemo(() => {
    return generateSensitivityMatrix(inputs);
  }, [inputs]);

  const scenarios = useMemo(() => {
    return generateScenarioComparisons(inputs);
  }, [inputs]);

  // Handlers for sliders
  const handleTicketPriceChange = (price: number) => {
    setInputs((prev) => ({ ...prev, averageTicketPrice: price }));
  };

  const handleAttendanceRateChange = (rate: number) => {
    setInputs((prev) => ({ ...prev, expectedAttendanceRate: rate }));
  };

  const handleCapacityChange = (cap: number) => {
    setInputs((prev) => ({ ...prev, venueCapacity: cap }));
  };

  const handleVariableCostChange = (cost: number) => {
    setInputs((prev) => ({ ...prev, variableCostPerAttendee: cost }));
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseName.trim() || isNaN(Number(newExpenseAmount))) return;

    const newItem: ExpenseItem = {
      id: `exp-${Date.now()}`,
      name: newExpenseName.trim(),
      category: "misc",
      amount: Math.max(0, Number(newExpenseAmount)),
      isVariablePerAttendee: false,
    };

    setInputs((prev) => ({
      ...prev,
      fixedExpenses: [...prev.fixedExpenses, newItem],
    }));

    setNewExpenseName("");
    setNewExpenseAmount("");
  };

  const handleRemoveExpense = (id: string) => {
    setInputs((prev) => ({
      ...prev,
      fixedExpenses: prev.fixedExpenses.filter((e) => e.id !== id),
    }));
  };

  const handleSaveForecast = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    const res = await saveEventBudgetForecast(inputs, analysis);
    setIsSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Massive PnL Display */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Scale className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Event Budget & ROI Break-Even Simulator
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Interactive Financial Sensitivity Modeling & Solvency Analysis • {eventTitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportEventBudgetRoiCSV(inputs, analysis)}
              className="neu-border flex items-center gap-1.5 bg-zinc-100 font-mono text-xs font-bold uppercase text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV Plan
            </Button>

            <Button
              size="sm"
              onClick={handleSaveForecast}
              disabled={isSaving}
              className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
            >
              {saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-800" /> Saved!
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving..." : "Save Forecast"}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Hero Profit / Loss Metric Board */}
        <div
          className={`neu-border mt-6 p-5 transition-colors ${
            analysis.isProfitable
              ? "bg-emerald-50 border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-700"
              : "bg-rose-50 border-rose-500 dark:bg-rose-950/40 dark:border-rose-700"
          }`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black uppercase text-zinc-700 dark:text-zinc-300">
                  Projected Net Profit / (Loss)
                </span>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[10px] font-black uppercase ${
                    analysis.isProfitable
                      ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200"
                      : "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
                  }`}
                >
                  {analysis.isProfitable ? "SOLVENT & PROFITABLE" : "BUDGET DEFICIT WARNING"}
                </span>
              </div>

              <div
                className={`mt-1 font-mono text-4xl font-black ${
                  analysis.isProfitable
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {analysis.netProfitOrLoss >= 0 ? "+" : ""}$
                {analysis.netProfitOrLoss.toLocaleString()}
              </div>

              <div className="mt-1 flex items-center gap-3 font-mono text-xs font-bold text-zinc-600 dark:text-zinc-400">
                <span>Margin: {analysis.profitMarginPercent}%</span>
                <span>•</span>
                <span>ROI: {analysis.roiPercentage}%</span>
                <span>•</span>
                <span>
                  Expected Turnout: {analysis.projectedAttendees} / {inputs.venueCapacity} students
                </span>
              </div>
            </div>

            {/* Break-Even Gauge Box */}
            <div className="rounded border-2 border-black bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
              <span className="block font-mono text-[10px] font-bold uppercase text-zinc-500">
                Break-Even Threshold
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-mono text-2xl font-black text-zinc-900 dark:text-white">
                  {analysis.breakEvenTicketCount}
                </span>
                <span className="font-mono text-xs font-bold text-zinc-500">
                  tickets ({analysis.breakEvenAttendanceRate}% cap)
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
                <Sparkles className="h-3 w-3" />
                <span>
                  Safety Buffer: {analysis.marginOfSafetyTickets} tickets ({analysis.marginOfSafetyPercent}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Mini Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Gross Ticket Sales
            </span>
            <div className="mt-1 font-mono text-base font-black text-zinc-900 dark:text-white">
              ${analysis.grossTicketRevenue.toLocaleString()}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              ${inputs.averageTicketPrice} × {analysis.projectedAttendees} tickets
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Grants & Sponsorships
            </span>
            <div className="mt-1 font-mono text-base font-black text-purple-600 dark:text-purple-400">
              ${(inputs.confirmedSponsorshipRevenue + inputs.studentGovtGrant).toLocaleString()}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">External Subsidies</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Total Fixed Costs
            </span>
            <div className="mt-1 font-mono text-base font-black text-zinc-900 dark:text-white">
              ${analysis.totalFixedCosts.toLocaleString()}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              {inputs.fixedExpenses.length} Expense Items
            </span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Variable Catering & Drinks
            </span>
            <div className="mt-1 font-mono text-base font-black text-amber-600 dark:text-amber-400">
              ${analysis.totalVariableCosts.toLocaleString()}
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              ${inputs.variableCostPerAttendee}/attendee
            </span>
          </div>
        </div>
      </div>

      {/* Main Interactive Controls & Sliders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Col: Interactive Sliders & Expense Manager (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <div className="neu-border bg-white p-6 dark:bg-zinc-900">
            <div className="flex items-center gap-2 mb-4">
              <Sliders className="h-4 w-4 text-black dark:text-lime" />
              <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                Revenue & Attendance Drivers
              </h3>
            </div>

            <div className="space-y-5">
              {/* Slider 1: Ticket Price */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-mono text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">
                    Average Ticket Price ($)
                  </label>
                  <span className="font-mono text-sm font-black text-blue-600">
                    ${inputs.averageTicketPrice}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={inputs.averageTicketPrice}
                  onChange={(e) => handleTicketPriceChange(Number(e.target.value))}
                  className="w-full cursor-pointer accent-black dark:accent-lime"
                />
              </div>

              {/* Slider 2: Attendance % */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-mono text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">
                    Expected Turnout / Attendance Rate
                  </label>
                  <span className="font-mono text-sm font-black text-emerald-600">
                    {Math.round(inputs.expectedAttendanceRate * 100)}% ({analysis.projectedAttendees} students)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={inputs.expectedAttendanceRate}
                  onChange={(e) => handleAttendanceRateChange(Number(e.target.value))}
                  className="w-full cursor-pointer accent-black dark:accent-lime"
                />
              </div>

              {/* Slider 3: Venue Capacity */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-mono text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">
                    Venue Max Capacity
                  </label>
                  <span className="font-mono text-sm font-black text-purple-600">
                    {inputs.venueCapacity} seats
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="25"
                  value={inputs.venueCapacity}
                  onChange={(e) => handleCapacityChange(Number(e.target.value))}
                  className="w-full cursor-pointer accent-black dark:accent-lime"
                />
              </div>

              {/* Slider 4: Variable Cost Per Head */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-mono text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">
                    Variable Cost per Attendee (Food, Drink, Swag)
                  </label>
                  <span className="font-mono text-sm font-black text-amber-600">
                    ${inputs.variableCostPerAttendee} / head
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={inputs.variableCostPerAttendee}
                  onChange={(e) => handleVariableCostChange(Number(e.target.value))}
                  className="w-full cursor-pointer accent-black dark:accent-lime"
                />
              </div>
            </div>
          </div>

          {/* Fixed Expense Manager Table */}
          <div className="neu-border bg-white p-6 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-black dark:text-lime" />
                <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                  Fixed Expenses Breakdown
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-zinc-500">
                Total Fixed: ${analysis.totalFixedCosts.toLocaleString()}
              </span>
            </div>

            {/* Add New Expense Form */}
            <form onSubmit={handleAddExpense} className="mb-4 flex gap-2">
              <input
                type="text"
                placeholder="Expense Name (e.g., Security, DJ)"
                value={newExpenseName}
                onChange={(e) => setNewExpenseName(e.target.value)}
                className="neu-border flex-1 bg-zinc-50 p-2 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
              />
              <input
                type="number"
                placeholder="Amount ($)"
                value={newExpenseAmount}
                onChange={(e) => setNewExpenseAmount(e.target.value)}
                className="neu-border w-28 bg-zinc-50 p-2 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
              />
              <Button
                type="submit"
                size="sm"
                className="neu-border bg-lime font-mono text-xs font-bold text-black"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </form>

            {/* List of Fixed Expenses */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {inputs.fixedExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="neu-border flex items-center justify-between bg-zinc-50 p-2.5 dark:bg-zinc-800"
                >
                  <span className="font-mono text-xs font-semibold text-zinc-900 dark:text-white">
                    {exp.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                      ${exp.amount.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExpense(exp.id)}
                      className="text-zinc-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: 2D Sensitivity Matrix & Scenario Testing (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* 3-Scenario Stress Test Cards */}
          <div className="neu-border bg-white p-6 dark:bg-zinc-900">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-black dark:text-lime" />
              <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                Turnout Scenario Stress Tests
              </h3>
            </div>

            <div className="space-y-3">
              {scenarios.map((sc) => (
                <div
                  key={sc.scenarioName}
                  className={`neu-border p-3 ${
                    sc.netProfit >= 0
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "bg-rose-50/50 dark:bg-rose-950/20"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-black uppercase text-zinc-900 dark:text-white">
                      {sc.scenarioName === "pessimistic"
                        ? "🌧️ Worst Case (50% Turnout)"
                        : sc.scenarioName === "base"
                        ? "🎯 Expected Case (" + sc.attendanceRate + "% Turnout)"
                        : "🚀 Sold Out (100% Turnout)"}
                    </span>
                    <span
                      className={`font-mono text-sm font-black ${
                        sc.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {sc.netProfit >= 0 ? "+" : ""}${sc.netProfit.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between font-mono text-[11px] text-zinc-500">
                    <span>{sc.attendeeCount} Attendees</span>
                    <span>Revenue: ${sc.grossRevenue.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2D Sensitivity Matrix Heatmap */}
          <div className="neu-border bg-white p-6 dark:bg-zinc-900">
            <div className="flex items-center gap-2 mb-3">
              <Grid className="h-4 w-4 text-black dark:text-lime" />
              <h3 className="font-mono text-sm font-black uppercase text-zinc-900 dark:text-white">
                2D Profit Sensitivity Matrix
              </h3>
            </div>
            <p className="font-mono text-[10px] text-zinc-500 mb-3">
              Net profit projection across Ticket Price (rows) vs Turnout % (columns).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-center font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-zinc-700">
                    <th className="p-1.5 text-left font-black">Price \ Turnout</th>
                    {sensitivity.attendanceRates.map((r) => (
                      <th key={r} className="p-1.5 font-bold">
                        {Math.round(r * 100)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {sensitivity.cells.map((row, rIdx) => (
                    <tr key={sensitivity.prices[rIdx]}>
                      <td className="p-1.5 text-left font-bold text-zinc-900 dark:text-white">
                        ${sensitivity.prices[rIdx]}
                      </td>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`p-1.5 font-bold ${
                            cell.isProfitable
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {cell.netProfit >= 0 ? "+" : ""}${Math.round(cell.netProfit / 10) * 10}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveEventRoiCalculator;
