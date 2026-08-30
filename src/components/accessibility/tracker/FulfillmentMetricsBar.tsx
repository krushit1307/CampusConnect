import React from "react";
import { FulfillmentMetrics } from "@/types/accessibilityFulfillment";
import {
  Activity,
  Clock,
  Star,
  CheckCircle,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";

interface FulfillmentMetricsBarProps {
  metrics: FulfillmentMetrics;
}

export const FulfillmentMetricsBar: React.FC<FulfillmentMetricsBarProps> = ({
  metrics,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Active Requests */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Active Requests
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Activity className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-black text-white">{metrics.activeRequests}</span>
          <span className="text-xs text-slate-500">/ {metrics.totalRequests} total</span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
          <TrendingUp className="h-3 w-3" /> Live tracking active
        </div>
      </div>

      {/* Metric 2: Avg Turnaround Time */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Avg Turnaround
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <Clock className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">{metrics.avgResolutionMinutes}</span>
          <span className="text-sm font-bold text-slate-400">mins</span>
        </div>
        <div className="mt-2 text-[11px] text-purple-400 font-medium">
          3.2m faster than SLA target
        </div>
      </div>

      {/* Metric 3: On-Time Fulfillment */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            On-Time Delivery
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">{metrics.onTimePercentage}%</span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 font-medium flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> Guaranteed dispatch
        </div>
      </div>

      {/* Metric 4: Satisfaction Rating */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Student Rating
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Star className="h-4 w-4 fill-amber-400" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">{metrics.satisfactionScore}</span>
          <span className="text-sm font-bold text-slate-400">/ 5.0</span>
        </div>
        <div className="mt-2 text-[11px] text-amber-400 font-medium">
          Based on student sign-offs
        </div>
      </div>
    </div>
  );
};
