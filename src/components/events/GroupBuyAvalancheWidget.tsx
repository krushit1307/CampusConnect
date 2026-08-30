import React, { useState } from "react";
import {
  Flame,
  Users,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  Lock,
  CreditCard,
  TrendingDown,
  Tag,
  ShieldCheck,
} from "lucide-react";
import {
  GroupBuyCampaign,
  GroupBuyCommitResult,
  calculateCampaignProgress,
  processGroupBuyCommit,
} from "@/lib/groupBuyAvalanche";
import { cn } from "@/lib/utils";

export interface GroupBuyAvalancheWidgetProps {
  eventId?: string;
  eventTitle?: string;
  initialCampaign?: GroupBuyCampaign;
  onCommitSuccess?: (result: GroupBuyCommitResult, campaign: GroupBuyCampaign) => void;
  className?: string;
}

export const DEFAULT_CAMPAIGN: GroupBuyCampaign = {
  campaignId: "gbu-gala-2026",
  eventId: "evt-gala-2026",
  originalPrice: 30.0,
  discountedPrice: 15.0,
  targetCommitsCount: 100,
  currentCommitsCount: 85,
  expiresAt: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
  status: "active",
};

export const GroupBuyAvalancheWidget: React.FC<GroupBuyAvalancheWidgetProps> = ({
  eventId = "evt-gala-2026",
  eventTitle = "Spring Innovation Gala 2026",
  initialCampaign = DEFAULT_CAMPAIGN,
  onCommitSuccess,
  className,
}) => {
  const [campaign, setCampaign] = useState<GroupBuyCampaign>(initialCampaign);
  const [commitResult, setCommitResult] = useState<GroupBuyCommitResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { percent, remaining, discountPercent } = calculateCampaignProgress(
    campaign.currentCommitsCount,
    campaign.targetCommitsCount,
    campaign.originalPrice,
    campaign.discountedPrice
  );

  const handleCommit = () => {
    const { updatedCampaign, commitResult: result } = processGroupBuyCommit(
      campaign,
      "u-current-student"
    );

    setCampaign(updatedCampaign);
    setCommitResult(result);

    if (onCommitSuccess) onCommitSuccess(result, updatedCampaign);

    if (result.isTargetReached) {
      setNotice(
        `🔥 GROUP BUY AVALANCHE UNLOCKED! Target hit (${updatedCampaign.currentCommitsCount}/100). All Stripe holds captured at 50% OFF ($15.00)!`
      );
    } else {
      setNotice(
        `Card authorized for $${campaign.originalPrice.toFixed(
          2
        )} hold (Auth without Capture). Only ${remaining - 1} more commits needed for 50% OFF!`
      );
    }

    setTimeout(() => setNotice(null), 6000);
  };

  const isSuccess = campaign.status === "successful";

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-amber-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-amber-950">
            <Flame className="w-5 h-5 text-amber-600 animate-bounce" />
            <span>"Group Buy" Avalanche Dynamic Pricing — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Viral gamified pricing model: Collective action lowers the price for everyone! Stripe holds authorized at $30, captured at $15 upon target unlock.
          </p>
        </div>

        <span
          className={cn(
            "px-3 py-1 font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
            isSuccess ? "bg-emerald-600 text-white animate-pulse" : "bg-black text-white"
          )}
        >
          <Tag className="w-3.5 h-3.5 text-amber-400" />
          <span>{isSuccess ? "🎉 50% OFF AVALANCHE UNLOCKED" : "🔥 GROUP BUY ACTIVE"}</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Progress Bar, Price Badges & Commit Trigger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Real-Time WebSocket Progress Bar */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-600" />
              Live Group Buy Progress (WebSocket)
            </h4>
            <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" /> 14h 32m left
            </span>
          </div>

          {/* Progress Banner Text */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-gray-900">
                {campaign.currentCommitsCount} / {campaign.targetCommitsCount} Commits Reached
              </span>
              <span className="text-amber-700 font-mono font-black">{percent}%</span>
            </div>

            <p className="text-xs font-sans text-amber-900 font-bold">
              {isSuccess
                ? "🎉 AVALANCHE TARGET REACHED! Everyone gets 50% off!"
                : `${remaining} more commits needed and EVERYONE gets ${discountPercent}% off!`}
            </p>
          </div>

          {/* Neo-brutalist Progress Bar Track */}
          <div className="w-full h-6 bg-slate-100 border-2 border-black rounded-lg overflow-hidden relative shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div
              className="h-full bg-amber-500 border-r-2 border-black transition-all duration-500 flex items-center justify-end pr-2 text-[10px] font-black text-black"
              style={{ width: `${percent}%` }}
            >
              {percent > 15 ? `${percent}%` : ""}
            </div>
          </div>
        </div>

        {/* Right Column: Price Tiers & Commit Hold Action Button */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <CreditCard className="w-4 h-4 text-amber-600" />
            Group Buy Price Tiers & Stripe Hold
          </h4>

          {/* Price Badges */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Standard Price</span>
              <span className="font-black text-lg text-gray-900 font-mono line-through">
                ${campaign.originalPrice.toFixed(2)}
              </span>
              <p className="text-[10px] font-sans text-gray-500">Authorized as card hold</p>
            </div>

            <div className="p-3 border-2 border-black rounded-lg bg-amber-100 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-amber-900 uppercase block">Avalanche Price</span>
              <span className="font-black text-xl text-amber-700 font-mono">
                ${campaign.discountedPrice.toFixed(2)}
              </span>
              <p className="text-[10px] font-sans text-amber-900 font-bold">50% Off upon 100 commits</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCommit}
            disabled={campaign.status === "failed"}
            className="w-full py-3 px-4 border-2 border-black bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-black" />
            <span>
              {isSuccess
                ? "Join Avalanche Group Buy ($15.00)"
                : `Commit to Group Buy ($${campaign.originalPrice.toFixed(2)} Hold)`}
            </span>
          </button>

          <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-sans">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Zero risk: If 100 commits are not reached, $0 is charged & card holds are released.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
