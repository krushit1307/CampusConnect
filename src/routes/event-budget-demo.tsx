import { useState } from "react";
import { BudgetSimulator } from "@/components/BudgetSimulator";
import DollarSign from "lucide-react/dist/esm/icons/dollar-sign";
import type { BudgetOutput } from "@/lib/budgetCalculator";

/**
 * Demo page showing how Budget Simulator integrates into Event Creation
 * This would typically be a step in the EventCreationWizard component
 */
export default function EventBudgetDemo() {
  const [budgetData, setBudgetData] = useState<BudgetOutput | null>(null);

  return (
    <div className="min-h-screen bg-cream p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="border-b-2 border-black bg-white p-4 shadow-[2px_2px_0_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime shadow-[2px_2px_0_rgba(0,0,0,1)]">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-black">Event Budget Simulator</h1>
              <p className="font-mono text-xs text-gray-600">
                Test integration in Event Creation workflow
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Budget Simulator */}
          <div className="lg:col-span-2">
            <BudgetSimulator
              initialAttendees={100}
              initialTicketPrice={15}
              onBudgetChange={setBudgetData}
            />
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* Current Status */}
            {budgetData && (
              <div className="space-y-3 rounded border-2 border-black bg-white p-4 shadow-[2px_2px_0_rgba(0,0,0,0.1)]">
                <h3 className="font-display font-bold text-black">Current Setup</h3>

                <div className="space-y-2 text-sm">
                  <p>
                    <span className="font-mono font-bold text-gray-600">Revenue:</span>{" "}
                    <span className="font-mono text-black">
                      ${budgetData.grossRevenue.toFixed(2)}
                    </span>
                  </p>
                  <p>
                    <span className="font-mono font-bold text-gray-600">Fees:</span>{" "}
                    <span className="font-mono text-orange-600">
                      −${budgetData.stripeFees.toFixed(2)}
                    </span>
                  </p>
                  <p>
                    <span className="font-mono font-bold text-gray-600">Costs:</span>{" "}
                    <span className="font-mono text-purple-600">
                      −${budgetData.totalFixedCosts.toFixed(2)}
                    </span>
                  </p>
                  <div className="border-t-2 border-gray-200 pt-2">
                    <p>
                      <span className="font-display font-bold text-black">Profit:</span>{" "}
                      <span
                        className={`font-display font-bold ${
                          budgetData.projectedProfit > 0
                            ? "text-green-600"
                            : budgetData.projectedProfit < -0.01
                              ? "text-red-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {budgetData.projectedProfit > 0 ? "+" : ""}$
                        {budgetData.projectedProfit.toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Usage Guide */}
            <div className="space-y-3 rounded border-2 border-black bg-blue-50 p-4">
              <h3 className="font-display font-bold text-black">💡 How to Use</h3>

              <ol className="space-y-2 font-mono text-xs text-black">
                <li>
                  1. Set <span className="font-bold">expected attendance</span>
                </li>
                <li>
                  2. Adjust <span className="font-bold">ticket price</span>
                </li>
                <li>
                  3. Add <span className="font-bold">fixed costs</span> (venue, catering, etc.)
                </li>
                <li>
                  4. Check <span className="font-bold">profit status</span>
                </li>
                <li>
                  5. Run <span className="font-bold">worst case scenarios</span>
                </li>
                <li>
                  6. Publish when <span className="font-bold">breakeven</span> is safe
                </li>
              </ol>
            </div>

            {/* Key Insights */}
            {budgetData && (
              <div className="space-y-3 rounded border-2 border-black bg-yellow-50 p-4">
                <h3 className="font-display font-bold text-black">🎯 Key Metrics</h3>

                <div className="space-y-2 font-mono text-xs">
                  <div>
                    <span className="font-bold text-gray-700">Margin:</span>
                    <span className="ml-2 text-black">{budgetData.profitMargin.toFixed(1)}%</span>
                  </div>

                  <div>
                    <span className="font-bold text-gray-700">Breakeven:</span>
                    <span className="ml-2 text-black">
                      {budgetData.breakeven.attendeesNeeded} people
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-gray-700">Alternative Price:</span>
                    <span className="ml-2 text-black">
                      ${budgetData.breakeven.ticketPriceNeeded.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Integration Note */}
            <div className="rounded border-2 border-black bg-green-50 p-4">
              <p className="font-mono text-[10px] font-bold text-green-900">
                ✨ This component saves budget data to context and can be integrated into the
                EventCreationWizard. When publishing, organizers confirm they've reviewed
                profitability.
              </p>
            </div>
          </div>
        </div>

        {/* Code Example */}
        <div className="rounded border-2 border-black bg-white p-4">
          <h3 className="mb-2 font-display font-bold text-black">📝 Integration Example</h3>
          <pre className="overflow-x-auto rounded bg-gray-100 p-3 font-mono text-xs text-black">
            {`// In EventCreationWizard.tsx
import { BudgetSimulator } from "@/components/BudgetSimulator";

function BudgetStep() {
  const [budget, setBudget] = useState(null);
  
  return (
    <BudgetSimulator
      initialAttendees={formValues.expectedAttendees}
      initialTicketPrice={formValues.ticketPrice}
      onBudgetChange={setBudget}
    />
  );
}

// Save budget data when publishing event
async function publishEvent() {
  const event = await createEvent({
    ...formValues,
    budget_data: {
      projected_profit: budget.projectedProfit,
      breakeven_attendees: budget.breakeven.attendeesNeeded,
      // ... other metrics
    }
  });
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
