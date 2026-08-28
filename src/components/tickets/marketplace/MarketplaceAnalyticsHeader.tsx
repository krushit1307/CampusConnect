import React from "react";
import { MarketplaceStats } from "@/types/ticketTransferMarketplace";
import { Ticket, DollarSign, TrendingUp, ShieldCheck, Flame } from "lucide-react";

interface MarketplaceAnalyticsHeaderProps {
  stats: MarketplaceStats;
}

export const MarketplaceAnalyticsHeader: React.FC<MarketplaceAnalyticsHeaderProps> = ({
  stats,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Active Listings */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
          <span>Active Listings</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
            <Ticket className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-black text-white">{stats.totalActiveListings}</span>
          <span className="text-xs text-slate-500">tickets listed</span>
        </div>
        <div className="mt-2 text-[11px] text-blue-400 font-medium flex items-center gap-1">
          <ShieldCheck className="h-3 w-3" /> 100% Student Verified
        </div>
      </div>

      {/* Metric 2: Avg Resale vs Face Value */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
          <span>Avg Resale Price</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <DollarSign className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">
            ${(stats.avgResalePriceCents / 100).toFixed(2)}
          </span>
          <span className="text-xs text-slate-500">
            (Face ${(stats.avgFaceValueCents / 100).toFixed(2)})
          </span>
        </div>
        <div className="mt-2 text-[11px] text-emerald-400 font-medium">
          Anti-Scalping Cap Protected
        </div>
      </div>

      {/* Metric 3: Demand Index */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
          <span>Demand Ratio</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
            <Flame className="h-4 w-4 fill-amber-400" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">{stats.demandIndex}x</span>
          <span className="text-xs text-slate-500">buyers / listing</span>
        </div>
        <div className="mt-2 text-[11px] text-amber-400 font-medium">
          High student demand
        </div>
      </div>

      {/* Metric 4: Total Volume Transferred */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400">
          <span>Total Transferred</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-black text-white">
            ${(stats.totalVolumeTransferredCents / 100).toLocaleString()}
          </span>
        </div>
        <div className="mt-2 text-[11px] text-purple-400 font-medium">
          {stats.totalTransfersCompleted} safe exchanges
        </div>
      </div>
    </div>
  );
};
