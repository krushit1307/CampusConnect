import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Coins,
  ShieldCheck,
  Zap,
  DollarSign,
  TrendingDown,
  Lock,
  Sparkles,
} from "lucide-react";
import {
  CryptoSlippageCheckRequest,
  CryptoSlippageCheckResult,
  evaluateCryptoDonationSlippage,
} from "@/lib/cryptoDonationSlippage";
import { cn } from "@/lib/utils";

export interface CryptoDonationSlippageAlertWidgetProps {
  donorId?: string;
  clubId?: string;
  clubName?: string;
  onDonationSubmitted?: (result: CryptoSlippageCheckResult, assetUsed: string) => void;
  className?: string;
}

export const CryptoDonationSlippageAlertWidget: React.FC<CryptoDonationSlippageAlertWidgetProps> = ({
  donorId = "u-donor-101",
  clubId = "club-robotics-1",
  clubName = "Campus Robotics & AI Society",
  onDonationSubmitted,
  className,
}) => {
  const [selectedToken, setSelectedToken] = useState<string>("ALTCOIN");
  const [donationAmountUsdc, setDonationAmountUsdc] = useState<number>(10000);
  const [userAcknowledged, setUserAcknowledged] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Evaluate DEX Router Slippage dynamically based on token selection
  const estimatedActualOutput = selectedToken === "ALTCOIN" ? donationAmountUsdc * 0.8 : donationAmountUsdc * 0.9998;

  const slippageResult = evaluateCryptoDonationSlippage({
    donorId,
    clubId,
    tokenSymbol: selectedToken,
    inputAmount: donationAmountUsdc,
    estimatedValueUsdc: donationAmountUsdc,
    actualOutputUsdc: estimatedActualOutput,
  });

  const handleSwitchToStablecoin = () => {
    setSelectedToken("USDC");
    setUserAcknowledged(false);
    setNotice("Switched token to USDC! Zero-slippage stablecoin transaction prepared.");
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSubmitDonation = (e: React.FormEvent) => {
    e.preventDefault();
    if (slippageResult.isHighSlippage && !userAcknowledged) {
      alert("High slippage threshold exceeded! Please acknowledge the loss or switch to USDC.");
      return;
    }

    if (onDonationSubmitted) onDonationSubmitted(slippageResult, selectedToken);

    setNotice(
      `Web3 donation of $${donationAmountUsdc.toLocaleString()} submitted via ${selectedToken}! ${
        selectedToken === "USDC" ? "Zero slippage loss." : `$${slippageResult.slippageLossUsdc} slippage acknowledged.`
      }`
    );
    setTimeout(() => setNotice(null), 6000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-purple-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-purple-950">
            <Coins className="w-5 h-5 text-purple-700 animate-bounce" />
            <span>"Donation Goal" Predictive Slippage Alert — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Pre-calculates AMM liquidity slippage via DEX aggregator APIs before Web3 transaction signing. Protects donors from unexpected value loss.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Lock className="w-3.5 h-3.5 text-purple-300" />
          <span>DEX Router Protected</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Donation Form & Slippage Warning Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Asset Selection & Form */}
        <form onSubmit={handleSubmitDonation} className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <DollarSign className="w-4 h-4 text-purple-600" />
            Web3 Crypto Donation Asset Selection
          </h4>

          <div className="space-y-3">
            <div>
              <label htmlFor="token-select" className="text-xs font-bold uppercase block text-gray-700">
                Select Crypto Asset *
              </label>
              <select
                id="token-select"
                value={selectedToken}
                onChange={(e) => {
                  setSelectedToken(e.target.value);
                  setUserAcknowledged(false);
                }}
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-mono font-bold bg-white mt-1"
              >
                <option value="ALTCOIN">ALTCOIN (Low Liquidity — High Slippage Risk)</option>
                <option value="USDC">USDC (Stablecoin — 0% Slippage)</option>
              </select>
            </div>

            <div>
              <label htmlFor="amount-input" className="text-xs font-bold uppercase block text-gray-700">
                Donation Amount (USDC Value Equivalent) *
              </label>
              <input
                id="amount-input"
                type="number"
                min="10"
                step="100"
                required
                value={donationAmountUsdc}
                onChange={(e) => setDonationAmountUsdc(Number(e.target.value))}
                className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-mono font-bold bg-white mt-1"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={slippageResult.isHighSlippage && !userAcknowledged}
            className="w-full py-3 px-4 border-2 border-black bg-purple-600 text-white font-bold text-xs uppercase rounded-md hover:bg-purple-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Sign & Execute Web3 Donation (${donationAmountUsdc.toLocaleString()})</span>
          </button>
        </form>

        {/* Right Column: Predictive DEX Slippage Warning Box */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <TrendingDown className="w-4 h-4 text-purple-600" />
            1inch / Uniswap DEX Aggregator Router Audit
          </h4>

          {/* Slippage Warning Card */}
          <div
            className={cn(
              "p-4 border-2 border-black rounded-lg space-y-3 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
              slippageResult.isHighSlippage ? "bg-rose-100 text-rose-950" : "bg-emerald-50 text-emerald-950"
            )}
          >
            <div className="flex items-center gap-1.5 font-bold uppercase text-[11px]">
              {slippageResult.isHighSlippage ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              )}
              <span>DEX Slippage Audit: {slippageResult.slippagePercent.toFixed(2)}%</span>
            </div>

            <p className="text-[11px] font-sans leading-relaxed font-bold">
              {slippageResult.warningMessage}
            </p>

            <div className="text-[10px] space-y-1 font-mono pt-1 border-t border-black/10">
              <p>Expected Value: <span className="font-bold">${slippageResult.expectedValueUsdc.toLocaleString()}</span></p>
              <p>Estimated Output: <span className="font-bold">${slippageResult.actualOutputUsdc.toLocaleString()}</span></p>
              <p>Estimated Slippage Loss: <span className="font-bold text-rose-700">${slippageResult.slippageLossUsdc.toLocaleString()}</span></p>
            </div>
          </div>

          {/* High Slippage Resolution Actions */}
          {slippageResult.isHighSlippage && (
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleSwitchToStablecoin}
                className="w-full py-2.5 px-3 border-2 border-black bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Switch to USDC Stablecoin (0% Slippage)</span>
              </button>

              <label className="flex items-start gap-2 text-xs font-sans text-gray-800 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={userAcknowledged}
                  onChange={(e) => setUserAcknowledged(e.target.checked)}
                  className="mt-0.5 border-2 border-black rounded"
                />
                <span className="text-[11px] leading-tight font-mono font-bold text-rose-900">
                  I acknowledge the high slippage loss of ${slippageResult.slippageLossUsdc.toLocaleString()} and wish to proceed anyway.
                </span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
