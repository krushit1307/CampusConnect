import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, TrendingDown, Calendar, ShieldAlert, Loader2 } from "lucide-react";

interface FinancialBurnRateWidgetProps {
  clubId: string;
}

export function FinancialBurnRateWidget({ clubId }: FinancialBurnRateWidgetProps) {
  const supabase = createClient();

  // Fetch burn rate data
  const { data, isLoading } = useQuery({
    queryKey: ["club-financial-burn", clubId],
    queryFn: async () => {
      const { data: res, error } = await supabase.rpc("get_club_burn_rate", {
        p_club_id: clubId
      });
      if (error) throw error;
      return res?.[0] || { ledger_balance: 0, average_monthly_burn: 0, runway_months: 999 };
    }
  });

  if (isLoading) {
    return (
      <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0_0_#000] flex flex-col items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mb-2" />
        <p className="font-mono text-xs text-gray-500">Calculating predictive financials...</p>
      </div>
    );
  }

  const balance = Number(data?.ledger_balance || 0);
  const burnRate = Number(data?.average_monthly_burn || 0);
  const runway = Number(data?.runway_months || 0);

  // Generate 6-month prediction data points
  const chartData = [];
  const currentDate = new Date();
  
  for (let i = 0; i <= 6; i++) {
    const projectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const label = projectedDate.toLocaleString("en-US", { month: "short" });
    const projectedBalance = Math.max(0, balance - (i * burnRate));
    
    chartData.push({
      month: label,
      "Projected Balance": Number(projectedBalance.toFixed(2))
    });
  }

  // Determine depletion date month/year
  let depletionLabel = "Never";
  let showBanquetWarning = false;

  if (burnRate > 0 && runway < 999) {
    const depletionDate = new Date();
    depletionDate.setMonth(depletionDate.getMonth() + Math.ceil(runway));
    depletionLabel = depletionDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    // Warning check: Is depletion date before May?
    // If the runway months count is less than the number of months until May of next year (or current year's May), show warning
    const monthsToMay = (5 - currentDate.getMonth() + 12) % 12 || 12;
    if (runway < monthsToMay) {
      showBanquetWarning = true;
    }
  }

  return (
    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0_0_#000] dark:bg-zinc-900 dark:border-white text-black space-y-6">
      <div className="flex items-center gap-2 border-b-2 border-black pb-3 dark:border-white">
        <TrendingDown className="w-5 h-5 text-red-500" />
        <h3 className="font-display font-black text-lg uppercase">
          Predictive "Burn Rate" Calculator
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-black bg-gray-50 p-4 font-mono text-xs dark:bg-zinc-800">
          <span className="text-gray-500 font-bold uppercase">Average Monthly Burn</span>
          <p className="text-2xl font-black text-red-600 mt-1">
            ${burnRate.toLocaleString("en-US", { minimumFractionDigits: 2 })}/mo
          </p>
          <span className="text-[10px] text-gray-400 block mt-1">Calculated over last 90 days</span>
        </div>

        <div className="border border-black bg-gray-50 p-4 font-mono text-xs dark:bg-zinc-800">
          <span className="text-gray-500 font-bold uppercase">Runway</span>
          <p className="text-2xl font-black text-indigo-600 mt-1">
            {runway >= 999 ? "∞" : `${runway} Months`}
          </p>
          <span className="text-[10px] text-gray-400 block mt-1">Months until funds hit zero</span>
        </div>

        <div className="border border-black bg-gray-50 p-4 font-mono text-xs dark:bg-zinc-800">
          <span className="text-gray-500 font-bold uppercase">Predicted Depletion Date</span>
          <p className="text-2xl font-black text-amber-600 mt-1 uppercase">
            {depletionLabel}
          </p>
          <span className="text-[10px] text-gray-400 block mt-1">Based on spending velocity</span>
        </div>
      </div>

      {showBanquetWarning && (
        <div className="border-2 border-amber-500 bg-amber-50 p-4 font-mono text-xs text-amber-800 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-900 uppercase">Warning: Runway Alert</span>
            <p className="mt-1 leading-normal text-amber-700">
              Warning: At your current spending velocity, you will not have enough funds for your annual May Banquet.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <span className="font-mono text-xs font-bold uppercase text-gray-500">6-Month Balance Forecast</span>
        <div className="h-64 w-full border border-black p-4 bg-gray-50/50">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fontFamily: "monospace" }} />
              <YAxis tick={{ fontSize: 10, fontFamily: "monospace" }} />
              <Tooltip wrapperStyle={{ fontFamily: "monospace", fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="Projected Balance"
                stroke="#dc2626"
                strokeWidth={3}
                dot={{ stroke: "#dc2626", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
