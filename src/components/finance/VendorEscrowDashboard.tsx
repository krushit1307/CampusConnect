import React, { useState } from "react";
import {
  ShieldCheck,
  Database,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Wallet,
  Activity,
  Box,
  Plane,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const VendorEscrowDashboard: React.FC = () => {
  const [oracleStatus, setOracleStatus] = useState<
    "IDLE" | "FETCHING" | "RESOLVED_LATE" | "RESOLVED_ONTIME"
  >("IDLE");
  const [escrowAmount] = useState(500); // 500 USDC
  const [slashPercentage] = useState(10);
  const [isTriggering, setIsTriggering] = useState(false);

  const mockSlaDeadline = new Date("2026-08-31T20:00:00Z").toLocaleString();
  const mockArrivalTime = new Date("2026-08-31T20:05:00Z").toLocaleString(); // 5 minutes late

  const handleTriggerOracle = () => {
    setIsTriggering(true);
    setOracleStatus("FETCHING");

    // Simulate Smart Contract execution & Oracle Callback
    setTimeout(() => {
      setIsTriggering(false);
      setOracleStatus("RESOLVED_LATE");
    }, 4500);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <Zap className="h-10 w-10 text-violet-500" />
            Smart Contract SLA Resolution
          </h1>
          <p className="text-slate-400 mt-3 font-mono text-base max-w-4xl leading-relaxed">
            Eliminate fiat settlement delays. This dashboard monitors USDC locked in Polygon Smart
            Contracts. When autonomous delivery drones arrive, Chainlink Decentralized Oracles feed
            the exact timestamp on-chain. If the SLA deadline is breached, algorithmic slashing is
            executed deterministically in milliseconds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Escrow State */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <CardHeader className="border-b border-slate-800 pb-5">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-violet-400" />
                Active Polygon Escrow
              </CardTitle>
              <CardDescription className="text-slate-400">Contract: 0xAb58...3F92</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg flex flex-col items-center justify-center text-center shadow-inner">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Locked Liquidity
                </p>
                <p className="text-4xl font-black text-white flex items-center gap-2">
                  ${escrowAmount} <span className="text-sm font-bold text-violet-400">USDC</span>
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Clock className="h-4 w-4" /> SLA Deadline
                  </span>
                  <span className="text-sm font-mono text-white">{mockSlaDeadline}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <AlertOctagon className="h-4 w-4" /> Delay Penalty
                  </span>
                  <span className="text-sm font-mono text-rose-400 font-bold">
                    {slashPercentage}% Slash
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-950/50 border-t border-slate-800 pt-5">
              <Button
                onClick={handleTriggerOracle}
                disabled={isTriggering || oracleStatus !== "IDLE"}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black h-14 uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(139,92,246,0.4)]"
              >
                {isTriggering ? "Awaiting Chainlink Oracle..." : "Trigger Oracle Resolution"}
              </Button>
            </CardFooter>
          </Card>

          {isTriggering && (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 animate-spin" /> DON Consensus
                </span>
                <span className="text-violet-400">Processing...</span>
              </div>
              <Progress value={75} className="h-2 bg-slate-800" />
              <p className="text-xs font-mono text-violet-300 animate-pulse text-center">
                Requesting Drone Telemetry from api.campusconnect.edu
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Resolution Matrix */}
        <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
          <Card
            className={`bg-slate-900 border-slate-800 shadow-2xl flex-1 transition-all duration-700 ${oracleStatus !== "IDLE" && oracleStatus !== "FETCHING" ? "opacity-100 translate-y-0" : "opacity-20 pointer-events-none translate-y-4"}`}
          >
            <CardHeader className="bg-rose-950/20 border-b border-rose-900/30 pb-5">
              <CardTitle className="text-rose-400 flex items-center gap-3 text-xl">
                <AlertOctagon className="h-6 w-6" />
                SLA Breach Detected
              </CardTitle>
              <CardDescription className="text-slate-300 font-mono text-xs mt-2">
                Chainlink Oracles verified autonomous drone arrival occurred after the hardcoded SLA
                deadline.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
              {/* Telemetry Row */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex flex-col items-start justify-center">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <Plane className="h-3 w-3" /> Drone Arrival Time
                  </p>
                  <p className="text-sm font-mono text-white">{mockArrivalTime}</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg flex flex-col items-start justify-center">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 flex items-center gap-1">
                    <Database className="h-3 w-3" /> Blockchain Finality
                  </p>
                  <p className="text-sm font-mono text-white">2.4 Seconds (Polygon PoS)</p>
                </div>
              </div>

              {/* Financial Execution */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 border-b border-slate-800 pb-2">
                  Deterministic Settlement Matrix
                </h3>

                <div className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-3">
                    <Box className="h-8 w-8 text-slate-500" />
                    <div>
                      <p className="text-sm font-bold text-white">Vendor Payout (90%)</p>
                      <p className="text-xs text-slate-500 font-mono">0xVendorWallet...A12</p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-white">${escrowAmount * 0.9}</span>
                </div>

                <div className="flex items-center justify-between bg-rose-950/20 p-4 rounded-lg border border-rose-900/50">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-8 w-8 text-rose-500" />
                    <div>
                      <p className="text-sm font-bold text-rose-400">Club SLA Slash Refund (10%)</p>
                      <p className="text-xs text-rose-500/70 font-mono">0xClubWallet...B34</p>
                    </div>
                  </div>
                  <span className="text-xl font-black text-rose-400">+${escrowAmount * 0.1}</span>
                </div>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-5 rounded-lg mt-8 flex items-start gap-4">
                <CheckCircle2 className="h-6 w-6 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-300 leading-relaxed font-mono">
                  Smart contract execution complete. Funds have been atomically transferred. Fiat
                  rails bypassed successfully, eliminating all Stripe chargeback/dispute risks.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VendorEscrowDashboard;
