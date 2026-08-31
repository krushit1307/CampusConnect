import React, { useState } from "react";
import {
  Fuel,
  DollarSign,
  Users,
  CheckCircle2,
  Send,
  CreditCard,
  Car,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  CarpoolRider,
  CarpoolGasSplitRequest,
  CarpoolGasSplitResult,
  calculateGasCostSplit,
  formatCurrency,
  processCarpoolGasSplit,
} from "@/lib/carpoolGasSplitter";
import { cn } from "@/lib/utils";

export interface CarpoolGasCostSplitterWidgetProps {
  tripId?: string;
  driverId?: string;
  driverName?: string;
  tripTitle?: string;
  initialRiders?: CarpoolRider[];
  onSettlementCompleted?: (result: CarpoolGasSplitResult) => void;
  className?: string;
}

export const MOCK_RIDERS: CarpoolRider[] = [
  { riderId: "rider-1", fullName: "Alice Vance", handle: "alice_v" },
  { riderId: "rider-2", fullName: "Bob Chen", handle: "bob_c" },
  { riderId: "rider-3", fullName: "Elena Rostova", handle: "elena_r" },
];

export const CarpoolGasCostSplitterWidget: React.FC<CarpoolGasCostSplitterWidgetProps> = ({
  tripId = "trip-hackathon-2026",
  driverId = "driver-alex-101",
  driverName = "Alex Rivera",
  tripTitle = "Campus to Regional Robotics Competition",
  initialRiders = MOCK_RIDERS,
  onSettlementCompleted,
  className,
}) => {
  const [totalGasCostInput, setTotalGasCostInput] = useState<number>(15.0);
  const [settlementResult, setSettlementResult] = useState<CarpoolGasSplitResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { splitAmountPerRider } = calculateGasCostSplit(totalGasCostInput, initialRiders.length);

  const handleExecuteSplit = (e: React.FormEvent) => {
    e.preventDefault();
    const request: CarpoolGasSplitRequest = {
      tripId,
      driverId,
      driverName,
      totalGasCost: totalGasCostInput,
      riders: initialRiders,
    };

    const result = processCarpoolGasSplit(request);
    setSettlementResult(result);

    if (onSettlementCompleted) onSettlementCompleted(result);

    setNotice(
      `Gas receipt of ${formatCurrency(totalGasCostInput)} split! ${formatCurrency(
        result.driverCreditAmount
      )} transferred to ${driverName}'s Stripe Express account.`
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
      <div className="p-5 bg-emerald-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-emerald-950">
            <Fuel className="w-5 h-5 text-emerald-700 animate-pulse" />
            <span>Dynamic "Carpool" Gas Cost Splitter — {tripTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Automated programmatic micro-transfers compensating drivers via platform funds / Stripe Express transfers. Eliminates P2P Venmo friction.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Car className="w-3.5 h-3.5 text-emerald-400" />
          <span>Trip Completed</span>
        </span>
      </div>

      {/* Confirmation Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Gas Receipt Input & Settlement Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Gas Receipt Calculator Form */}
        <form onSubmit={handleExecuteSplit} className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            Gas Receipt Calculator & Payout Trigger
          </h4>

          <div className="space-y-2">
            <label htmlFor="gas-total-input" className="text-xs font-bold uppercase block text-gray-700">
              Total Gas Receipt Amount ($) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 font-bold text-gray-500">$</span>
              <input
                id="gas-total-input"
                type="number"
                step="0.01"
                min="1"
                required
                value={totalGasCostInput}
                onChange={(e) => setTotalGasCostInput(Number(e.target.value))}
                className="w-full pl-8 pr-3 py-2 border-2 border-black rounded-md text-sm font-bold font-mono bg-white"
              />
            </div>
          </div>

          {/* Split Calculation Live Preview */}
          <div className="p-3.5 border-2 border-black rounded-lg bg-emerald-50 space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center text-emerald-950">
              <span className="text-[10px] font-bold uppercase text-gray-600">Calculated Per-Rider Split:</span>
              <span className="font-black text-emerald-700 text-lg">{formatCurrency(splitAmountPerRider)} / rider</span>
            </div>
            <p className="text-[11px] font-sans text-emerald-900 leading-snug">
              {formatCurrency(totalGasCostInput)} divided among {initialRiders.length} passengers.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4 text-amber-300" />
            Split Gas & Credit Driver ({formatCurrency(totalGasCostInput)})
          </button>
        </form>

        {/* Right Column: Rider Deductions Breakdown & Stripe Express Payout Record */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Rider Deductions & Payout Ledger
          </h4>

          {/* Rider List */}
          <div className="space-y-2">
            {initialRiders.map((r) => (
              <div
                key={r.riderId}
                className="p-3 border-2 border-black rounded-lg bg-white flex justify-between items-center text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <div>
                  <span className="font-bold text-gray-900 block">{r.fullName}</span>
                  <span className="text-[10px] text-gray-500 font-sans">@{r.handle}</span>
                </div>
                <span className="font-mono font-bold text-rose-600">
                  -{formatCurrency(splitAmountPerRider)}
                </span>
              </div>
            ))}
          </div>

          {/* Stripe Express Payout Record Banner */}
          {settlementResult && (
            <div className="p-3.5 border-2 border-black rounded-lg bg-slate-900 text-white space-y-2 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-emerald-400 font-bold border-b border-slate-700 pb-1.5">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> STRIPE EXPRESS TRANSFER
                </span>
                <span>STATUS: SETTLED</span>
              </div>

              <div className="space-y-1 text-[11px] text-gray-300">
                <p>Transfer ID: <span className="text-white font-bold">{settlementResult.stripeTransferId}</span></p>
                <p>Driver Credited: <span className="text-emerald-400 font-bold">+{formatCurrency(settlementResult.driverCreditAmount)}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
