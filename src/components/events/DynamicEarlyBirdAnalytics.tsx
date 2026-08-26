// =============================================================================
// File: src/components/events/DynamicEarlyBirdAnalytics.tsx
// Feature: Dynamic "Early Bird" Discount Analytics
// Description: Interactive dashboard component for monitoring ticket sales velocity,
//              early bird quota absorption, automated pricing recommendations,
//              and demand elasticity strategy workbench.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Zap,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Sliders,
  ChevronRight,
  RefreshCw,
  Tag,
  Flame,
  ArrowUpRight,
  PieChart,
  ShieldCheck,
  Check,
} from "lucide-react";
import type {
  EarlyBirdAnalyticsData,
  PricingRecommendation,
  TicketTier,
} from "@/types/dynamicEarlyBirdDiscount";
import {
  simulatePricingScenario,
  getMockEarlyBirdData,
} from "@/services/dynamicEarlyBirdDiscountService";

interface DynamicEarlyBirdAnalyticsProps {
  eventId?: string;
  eventTitle?: string;
  initialData?: EarlyBirdAnalyticsData;
}

export const DynamicEarlyBirdAnalytics: React.FC<DynamicEarlyBirdAnalyticsProps> = ({
  eventId = "evt-demo-1",
  eventTitle,
  initialData,
}) => {
  const [data, setData] = useState<EarlyBirdAnalyticsData>(
    () => initialData || getMockEarlyBirdData(eventId)
  );

  const [appliedRecommendations, setAppliedRecommendations] = useState<Record<string, boolean>>({});
  const [selectedTierId, setSelectedTierId] = useState<string>(
    data.tiers[0]?.id || "tier-eb-1"
  );

  // Strategy Workbench Interactive Parameters
  const [simPriceDeltaPct, setSimPriceDeltaPct] = useState<number>(0);
  const [simExtensionHours, setSimExtensionHours] = useState<number>(0);
  const [simQuotaDelta, setSimQuotaDelta] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const earlyBirdTier = useMemo(
    () => data.tiers.find((t) => t.id === data.earlyBirdMetrics.tierId) || data.tiers[0],
    [data]
  );

  const selectedTier = useMemo(
    () => data.tiers.find((t) => t.id === selectedTierId) || earlyBirdTier,
    [data, selectedTierId, earlyBirdTier]
  );

  // Calculate simulated scenario matrix
  const scenarioMatrix = useMemo(
    () => simulatePricingScenario(data.tiers, selectedTierId, simPriceDeltaPct, simExtensionHours, simQuotaDelta),
    [data.tiers, selectedTierId, simPriceDeltaPct, simExtensionHours, simQuotaDelta]
  );

  const currentScenario = useMemo(
    () => scenarioMatrix.find((s) => s.priceDeltaPct === simPriceDeltaPct) || scenarioMatrix[2],
    [scenarioMatrix, simPriceDeltaPct]
  );

  const handleApplyRecommendation = (rec: PricingRecommendation) => {
    setAppliedRecommendations((prev) => ({ ...prev, [rec.id]: true }));

    // Apply params to live simulator state if applicable
    if (rec.actionableParams.suggestedPrice && selectedTier) {
      const delta = Math.round(
        ((rec.actionableParams.suggestedPrice - selectedTier.originalPrice) / selectedTier.originalPrice) * 100
      );
      setSimPriceDeltaPct(delta);
    }
    if (rec.actionableParams.suggestedDeadlineExtensionHours) {
      setSimExtensionHours(rec.actionableParams.suggestedDeadlineExtensionHours);
    }
    if (rec.actionableParams.suggestedQuotaAdjustment) {
      setSimQuotaDelta(rec.actionableParams.suggestedQuotaAdjustment);
    }

    showToast(`Recommendation "${rec.title}" applied to dynamic pricing strategy!`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const resetSimulator = () => {
    setSimPriceDeltaPct(0);
    setSimExtensionHours(0);
    setSimQuotaDelta(0);
    showToast("Strategy simulator reset to baseline.");
  };

  const getTrendBadge = (trend: string) => {
    switch (trend) {
      case "accelerating":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <Flame className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            Accelerating Demand
          </span>
        );
      case "sluggish":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            Sluggish Sales
          </span>
        );
      case "sold_out":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            Tier Sold Out
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
            <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            Steady Pace
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 font-sans text-zinc-900 dark:text-zinc-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-zinc-900 p-4 font-mono text-sm text-white shadow-xl dark:bg-zinc-100 dark:text-zinc-900 animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-zinc-900 via-indigo-950 to-zinc-900 p-6 sm:p-8 text-white shadow-xl border border-zinc-800">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                Ticket Analytics & Pricing AI
              </span>
              {getTrendBadge(data.earlyBirdMetrics.velocityTrend)}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Dynamic "Early Bird" Discount Analytics
            </h1>
            <p className="text-sm text-zinc-300 max-w-2xl">
              Real-time sales velocity monitoring, early bird quota absorption tracking, and automated pricing optimization for <span className="font-semibold text-white">{eventTitle || data.eventTitle}</span>.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-zinc-800/80 backdrop-blur p-4 rounded-xl border border-zinc-700/60">
            <div>
              <p className="text-xs font-mono text-zinc-400 uppercase">Live Sales Velocity</p>
              <p className="text-2xl font-black text-indigo-400 flex items-baseline gap-1">
                {data.overallVelocityPerHour} <span className="text-xs font-normal text-zinc-300">tickets / hr</span>
              </p>
            </div>
            <div className="h-8 w-px bg-zinc-700" />
            <div>
              <p className="text-xs font-mono text-zinc-400 uppercase">Total Revenue</p>
              <p className="text-2xl font-black text-emerald-400">
                ${data.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Quota Absorption */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-mono font-bold uppercase">Early Bird Absorption</span>
            <PieChart className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold">
              {Math.round(data.earlyBirdMetrics.absorptionRate * 100)}%
            </span>
            <span className="text-xs font-mono text-zinc-500">
              {data.earlyBirdMetrics.soldCount} / {data.earlyBirdMetrics.totalQuota} Sold
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(data.earlyBirdMetrics.absorptionRate * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Peak Velocity Rate */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-mono font-bold uppercase">Peak Sales Velocity</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {data.earlyBirdMetrics.peakVelocityPerHour}
            </span>
            <span className="text-xs font-mono text-zinc-500">Tickets / Hour Peak</span>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            Time to 50%: <span className="font-semibold text-zinc-700 dark:text-zinc-200">{data.earlyBirdMetrics.timeTo50PercentSoldHours || 12} hours</span>
          </p>
        </div>

        {/* Metric 3: Revenue Yield Performance */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-mono font-bold uppercase">Revenue Yield Vs Target</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {data.earlyBirdMetrics.revenueYieldPct}%
            </span>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center font-bold">
              <ArrowUpRight className="h-4 w-4" /> +14.2%
            </span>
          </div>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Current Tier Rev: <span className="font-semibold text-zinc-700 dark:text-zinc-200">${data.earlyBirdMetrics.revenueGenerated.toLocaleString()}</span>
          </p>
        </div>

        {/* Metric 4: Total Capacity Sold */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-mono font-bold uppercase">Overall Venue Capacity</span>
            <ShieldCheck className="h-4 w-4 text-blue-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold">
              {Math.round((data.totalSold / data.totalCapacity) * 100)}%
            </span>
            <span className="text-xs font-mono text-zinc-500">
              {data.totalSold} / {data.totalCapacity} Total
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((data.totalSold / data.totalCapacity) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ticket Tier Breakdown Table & Velocity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Breakdown */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Active Ticket Tiers & Velocity Status</h2>
              <p className="text-xs text-zinc-500">Live ticket sales and tier quota allocation breakdown</p>
            </div>
            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded border border-indigo-200 dark:border-indigo-800">
              {data.tiers.length} Active Tiers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 font-mono text-xs font-bold uppercase text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Tier Name</th>
                  <th className="py-3 px-4">Current Price</th>
                  <th className="py-3 px-4">Quota Sold</th>
                  <th className="py-3 px-4">Absorption</th>
                  <th className="py-3 px-4">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.tiers.map((tier) => {
                  const absorption = Math.round((tier.soldCount / tier.quota) * 100);
                  const isSelected = tier.id === selectedTierId;
                  return (
                    <tr
                      key={tier.id}
                      onClick={() => setSelectedTierId(tier.id)}
                      className={`cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                        isSelected ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <Tag className={`h-4 w-4 ${isSelected ? "text-indigo-600" : "text-zinc-400"}`} />
                          <span>{tier.name}</span>
                          {tier.id === data.earlyBirdMetrics.tierId && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              EARLY BIRD
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        ${tier.currentPrice}
                        {tier.currentPrice < tier.originalPrice && (
                          <span className="ml-1 text-xs text-zinc-400 line-through">
                            ${tier.originalPrice}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                        {tier.soldCount} / {tier.quota}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                            <div
                              className="h-full bg-indigo-600 rounded-full"
                              style={{ width: `${absorption}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold">{absorption}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ${(tier.soldCount * tier.currentPrice).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Velocity Time-Series Summary Widget */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              Sales Velocity Curve
            </h2>
            <span className="text-xs font-mono text-zinc-400">Hourly Rate</span>
          </div>

          <p className="text-xs text-zinc-500">
            Recent velocity data points recorded over the ticket sales timeline:
          </p>

          <div className="space-y-3">
            {data.velocityTimeSeries.map((point, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 font-mono text-xs"
              >
                <div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {new Date(point.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                    })}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Cumul. Sales: <span className="font-bold">{point.cumulativeSales} tickets</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                    {point.velocityPerHour} tix / hr
                  </span>
                  <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                    +${point.revenueDelta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Automated Pricing Recommendations Feed */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-amber-500 animate-spin" />
              Automated Pricing & Early Bird Recommendations
            </h2>
            <p className="text-xs text-zinc-500">
              Data-driven recommendations generated by analyzing sales velocity acceleration and tier demand
            </p>
          </div>
          <span className="self-start sm:self-center font-mono text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            {data.recommendations.length} Recommendations Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.recommendations.map((rec) => {
            const isApplied = !!appliedRecommendations[rec.id];
            return (
              <div
                key={rec.id}
                className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all ${
                  isApplied
                    ? "border-emerald-500 bg-emerald-50/20 dark:border-emerald-600 dark:bg-emerald-950/20"
                    : "border-zinc-200 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-800/40 hover:border-indigo-300 dark:hover:border-indigo-700"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-mono font-bold uppercase ${
                        rec.urgency === "high"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : rec.urgency === "medium"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}
                    >
                      {rec.urgency} Urgency
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      +{rec.projectedRevenueImpactPct}% Rev. Impact
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {rec.title}
                  </h3>

                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {rec.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-zinc-200/80 dark:border-zinc-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                    <span>Confidence:</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {rec.confidenceScore}%
                    </span>
                  </div>

                  <button
                    onClick={() => handleApplyRecommendation(rec)}
                    disabled={isApplied}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 font-mono text-xs font-bold transition-colors ${
                      isApplied
                        ? "bg-emerald-600 text-white cursor-default"
                        : "bg-zinc-900 text-white hover:bg-indigo-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-indigo-500 dark:hover:text-white"
                    }`}
                  >
                    {isApplied ? (
                      <>
                        <Check className="h-4 w-4" /> Applied Strategy
                      </>
                    ) : (
                      <>
                        Apply Recommendation <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demand Elasticity Strategy Simulator */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sliders className="h-6 w-6 text-indigo-500" />
              Dynamic Strategy Workbench & Elasticity Simulator
            </h2>
            <p className="text-xs text-zinc-500">
              Simulate projected ticket turnout and revenue under custom early bird discount percentages, tier deadline extensions, and quota share reallocations.
            </p>
          </div>

          <button
            onClick={resetSimulator}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs font-bold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reset Parameters
          </button>
        </div>

        {/* Slider Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50 dark:bg-zinc-800/40 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
          {/* Slider 1: Price Delta % */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono font-bold">
              <span>Price Delta Adjustment:</span>
              <span className={`text-sm ${simPriceDeltaPct > 0 ? "text-emerald-600" : simPriceDeltaPct < 0 ? "text-amber-600" : ""}`}>
                {simPriceDeltaPct > 0 ? `+${simPriceDeltaPct}%` : `${simPriceDeltaPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="30"
              step="5"
              value={simPriceDeltaPct}
              onChange={(e) => setSimPriceDeltaPct(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>-20% (Max Discount)</span>
              <span>Baseline</span>
              <span>+30% (High Margin)</span>
            </div>
          </div>

          {/* Slider 2: Deadline Extension Hours */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono font-bold">
              <span>Early Bird Window Extension:</span>
              <span className="text-sm text-indigo-600 dark:text-indigo-400">
                +{simExtensionHours} Hours
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="72"
              step="12"
              value={simExtensionHours}
              onChange={(e) => setSimExtensionHours(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>0 Hours</span>
              <span>+36 Hours</span>
              <span>+72 Hours</span>
            </div>
          </div>

          {/* Slider 3: Quota Delta */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono font-bold">
              <span>Tier Quota Adjustment:</span>
              <span className="text-sm text-indigo-600 dark:text-indigo-400">
                {simQuotaDelta > 0 ? `+${simQuotaDelta}` : simQuotaDelta} Tickets
              </span>
            </div>
            <input
              type="range"
              min="-30"
              max="50"
              step="10"
              value={simQuotaDelta}
              onChange={(e) => setSimQuotaDelta(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-400">
              <span>-30 Tickets</span>
              <span>Baseline</span>
              <span>+50 Tickets</span>
            </div>
          </div>
        </div>

        {/* Simulated Elasticity Output Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-mono font-bold uppercase text-zinc-500">
            Demand Elasticity & Turnout Forecast Matrix
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 font-mono text-xs font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <tr>
                  <th className="py-2.5 px-4">Price Scenario</th>
                  <th className="py-2.5 px-4">Simulated Price</th>
                  <th className="py-2.5 px-4">Projected Turnout</th>
                  <th className="py-2.5 px-4">Venue Fill %</th>
                  <th className="py-2.5 px-4">Projected Total Revenue</th>
                  <th className="py-2.5 px-4">Revenue Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {scenarioMatrix.map((sc) => {
                  const isSelected = sc.priceDeltaPct === simPriceDeltaPct;
                  return (
                    <tr
                      key={sc.priceDeltaPct}
                      onClick={() => setSimPriceDeltaPct(sc.priceDeltaPct)}
                      className={`cursor-pointer font-mono text-xs transition-colors ${
                        isSelected
                          ? "bg-indigo-100/70 font-bold dark:bg-indigo-950/80 text-indigo-900 dark:text-indigo-200"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                      }`}
                    >
                      <td className="py-3 px-4">
                        {sc.priceDeltaPct === 0 ? (
                          <span className="rounded bg-zinc-200 px-2 py-0.5 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                            Baseline (0%)
                          </span>
                        ) : sc.priceDeltaPct > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{sc.priceDeltaPct}% Price Step
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            {sc.priceDeltaPct}% Discount
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">${sc.simulatedPrice}</td>
                      <td className="py-3 px-4">{sc.projectedTurnout} Attendees</td>
                      <td className="py-3 px-4">{sc.projectedTurnoutPctOfCapacity}%</td>
                      <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">
                        ${sc.projectedRevenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold">
                        {sc.revenueDifference > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +${sc.revenueDifference.toLocaleString()}
                          </span>
                        ) : sc.revenueDifference < 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            -${Math.abs(sc.revenueDifference).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-400">$0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
