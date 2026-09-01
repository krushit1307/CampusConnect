import React from "react";
import { useDonorChurn } from "@/hooks/useDonorChurn";
import type { DonorChurnPrediction } from "@/types/churn";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";

interface DonorChurnDashboardProps {
  clubId: string;
}

export const DonorChurnDashboard: React.FC<DonorChurnDashboardProps> = ({ clubId }) => {
  const { predictions, isLoading, isRefreshing, error, runChurnModeler } = useDonorChurn(clubId);

  const handleRunModel = async () => {
    try {
      const count = await runChurnModeler();
      toast.success(`Successfully analyzed ${count} donors.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to run modeler.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 border-2 border-red-900 text-red-900 font-mono">
        <div className="font-bold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Error loading predictions
        </div>
        <div>{error}</div>
      </div>
    );
  }

  const highRiskCount = predictions.filter(
    (p) => p.risk_level === "high" || p.risk_level === "critical",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display uppercase border-b-2 border-black inline-block pr-8">
            Predictive Churn Modeler
          </h2>
          <p className="text-gray-600 mt-2 font-mono text-sm max-w-xl">
            Identify high-value donors showing sudden drops in engagement across campaigns, events,
            and platform activity.
          </p>
        </div>
        <button
          onClick={handleRunModel}
          disabled={isRefreshing}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 font-bold font-mono uppercase hover:bg-black/80 transition-colors disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Run Analysis
        </button>
      </div>

      {highRiskCount > 0 && (
        <div className="neu-border bg-yellow-50 p-4 border-yellow-900 text-yellow-900 flex items-start gap-4">
          <ShieldAlert className="h-6 w-6 mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-bold font-mono">Attention Required</h3>
            <p className="text-sm mt-1">
              {highRiskCount} high-value donor(s) have been flagged with a severe drop in
              engagement. Automated tasks have been generated in your Club Tasks board to initiate
              re-engagement workflows.
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto neu-border bg-white p-0">
        <table className="w-full text-left border-collapse font-mono text-sm">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-black">
              <th className="p-3">Donor</th>
              <th className="p-3">Risk Level</th>
              <th className="p-3 text-right">Score</th>
              <th className="p-3 text-right">90d Velocity Drop</th>
              <th className="p-3">Baseline / Current</th>
              <th className="p-3">Total Donated</th>
              <th className="p-3">Signals</th>
            </tr>
          </thead>
          <tbody>
            {predictions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                  No donor data available. Click "Run Analysis" to generate predictions.
                </td>
              </tr>
            ) : (
              predictions.map((pred) => {
                // Determine styling based on risk
                let riskBadgeClass = "bg-green-100 text-green-800 border-green-800";
                if (pred.risk_level === "medium")
                  riskBadgeClass = "bg-yellow-100 text-yellow-800 border-yellow-800";
                else if (pred.risk_level === "high")
                  riskBadgeClass = "bg-orange-100 text-orange-800 border-orange-800";
                else if (pred.risk_level === "critical")
                  riskBadgeClass = "bg-red-100 text-red-800 border-red-800";

                const name = Array.isArray(pred.profiles)
                  ? pred.profiles[0]?.full_name
                  : pred.profiles?.full_name;
                const isHighValue = pred.is_high_value_donor;

                return (
                  <tr
                    key={pred.id}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="p-3">
                      <div className="font-bold flex items-center gap-2">
                        {name || "Unknown Donor"}
                        {isHighValue && (
                          <span
                            className="text-[10px] bg-purple-100 text-purple-900 border border-purple-900 px-1 py-0.5 rounded uppercase font-bold"
                            title="Total donations > $500"
                          >
                            High Value
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Last:{" "}
                        {pred.last_meaningful_interaction_at
                          ? new Date(pred.last_meaningful_interaction_at).toLocaleDateString()
                          : "N/A"}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 text-xs font-bold uppercase border ${riskBadgeClass}`}
                      >
                        {pred.risk_level}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold">{Math.round(pred.risk_score)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {pred.velocity_change_pct < 0 ? (
                          <ArrowDownRight className="h-4 w-4 text-red-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        )}
                        <span
                          className={
                            pred.velocity_change_pct <= -75 ? "text-red-600 font-bold" : ""
                          }
                        >
                          {pred.velocity_change_pct > 0 ? "+" : ""}
                          {Math.round(pred.velocity_change_pct)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500" title="180d to 90d ago">
                          {pred.baseline_velocity}
                        </span>
                        <span>→</span>
                        <span className="font-bold" title="Last 90d">
                          {pred.current_velocity}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-bold">
                      ${(pred.total_donation_volume_cents / 100).toFixed(2)}
                    </td>
                    <td className="p-3 text-xs">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {pred.contributing_factors.map((f) => (
                          <span
                            key={f}
                            className="bg-gray-100 border border-gray-300 px-1 rounded text-gray-700 capitalize"
                          >
                            {f}
                          </span>
                        ))}
                        {pred.contributing_factors.length === 0 && (
                          <span className="text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
