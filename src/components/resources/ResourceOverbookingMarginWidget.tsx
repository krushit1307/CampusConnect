import React, { useState } from "react";
import {
  PackageCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Zap,
  Users,
  Radio,
  Layers,
  Volume2,
} from "lucide-react";
import {
  StandbyPromotionResult,
  calculateOverbookingCapacity,
  evaluateNoShowStandbyPromotion,
} from "@/lib/resourceOverbookingMargin";
import { cn } from "@/lib/utils";

export interface ResourceOverbookingMarginWidgetProps {
  assetCategory?: string;
  assetName?: string;
  totalInventoryUnits?: number;
  historicalNoShowRate?: number;
  primaryClubName?: string;
  standbyClubName?: string;
  onStandbyPromoted?: (result: StandbyPromotionResult) => void;
  className?: string;
}

export const ResourceOverbookingMarginWidget: React.FC<ResourceOverbookingMarginWidgetProps> = ({
  assetCategory = "Projectors",
  assetName = "4K Laser Cinema Projector #04",
  totalInventoryUnits = 10,
  historicalNoShowRate = 15.0,
  primaryClubName = "Film & Cinema Society",
  standbyClubName = "Robotics & AI Club",
  onStandbyPromoted,
  className,
}) => {
  const [minutesElapsed, setMinutesElapsed] = useState<number>(0);
  const [primaryScannedRfid, setPrimaryScannedRfid] = useState<boolean>(false);
  const [promotionResult, setPromotionResult] = useState<StandbyPromotionResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { maxAllowedBookings, overbookingMarginPercent } = calculateOverbookingCapacity(
    totalInventoryUnits,
    historicalNoShowRate
  );

  const handleSimulateNoShow = () => {
    setMinutesElapsed(15);
    setPrimaryScannedRfid(false);

    const result = evaluateNoShowStandbyPromotion(
      "queue-projector-101",
      primaryClubName,
      standbyClubName,
      false,
      15,
      assetName
    );

    setPromotionResult(result);
    if (onStandbyPromoted) onStandbyPromoted(result);

    setNotice(
      `No-show confirmed for ${primaryClubName}! ${standbyClubName} promoted to active reservation.`
    );
    setTimeout(() => setNotice(null), 6000);
  };

  const handleSimulateRfidScan = () => {
    setPrimaryScannedRfid(true);
    setPromotionResult(null);

    setNotice(`RFID scan confirmed for ${primaryClubName}! Asset checked out successfully.`);
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-cyan-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-cyan-950">
            <PackageCheck className="w-5 h-5 text-cyan-700 animate-bounce" />
            <span>"Resource Constraint" Overbooking Margin Algorithm — {assetCategory}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Airline-style yield management allowing 110% booking capacity based on 15% historical no-show rates. Auto-promotes standby queue after 15-minute RFID timeout.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Zap className="w-3.5 h-3.5 text-cyan-300" />
          <span>{overbookingMarginPercent}% Overbooked</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Inventory Yield Metrics & Standby Promotion Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Yield Management Metric Cards */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            Statistical Yield & Capacity Metrics
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border-2 border-black rounded-lg bg-cyan-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Historical No-Show Rate</span>
              <span className="font-black text-lg text-cyan-900 font-mono">{historicalNoShowRate}%</span>
              <p className="text-[10px] font-sans text-gray-600">Based on 12-month data</p>
            </div>

            <div className="p-3 border-2 border-black rounded-lg bg-emerald-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Allowed Capacity</span>
              <span className="font-black text-lg text-emerald-900 font-mono">
                {maxAllowedBookings} / {totalInventoryUnits} Units
              </span>
              <p className="text-[10px] font-sans text-gray-600">{overbookingMarginPercent}% Overbooking Margin</p>
            </div>
          </div>

          {/* Primary Club Reservation Details */}
          <div className="p-3.5 border-2 border-black rounded-lg bg-slate-50 space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center text-gray-900 font-bold border-b border-gray-200 pb-1.5 text-[11px]">
              <span>ASSET: {assetName}</span>
              <span className="text-cyan-700">PRIMARY HOLD</span>
            </div>
            <div className="space-y-1 text-[11px] text-gray-700">
              <p>Primary Club: <span className="font-bold text-black">{primaryClubName}</span></p>
              <p>RFID Pickup Status: <span className={cn("font-bold", primaryScannedRfid ? "text-emerald-600" : "text-rose-600")}>{primaryScannedRfid ? "SCANNED / CHECKED OUT" : "PENDING (0/15 Mins)"}</span></p>
            </div>
          </div>
        </div>

        {/* Right Column: Standby Queue & 15-Min Grace Period Simulator */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Users className="w-4 h-4 text-cyan-600" />
            Standby Queue & Auto-Promotion Panel
          </h4>

          <div className="p-3 border-2 border-black rounded-lg bg-white space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-gray-200 pb-1">
              <span className="font-bold text-cyan-900">STANDBY QUEUE POSITION #1</span>
              <span className="text-amber-600 font-bold">NEXT IN LINE</span>
            </div>
            <p className="text-[11px] text-gray-800">
              Standby Club: <span className="font-bold text-black">{standbyClubName}</span>
            </p>
          </div>

          {/* Action Simulator Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSimulateNoShow}
              className="w-full py-3 px-4 border-2 border-black bg-rose-600 text-white font-bold text-xs uppercase rounded-md hover:bg-rose-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <Clock className="w-4 h-4 text-amber-300" />
              <span>Simulate 15-Min No-Show & Promote Standby</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateRfidScan}
              className="w-full py-2.5 px-4 border-2 border-black bg-emerald-500 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              <span>Simulate Primary RFID Pickup Scan</span>
            </button>
          </div>

          {/* Promotion Notification Card */}
          {promotionResult && (
            <div className="p-3.5 border-2 border-black rounded-lg bg-slate-900 text-white space-y-2 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-cyan-400 font-bold border-b border-slate-700 pb-1.5">
                <span className="flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" /> PUSH NOTIFICATION DISPATCHED
                </span>
                <span className="text-emerald-400 font-bold">PROMOTED</span>
              </div>

              <div className="space-y-1 text-[11px] text-gray-300">
                <p className="font-bold text-emerald-400">"{promotionResult.notificationMessage}"</p>
                <p className="text-[10px] text-gray-400">Recipient: {standbyClubName} Officers • Window: 15 Minutes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
