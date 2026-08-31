import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Zap,
  Ban,
  FileText,
  User,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BreachType,
  EscrowContractStatus,
  VendorEscrowContract,
  VendorEscrowSlashingCalculation,
} from "@/types/vendorEscrowSlashing";
import {
  vendorEscrowSlashingService,
  DEFAULT_SLASHING_TIERS,
} from "@/services/vendorEscrowSlashingService";

interface VendorEscrowSlashingWidgetProps {
  contractId: string;
  initialContract?: Partial<VendorEscrowContract>;
  onSlashingExecuted?: () => void;
}

export function VendorEscrowSlashingWidget({
  contractId,
  initialContract,
  onSlashingExecuted,
}: VendorEscrowSlashingWidgetProps) {
  const [contract, setContract] = useState<VendorEscrowContract | null>(null);
  const [delayMinutes, setDelayMinutes] = useState<number>(20);
  const [breachType, setBreachType] = useState<BreachType>("LATE_ARRIVAL");
  const [reasonNotes, setReasonNotes] = useState<string>("");
  const [executing, setExecuting] = useState<boolean>(false);
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  useEffect(() => {
    const c = vendorEscrowSlashingService.getOrCreateContract(contractId, initialContract);
    setContract(c);
  }, [contractId, initialContract]);

  if (!contract) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-white animate-pulse">
        <div className="h-6 w-48 bg-slate-800 rounded mb-4"></div>
        <div className="h-20 bg-slate-800 rounded-xl"></div>
      </div>
    );
  }

  // Calculate live preview
  const calc: VendorEscrowSlashingCalculation = vendorEscrowSlashingService.calculateDelaySlashing(
    contract.totalEscrowAmount,
    delayMinutes,
    breachType,
  );

  const handleExecuteSlashing = async () => {
    setExecuting(true);
    setExecutionMessage(null);
    try {
      const res = await vendorEscrowSlashingService.executeEscrowSlashing(
        contractId,
        delayMinutes,
        breachType,
        reasonNotes || `Recorded ${delayMinutes}m delay breach (${breachType})`,
      );
      setContract({ ...res.contract });
      setExecutionMessage(res.message);
      setShowConfirmModal(false);
      if (onSlashingExecuted) onSlashingExecuted();
    } catch (err: any) {
      setExecutionMessage(`Error: ${err.message || "Failed to execute escrow slashing"}`);
    } finally {
      setExecuting(false);
    }
  };

  const getStatusBadge = (status: EscrowContractStatus) => {
    switch (status) {
      case "PARTIALLY_SLASHED":
        return <Badge className="bg-amber-600 text-white font-mono uppercase">Partially Slashed</Badge>;
      case "FULLY_SLASHED":
        return <Badge className="bg-red-600 text-white font-mono uppercase">100% Forfeited</Badge>;
      case "RELEASED_TO_VENDOR":
        return <Badge className="bg-emerald-600 text-white font-mono uppercase">Released</Badge>;
      default:
        return <Badge className="bg-indigo-600 text-white font-mono uppercase">Funded in Escrow</Badge>;
    }
  };

  return (
    <div
      data-testid="escrow-slashing-widget"
      className="p-6 md:p-8 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-red-900/30 text-slate-100 shadow-2xl space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <h3 className="text-xl md:text-2xl font-bold font-display tracking-tight text-white">
              Vendor Escrow Slashing Controls
            </h3>
            {getStatusBadge(contract.status)}
          </div>
          <p className="text-xs md:text-sm text-slate-400 font-mono mt-1">
            Real-time delay breach penalty calculation & escrow refund enforcement for:{" "}
            <span className="text-indigo-300 font-semibold">{contract.eventName}</span>
          </p>
        </div>
      </div>

      {/* Contract & Vendor Info Card */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
        <div>
          <span className="text-slate-500 uppercase block">Vendor</span>
          <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5 mt-0.5">
            <Building className="w-3.5 h-3.5 text-indigo-400" />
            {contract.vendorName}
          </span>
        </div>

        <div>
          <span className="text-slate-500 uppercase block">Total Escrow Budget</span>
          <span className="font-extrabold text-emerald-400 text-base mt-0.5 block">
            ${contract.totalEscrowAmount.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-slate-500 uppercase block">Current Net Vendor Payout</span>
          <span className="font-extrabold text-indigo-300 text-base mt-0.5 block">
            ${contract.netVendorPayout.toLocaleString()}
          </span>
        </div>

        <div>
          <span className="text-slate-500 uppercase block">Organizer Slashed Refund</span>
          <span className="font-extrabold text-amber-400 text-base mt-0.5 block">
            ${contract.organizerRefundAmount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Interactive Delay Simulator Controls */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            Vendor Delay Duration:{" "}
            <span className="text-amber-400 font-mono font-extrabold text-lg">
              {delayMinutes} Minutes
            </span>
          </label>
          <div className="flex items-center gap-1.5">
            {[15, 30, 60, 120].map((m) => (
              <Button
                key={m}
                size="sm"
                variant={delayMinutes === m ? "default" : "outline"}
                onClick={() => setDelayMinutes(m)}
                className={`h-7 text-xs font-mono px-2.5 ${
                  delayMinutes === m ? "bg-red-600 hover:bg-red-700 text-white" : "border-slate-700"
                }`}
              >
                +{m}m
              </Button>
            ))}
          </div>
        </div>

        {/* Range Slider */}
        <input
          type="range"
          min="0"
          max="180"
          step="5"
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(Number(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
          data-testid="delay-slider"
        />

        {/* Breach Type Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {[
            { id: "LATE_ARRIVAL", label: "Late Arrival" },
            { id: "DELAYED_SETUP", label: "Delayed Setup" },
            { id: "MISSING_EQUIPMENT", label: "Missing Equipment (+10%)" },
            { id: "EARLY_DEPARTURE", label: "Early Departure" },
            { id: "SERVICE_INTERRUPTION", label: "Service Interruption (+10%)" },
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setBreachType(type.id as BreachType)}
              className={`p-3 rounded-lg text-xs font-mono text-left border transition ${
                breachType === type.id
                  ? "border-red-500 bg-red-950/40 text-red-200 font-bold"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Financial Breakdown Bar Visualizer */}
      <div className="p-6 rounded-xl bg-slate-900/90 border border-indigo-900/40 space-y-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-semibold uppercase tracking-wider">
            Real-Time Escrow Allocation Preview
          </span>
          <span className="text-red-400 font-bold">
            Slashing Penalty: {calc.slashPercentage}%
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-6 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
          <div
            style={{ width: `${100 - calc.slashPercentage}%` }}
            className="bg-emerald-600 h-full flex items-center justify-center text-[10px] font-mono text-white font-bold transition-all duration-300"
          >
            {100 - calc.slashPercentage > 15 && `Vendor: $${calc.netVendorPayout}`}
          </div>
          <div
            style={{ width: `${calc.slashPercentage}%` }}
            className="bg-red-600 h-full flex items-center justify-center text-[10px] font-mono text-white font-bold transition-all duration-300"
          >
            {calc.slashPercentage > 15 && `Refund: $${calc.slashAmount}`}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-1">
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
            <span className="text-emerald-400 font-semibold block">Net Vendor Payout</span>
            <span className="text-lg font-bold text-slate-100">${calc.netVendorPayout}</span>
          </div>

          <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40">
            <span className="text-red-400 font-semibold block">Organizer Refund</span>
            <span className="text-lg font-bold text-slate-100">${calc.organizerRefundAmount}</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 italic font-mono">{calc.applicableTierDescription}</p>
      </div>

      {/* Execution Controls */}
      <div className="flex items-center justify-between gap-4 pt-2">
        {executionMessage && (
          <p className="text-xs font-mono text-amber-300 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
            {executionMessage}
          </p>
        )}

        <Button
          onClick={() => setShowConfirmModal(true)}
          disabled={executing || contract.status === "RELEASED_TO_VENDOR"}
          className="ml-auto bg-red-600 hover:bg-red-700 text-white font-mono text-xs uppercase px-5 py-2.5 font-bold shadow-lg transition"
          data-testid="execute-slashing-btn"
        >
          <Zap className="w-4 h-4 mr-2" />
          Enforce Escrow Slashing (${calc.slashAmount})
        </Button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 text-slate-100">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="text-lg font-bold font-display uppercase">Confirm Escrow Penalty</h4>
            </div>

            <p className="text-xs text-slate-300 font-mono">
              Are you sure you want to enforce a{" "}
              <span className="text-red-400 font-bold">{calc.slashPercentage}% penalty (${calc.slashAmount})</span>{" "}
              against {contract.vendorName} for a {delayMinutes}m delay ({breachType})?
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400 uppercase">Reason / Evidence Notes</label>
              <textarea
                value={reasonNotes}
                onChange={(e) => setReasonNotes(e.target.value)}
                placeholder="Log delay reason or evidence notes..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExecuteSlashing}
                disabled={executing}
                className="bg-red-600 hover:bg-red-700 text-white font-mono font-bold"
                data-testid="confirm-slashing-submit-btn"
              >
                {executing ? "Processing..." : "Confirm & Execute Slashing"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
