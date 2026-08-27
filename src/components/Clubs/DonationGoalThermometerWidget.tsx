import React, { useState, useEffect } from "react";
import {
  Flame,
  Heart,
  DollarSign,
  Sparkles,
  TrendingUp,
  Award,
  Users,
  PartyPopper,
  Radio,
  Zap,
} from "lucide-react";
import {
  DonationCampaignSummary,
  DonationRecord,
  calculateCampaignProgress,
  formatDonationCurrency,
  addDonationToCampaign,
} from "@/lib/donationGoalThermometer";
import { cn } from "@/lib/utils";

export interface DonationGoalThermometerWidgetProps {
  campaignId?: string;
  title?: string;
  targetAmount?: number;
  initialCurrentAmount?: number;
  initialDonors?: DonationRecord[];
  onDonationMade?: (summary: DonationCampaignSummary) => void;
  className?: string;
}

export const MOCK_DONATION_CAMPAIGN: DonationCampaignSummary = {
  campaignId: "camp-robotics-2026",
  title: "National Robotics Competition Fund 2026",
  targetAmount: 5000,
  currentAmount: 2000,
  progressPercentage: 40,
  isGoalReached: false,
  recentDonors: [
    { id: "don-1", campaignId: "camp-robotics-2026", donorName: "Alice Vance", amount: 50, createdAt: new Date().toISOString() },
    { id: "don-2", campaignId: "camp-robotics-2026", donorName: "Dr. Robert Marcus", amount: 250, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "don-3", campaignId: "camp-robotics-2026", donorName: "Elena Rostova", amount: 100, createdAt: new Date(Date.now() - 7200000).toISOString() },
  ],
};

export const DonationGoalThermometerWidget: React.FC<DonationGoalThermometerWidgetProps> = ({
  campaignId = "camp-robotics-2026",
  title = "National Robotics Competition Fund 2026",
  targetAmount = 5000,
  initialCurrentAmount = 2000,
  initialDonors,
  onDonationMade,
  className,
}) => {
  const [summary, setSummary] = useState<DonationCampaignSummary>(() => {
    const initial = calculateCampaignProgress(targetAmount, initialCurrentAmount);
    return {
      campaignId,
      title,
      targetAmount,
      currentAmount: initialCurrentAmount,
      progressPercentage: initial.progressPercentage,
      isGoalReached: initial.isGoalReached,
      recentDonors: initialDonors || MOCK_DONATION_CAMPAIGN.recentDonors,
    };
  });

  const [donorNameInput, setDonorNameInput] = useState<string>("Anonymous Supporter");
  const [customAmountInput, setCustomAmountInput] = useState<number>(50);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [lastDonationToast, setLastDonationToast] = useState<string | null>(null);

  const handleSimulateDonation = (amount: number) => {
    const updated = addDonationToCampaign(summary, donorNameInput, amount);
    setSummary(updated);

    if (updated.isGoalReached && !summary.isGoalReached) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 6000);
    }

    if (onDonationMade) onDonationMade(updated);

    setLastDonationToast(`🎉 ${donorNameInput} just donated ${formatDonationCurrency(amount)}!`);
    setTimeout(() => setLastDonationToast(null), 4000);
  };

  const clampedProgress = Math.min(100, Math.max(0, summary.progressPercentage));

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Top Header Bar */}
      <div className="p-5 bg-rose-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-rose-950">
            <Flame className="w-5 h-5 text-rose-600 animate-bounce" />
            <span>Real-Time "Donation Goal" Thermometer — {summary.title}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            WebSocket-powered fundraising widget. Mercury tube animates in real-time as supporters complete Stripe donation checkouts.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>Live WebSocket Feed</span>
        </span>
      </div>

      {/* Confetti Celebration Banner when Goal Reached (#4402) */}
      {(showConfetti || summary.isGoalReached) && (
        <div className="p-3.5 bg-amber-300 border-b-2 border-black text-xs font-black text-amber-950 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <PartyPopper className="w-5 h-5 text-rose-600 shrink-0" />
            <span>🎉 FUNDRAISING GOAL REACHED! {formatDonationCurrency(summary.currentAmount)} RAISED! THANK YOU DONORS!</span>
          </div>
          <span className="px-2 py-0.5 bg-black text-white rounded text-[10px] uppercase font-bold">100% UNLOCKED</span>
        </div>
      )}

      {/* Live Toast Notification */}
      {lastDonationToast && (
        <div className="p-3 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{lastDonationToast}</span>
        </div>
      )}

      {/* Overview Metric Bar */}
      <div className="p-5 bg-slate-50 border-b-2 border-black grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Raised</span>
          <span className="text-2xl font-black text-rose-600">{formatDonationCurrency(summary.currentAmount)}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Stripe verified gifts</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Campaign Goal</span>
          <span className="text-2xl font-black text-indigo-950">{formatDonationCurrency(summary.targetAmount)}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Target benchmark</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-rose-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold uppercase text-rose-900 block">Goal Progress</span>
          <span className="text-2xl font-black text-rose-600">{summary.progressPercentage}%</span>
          <span className="text-[11px] font-sans text-rose-900 block font-medium">
            {summary.isGoalReached ? "🎉 Target achieved!" : `${formatDonationCurrency(summary.targetAmount - summary.currentAmount)} remaining`}
          </span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Donors</span>
          <span className="text-2xl font-black text-emerald-600">{summary.recentDonors.length}</span>
          <span className="text-[11px] font-sans text-gray-600 block">Unique supporters</span>
        </div>
      </div>

      {/* Main Grid: Interactive SVG Thermometer & Live Donor Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
        {/* Visual SVG Thermometer Graphic Column */}
        <div className="lg:col-span-2 p-6 border-b-2 lg:border-b-0 lg:border-r-2 border-black space-y-4 bg-white flex flex-col items-center justify-center">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 self-start flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-600" />
            Interactive SVG Donation Thermometer
          </h4>

          {/* SVG Thermometer Graphic Container */}
          <div className="relative flex items-center gap-8 py-4">
            {/* SVG Thermometer */}
            <div className="relative w-24 h-80 flex flex-col items-center justify-end">
              {/* Thermometer Tube Outer Glass */}
              <div className="w-10 h-64 bg-slate-100 border-4 border-black rounded-t-full relative overflow-hidden flex flex-col justify-end p-1 shadow-inner">
                {/* Mercury Liquid Column */}
                <div
                  className="w-full bg-gradient-to-t from-rose-700 via-rose-500 to-rose-400 rounded-t transition-all duration-700 ease-out"
                  style={{ height: `${clampedProgress}%` }}
                />
              </div>

              {/* Thermometer Bottom Bulb */}
              <div className="w-20 h-20 bg-rose-600 border-4 border-black rounded-full -mt-4 z-10 flex items-center justify-center shadow-md">
                <Heart className="w-8 h-8 text-white fill-white animate-pulse" />
              </div>
            </div>

            {/* Percentage Markers Column */}
            <div className="h-64 flex flex-col justify-between text-xs font-mono text-gray-700 py-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-600 text-sm">100%</span>
                <span className="text-[11px] text-gray-500">({formatDonationCurrency(summary.targetAmount)})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">75%</span>
                <span className="text-[11px] text-gray-500">({formatDonationCurrency(summary.targetAmount * 0.75)})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">50%</span>
                <span className="text-[11px] text-gray-500">({formatDonationCurrency(summary.targetAmount * 0.5)})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800">25%</span>
                <span className="text-[11px] text-gray-500">({formatDonationCurrency(summary.targetAmount * 0.25)})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500">0%</span>
                <span className="text-[11px] text-gray-500">($0)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Scrolling Donor Ticker & Donation Simulator Column */}
        <div className="lg:col-span-1 p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Users className="w-4 h-4 text-rose-600" />
            Live Donor Ticker Feed
          </h4>

          {/* Scrolling Recent Donors Ticker */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {summary.recentDonors.map((don) => (
              <div
                key={don.id}
                className="p-2.5 border-2 border-black rounded-lg bg-white flex items-center justify-between text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <div>
                  <span className="font-bold text-gray-900 block">{don.donorName}</span>
                  <span className="text-[10px] text-gray-500 font-sans">Just now via Stripe</span>
                </div>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  +{formatDonationCurrency(don.amount)}
                </span>
              </div>
            ))}
          </div>

          {/* Instant Stripe Donation Simulator */}
          <div className="p-4 border-2 border-black rounded-lg bg-white space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs">
            <span className="font-bold uppercase text-gray-800 block text-[11px]">
              Simulate Instant Stripe Donation
            </span>

            <div>
              <label htmlFor="donor-name-input" className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                Your Name / Supporter Handle:
              </label>
              <input
                id="donor-name-input"
                type="text"
                value={donorNameInput}
                onChange={(e) => setDonorNameInput(e.target.value)}
                className="w-full px-2.5 py-1.5 border-2 border-black rounded text-xs font-mono bg-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSimulateDonation(25)}
                className="p-2 border-2 border-black bg-rose-100 hover:bg-rose-200 font-bold text-xs rounded text-rose-950"
              >
                +$25
              </button>
              <button
                type="button"
                onClick={() => handleSimulateDonation(50)}
                className="p-2 border-2 border-black bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded"
              >
                +$50
              </button>
              <button
                type="button"
                onClick={() => handleSimulateDonation(250)}
                className="p-2 border-2 border-black bg-amber-300 hover:bg-amber-400 font-bold text-xs rounded text-amber-950"
              >
                +$250
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
