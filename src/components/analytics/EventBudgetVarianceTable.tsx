import React from "react";
import { DollarSign, AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import {
  getEventBudgetVarianceReport,
  formatMoney,
  type EventBudgetVarianceReport,
} from "@/services/eventBudgetVarianceService";

export interface EventBudgetVarianceTableProps {
  eventId: string;
}

export const EventBudgetVarianceTable: React.FC<EventBudgetVarianceTableProps> = ({ eventId }) => {
  const { data: report, isLoading, isError } = useQuery<EventBudgetVarianceReport | null>({
    queryKey: ["event_budget_variance_report", eventId],
    queryFn: () => getEventBudgetVarianceReport(eventId),
    enabled: !!eventId,
  });

  if (isLoading) {
    return (
      <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0_0_#000] mt-6">
        <div className="flex h-32 items-center justify-center font-mono text-sm text-black/50">
          Loading budget variance analysis...
        </div>
      </div>
    );
  }

  if (isError || !report) {
    return null;
  }

  const hasCategories = report.categories && report.categories.length > 0;

  return (
    <div className="border-2 border-black bg-white p-6 shadow-[4px_4px_0_0_#000] mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-yellow-300">
              <DollarSign className="h-5 w-5 text-black" />
            </div>
            <h3 className="font-display text-xl font-black uppercase text-black">
              Budget vs. Actual Variance Report
            </h3>
          </div>
          <p className="font-mono text-xs text-black/60 mt-1">
            Line-by-line comparison of initial draft budget estimates vs. reconciled ledger debits.
          </p>
        </div>

        {/* Total Summary Badge */}
        <div
          className={`border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0_0_#000] ${
            report.is_overspent
              ? "bg-red-100 text-red-900 border-red-900"
              : "bg-emerald-100 text-emerald-900 border-emerald-900"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {report.is_overspent ? (
              <>
                <TrendingUp className="h-4 w-4 text-red-700" />
                <span>Total Overrun: {formatMoney(Math.abs(report.total_variance))}</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-emerald-700" />
                <span>Under Budget: {formatMoney(report.total_variance)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="border-2 border-black bg-neutral-50 p-4 shadow-[2px_2px_0_0_#000]">
          <p className="font-mono text-[10px] font-bold uppercase text-black/60">Total Estimated Budget</p>
          <p className="font-display text-2xl font-black text-black mt-1">
            {formatMoney(report.total_estimated)}
          </p>
        </div>

        <div className="border-2 border-black bg-neutral-50 p-4 shadow-[2px_2px_0_0_#000]">
          <p className="font-mono text-[10px] font-bold uppercase text-black/60">Total Actual Expenses</p>
          <p className="font-display text-2xl font-black text-black mt-1">
            {formatMoney(report.total_actual)}
          </p>
        </div>

        <div
          className={`border-2 border-black p-4 shadow-[2px_2px_0_0_#000] ${
            report.is_overspent ? "bg-red-50" : "bg-emerald-50"
          }`}
        >
          <p className="font-mono text-[10px] font-bold uppercase text-black/60">Net Variance</p>
          <p
            className={`font-display text-2xl font-black mt-1 ${
              report.is_overspent ? "text-red-700 font-bold" : "text-emerald-700"
            }`}
          >
            {report.total_variance < 0 ? `-${formatMoney(Math.abs(report.total_variance))}` : `+${formatMoney(report.total_variance)}`}
          </p>
        </div>
      </div>

      {/* Comparison Table */}
      {hasCategories ? (
        <div className="overflow-x-auto border-2 border-black">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black bg-neutral-100 font-black uppercase text-black">
                <th className="p-3 border-r-2 border-black">Category</th>
                <th className="p-3 border-r-2 border-black text-right">Estimated</th>
                <th className="p-3 border-r-2 border-black text-right">Actual</th>
                <th className="p-3 border-r-2 border-black text-right">Variance</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.categories.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-black/20 transition-colors ${
                    row.is_overspent ? "bg-red-50/80 hover:bg-red-100/80" : "hover:bg-neutral-50"
                  }`}
                >
                  <td className="p-3 border-r-2 border-black font-bold text-black flex items-center gap-2">
                    {row.is_overspent && <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
                    <span>{row.category}</span>
                  </td>
                  <td className="p-3 border-r-2 border-black text-right text-black/80">
                    {formatMoney(row.estimated)}
                  </td>
                  <td className="p-3 border-r-2 border-black text-right font-bold text-black">
                    {formatMoney(row.actual)}
                  </td>
                  <td
                    className={`p-3 border-r-2 border-black text-right font-black ${
                      row.is_overspent ? "text-red-700 font-bold" : "text-emerald-700"
                    }`}
                  >
                    {row.variance < 0 ? `-${formatMoney(Math.abs(row.variance))}` : `+${formatMoney(row.variance)}`}
                    {row.percentage_variance > 0 && (
                      <span className="block text-[10px] font-normal text-red-600">
                        (+{row.percentage_variance}% over)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.is_overspent ? (
                      <span className="inline-flex items-center gap-1 border border-red-700 bg-red-600 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-white">
                        Overspent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 border border-emerald-700 bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-emerald-900">
                        On Track
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-2 border-dashed border-black/30 p-8 text-center">
          <p className="font-mono text-xs text-black/50">
            No categorized expenses or draft estimates found for this event yet.
          </p>
        </div>
      )}
    </div>
  );
};
