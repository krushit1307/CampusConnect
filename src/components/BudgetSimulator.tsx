import { useState, useMemo, useCallback } from "react";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import {
  calculateBudget,
  getProfitStatusMessage,
  generateScenarioAnalysis,
  type BudgetInput,
} from "@/lib/budgetCalculator";

interface FixedCost {
  id: string;
  name: string;
  amount: number;
}

export interface BudgetSimulatorProps {
  onBudgetChange?: (budget: ReturnType<typeof calculateBudget>) => void;
  initialAttendees?: number;
  initialTicketPrice?: number;
}

export function BudgetSimulator({
  onBudgetChange,
  initialAttendees = 100,
  initialTicketPrice = 15,
}: BudgetSimulatorProps) {
  const [expectedAttendees, setExpectedAttendees] = useState(initialAttendees);
  const [ticketPrice, setTicketPrice] = useState(initialTicketPrice);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([
    { id: "1", name: "Venue Rental", amount: 200 },
    { id: "2", name: "Catering", amount: 300 },
  ]);
  const [earlyBirdPercentage, setEarlyBirdPercentage] = useState(0);
  const [earlyBirdPrice, setEarlyBirdPrice] = useState(0);
  const [showScenarios, setShowScenarios] = useState(false);

  // Calculate budget
  const budgetData = useMemo(() => {
    return calculateBudget({
      expectedAttendees: Math.max(1, expectedAttendees),
      ticketPrice: Math.max(0, ticketPrice),
      fixedCosts,
      earlyBirdPercentage: earlyBirdPercentage / 100,
      earlyBirdPrice,
    });
  }, [expectedAttendees, ticketPrice, fixedCosts, earlyBirdPercentage, earlyBirdPrice]);

  // Scenario analysis
  const scenarios = useMemo(() => {
    return generateScenarioAnalysis({
      expectedAttendees,
      ticketPrice,
      fixedCosts,
      earlyBirdPercentage: earlyBirdPercentage / 100,
      earlyBirdPrice,
    });
  }, [expectedAttendees, ticketPrice, fixedCosts, earlyBirdPercentage, earlyBirdPrice]);

  // Notify parent of changes
  useMemo(() => {
    onBudgetChange?.(budgetData);
  }, [budgetData, onBudgetChange]);

  const addFixedCost = useCallback(() => {
    const newCost: FixedCost = {
      id: Date.now().toString(),
      name: "New Cost",
      amount: 0,
    };
    setFixedCosts([...fixedCosts, newCost]);
  }, [fixedCosts]);

  const updateFixedCost = useCallback(
    (id: string, updates: Partial<FixedCost>) => {
      setFixedCosts(fixedCosts.map((cost) => (cost.id === id ? { ...cost, ...updates } : cost)));
    },
    [fixedCosts],
  );

  const removeFixedCost = useCallback(
    (id: string) => {
      setFixedCosts(fixedCosts.filter((cost) => cost.id !== id));
    },
    [fixedCosts],
  );

  const statusColor =
    budgetData.projectedProfit > 0
      ? "text-green-600"
      : budgetData.projectedProfit < -0.01
        ? "text-red-600"
        : "text-yellow-600";

  const statusBgColor =
    budgetData.projectedProfit > 0
      ? "bg-green-50 border-green-200"
      : budgetData.projectedProfit < -0.01
        ? "bg-red-50 border-red-200"
        : "bg-yellow-50 border-yellow-200";

  return (
    <div className="space-y-6 rounded-lg border-2 border-black bg-white p-6 shadow-[4px_4px_0_rgba(0,0,0,0.1)]">
      <div>
        <h2 className="font-display text-xl font-bold text-black">💰 Budget Simulator</h2>
        <p className="mt-1 font-mono text-xs text-gray-600">
          Play with numbers to find your perfect ticket price
        </p>
      </div>

      {/* Main Input Controls */}
      <div className="space-y-4">
        {/* Expected Attendees Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs font-bold uppercase text-black">
              Expected Attendees
            </label>
            <span className="rounded-full bg-lime border border-black px-3 py-1 font-mono font-bold text-black">
              {expectedAttendees} people
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="1000"
            step="5"
            value={expectedAttendees}
            onChange={(e) => setExpectedAttendees(parseInt(e.target.value))}
            className="w-full accent-black h-2.5 cursor-pointer appearance-none rounded-lg border border-black bg-cream"
            title="Adjust expected attendance. Run a 'Worst Case Scenario' with only 50% attendance!"
          />
          <div className="flex justify-between font-mono text-[10px] text-gray-500">
            <span>Worst: {Math.round(expectedAttendees * 0.5)}</span>
            <span>Best: {Math.round(expectedAttendees * 1.5)}</span>
          </div>
        </div>

        {/* Ticket Price Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs font-bold uppercase text-black">Ticket Price</label>
            <span className="rounded-full bg-lime border border-black px-3 py-1 font-mono font-bold text-black">
              ${ticketPrice.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(parseFloat(e.target.value))}
            className="w-full accent-black h-2.5 cursor-pointer appearance-none rounded-lg border border-black bg-cream"
          />
          <div className="flex justify-between font-mono text-[10px] text-gray-500">
            <span>Free</span>
            <span>$100</span>
          </div>
        </div>

        {/* Early Bird Pricing (Optional) */}
        {earlyBirdPercentage > 0 && (
          <div className="space-y-3 rounded bg-blue-50 p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs font-bold text-black">Early Bird %</label>
                <span className="font-mono text-xs font-bold text-black">
                  {earlyBirdPercentage}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={earlyBirdPercentage}
                onChange={(e) => setEarlyBirdPercentage(parseInt(e.target.value))}
                className="w-full accent-black h-2 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs font-bold text-black">Early Bird Price</label>
                <span className="font-mono text-xs font-bold text-black">
                  ${earlyBirdPrice.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={ticketPrice}
                step="0.5"
                value={earlyBirdPrice}
                onChange={(e) => setEarlyBirdPrice(parseFloat(e.target.value))}
                className="w-full accent-black h-2 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Toggle Early Bird Button */}
        <button
          onClick={() => {
            if (earlyBirdPercentage === 0) {
              setEarlyBirdPercentage(40);
              setEarlyBirdPrice(Math.max(5, ticketPrice - 5));
            } else {
              setEarlyBirdPercentage(0);
              setEarlyBirdPrice(0);
            }
          }}
          className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-cream active:translate-y-0.5"
        >
          {earlyBirdPercentage > 0 ? "Remove" : "Add"} Early Bird Pricing
        </button>
      </div>

      {/* Fixed Costs Section */}
      <div className="space-y-3 border-t-2 border-black pt-4">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs font-bold uppercase text-black">Fixed Costs</label>
          <button
            onClick={addFixedCost}
            className="flex items-center gap-1 border-2 border-black bg-lime px-2.5 py-1 font-mono text-xs font-bold hover:bg-yellow-300 active:translate-y-0.5"
            title="Add a new fixed cost (venue, catering, etc.)"
          >
            <Plus className="h-3 w-3" />
            Add Cost
          </button>
        </div>

        <div className="space-y-2">
          {fixedCosts.map((cost) => (
            <div key={cost.id} className="flex gap-2">
              <input
                type="text"
                value={cost.name}
                onChange={(e) => updateFixedCost(cost.id, { name: e.target.value })}
                placeholder="e.g., Venue Rental"
                className="flex-1 border-2 border-black px-2 py-1 font-mono text-xs font-bold"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost.amount}
                onChange={(e) =>
                  updateFixedCost(cost.id, { amount: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                className="w-24 border-2 border-black px-2 py-1 font-mono text-xs font-bold"
              />
              <button
                onClick={() => removeFixedCost(cost.id)}
                className="border-2 border-black bg-red-100 px-2 py-1 font-mono text-xs font-bold hover:bg-red-200 active:translate-y-0.5"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </button>
            </div>
          ))}
        </div>

        {fixedCosts.length === 0 && (
          <p className="text-center font-mono text-xs text-gray-500">No fixed costs added yet</p>
        )}
      </div>

      {/* Results Section */}
      <div className="space-y-3 border-t-2 border-black pt-4">
        {/* Main Profit Status */}
        <div
          className={`rounded border-2 border-black p-4 shadow-[2px_2px_0_rgba(0,0,0,0.1)] ${statusBgColor}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {budgetData.projectedProfit > 0 ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : budgetData.projectedProfit < -0.01 ? (
                <TrendingDown className="h-6 w-6 text-red-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              )}
              <span className="font-mono text-xs font-bold text-gray-600">Projected Outcome</span>
            </div>
            <span className={`font-display text-2xl font-bold ${statusColor}`}>
              {getProfitStatusMessage(
                budgetData.projectedProfit,
                budgetData.breakeven.ticketPriceNeeded,
              )}
            </span>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="border-2 border-black bg-blue-50 p-3">
            <p className="font-mono text-[10px] font-bold text-gray-600 uppercase">Gross Revenue</p>
            <p className="font-display text-lg font-bold text-black">
              ${budgetData.grossRevenue.toFixed(2)}
            </p>
          </div>

          <div className="border-2 border-black bg-orange-50 p-3">
            <p className="font-mono text-[10px] font-bold text-gray-600 uppercase">
              Stripe Fees (2.9% + $0.30)
            </p>
            <p className="font-display text-lg font-bold text-orange-600">
              −${budgetData.stripeFees.toFixed(2)}
            </p>
          </div>

          <div className="border-2 border-black bg-purple-50 p-3">
            <p className="font-mono text-[10px] font-bold text-gray-600 uppercase">Fixed Costs</p>
            <p className="font-display text-lg font-bold text-purple-600">
              −${budgetData.totalFixedCosts.toFixed(2)}
            </p>
          </div>

          <div className="border-2 border-black bg-gray-50 p-3">
            <p className="font-mono text-[10px] font-bold text-gray-600 uppercase">Profit Margin</p>
            <p className="font-display text-lg font-bold text-black">
              {budgetData.profitMargin.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Breakeven Info */}
        <div className="rounded border-2 border-black bg-amber-50 p-3">
          <p className="mb-1.5 font-mono text-xs font-bold text-gray-600 uppercase">
            Break-Even Analysis
          </p>
          <div className="space-y-1 font-mono text-xs">
            <p>
              • Need{" "}
              <span className="font-bold text-black">
                {budgetData.breakeven.attendeesNeeded} attendees
              </span>{" "}
              at ${ticketPrice.toFixed(2)} to break even
            </p>
            <p>
              • Or charge{" "}
              <span className="font-bold text-black">
                ${budgetData.breakeven.ticketPriceNeeded.toFixed(2)}
              </span>{" "}
              with {expectedAttendees} attendees
            </p>
          </div>
        </div>
      </div>

      {/* Scenario Analysis */}
      <div className="border-t-2 border-black pt-4">
        <button
          onClick={() => setShowScenarios(!showScenarios)}
          className="w-full border-2 border-black bg-white px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-cream active:translate-y-0.5"
        >
          {showScenarios ? "Hide" : "Show"} Scenario Analysis (Best/Worst Case)
        </button>

        {showScenarios && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="border-2 border-red-600 bg-red-50 p-2">
              <p className="font-mono text-[10px] font-bold text-red-700 uppercase">
                Worst Case (50%)
              </p>
              <p className="font-display text-xs font-bold text-red-600">
                {scenarios.worst.projectedProfit > 0 ? "+" : ""}$
                {scenarios.worst.projectedProfit.toFixed(2)}
              </p>
              <p className="font-mono text-[9px] text-gray-600">
                {Math.round(expectedAttendees * 0.5)} people
              </p>
            </div>

            <div className="border-2 border-yellow-600 bg-yellow-50 p-2">
              <p className="font-mono text-[10px] font-bold text-yellow-700 uppercase">Expected</p>
              <p className="font-display text-xs font-bold text-yellow-600">
                {scenarios.base.projectedProfit > 0 ? "+" : ""}$
                {scenarios.base.projectedProfit.toFixed(2)}
              </p>
              <p className="font-mono text-[9px] text-gray-600">{expectedAttendees} people</p>
            </div>

            <div className="border-2 border-green-600 bg-green-50 p-2">
              <p className="font-mono text-[10px] font-bold text-green-700 uppercase">
                Best Case (150%)
              </p>
              <p className="font-display text-xs font-bold text-green-600">
                +${scenarios.best.projectedProfit.toFixed(2)}
              </p>
              <p className="font-mono text-[9px] text-gray-600">
                {Math.round(expectedAttendees * 1.5)} people
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Warning Tooltip */}
      <div className="rounded border-2 border-yellow-400 bg-yellow-100 p-2">
        <p className="font-mono text-[10px] font-bold text-yellow-900">
          💡 Pro Tip: Always run a worst-case scenario! If 50% fewer people show up, you break even
          at ${budgetData.breakeven.ticketPriceNeeded.toFixed(2)}/ticket.
        </p>
      </div>
    </div>
  );
}
