import React, { useState, useEffect } from "react";
import {
  Coins,
  LineChart,
  ShieldCheck,
  ArrowRightLeft,
  DollarSign,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  History,
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

export const DeFiDonationDashboard: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

  // Mock State for UI
  const principal = 10000.0;
  const currentYield = 142.5; // Earned so far
  const projectedYield = 250.0; // Expected at 6 months
  const apy = 5.0;

  const handleConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setWalletConnected(true);
      setIsConnecting(false);
    }, 1000);
  };

  const handleDeposit = () => {
    setIsDepositing(true);
    setTimeout(() => {
      setIsDepositing(false);
      alert(
        "Smart Contract Execution: Successfully locked $10,000 USDC into Aave V3 Liquidity Pool.",
      );
    }, 2000);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Coins className="h-8 w-8 text-indigo-500" />
            DeFi Yield Escrow
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-2xl">
            Capital-efficient donation locking. Escrowed funds are automatically deployed into Aave
            V3 to generate {apy}% APY.
          </p>
        </div>
        {!walletConnected ? (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-slate-800 hover:bg-slate-700 font-bold border border-slate-700"
          >
            <Wallet className="mr-2 h-4 w-4 text-indigo-400" />
            {isConnecting ? "Connecting..." : "Connect Web3 Wallet"}
          </Button>
        ) : (
          <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-indigo-400 font-mono text-xs font-bold">
              0x7F...3B9A Connected
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Yield Visualizer */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl"></div>

            <CardHeader className="border-b border-slate-800/50 pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <LineChart className="h-5 w-5 text-emerald-400" />
                Live Liquidity Pool Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
                  Locked Principal
                </p>
                <p className="text-3xl font-mono font-black text-white">
                  ${principal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> Audited Smart Contract
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
                  Current Yield
                </p>
                <p className="text-3xl font-mono font-black text-emerald-400">
                  +${currentYield.toFixed(2)}
                </p>
                <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                  Accruing in real-time
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
                  Protocol APY
                </p>
                <p className="text-3xl font-mono font-black text-indigo-400">{apy}%</p>
                <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                  Aave V3 (USDC)
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
                  Projected (6 mo)
                </p>
                <p className="text-3xl font-mono font-black text-slate-300">
                  ~${projectedYield.toFixed(2)}
                </p>
                <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
                  Expected Maturity
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Smart Contract Execution Flow */}
          <Card className="bg-slate-900 border-slate-800 shadow-xl">
            <CardHeader className="bg-slate-950/50 border-b border-slate-800">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <ArrowRightLeft className="h-5 w-5 text-indigo-400" />
                Escrow Settlement Matrix
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <h3 className="text-emerald-400 font-black tracking-tight">
                      Milestone Succeeds
                    </h3>
                  </div>
                  <p className="text-slate-300 font-mono text-sm mb-4 leading-relaxed">
                    Club successfully builds the robot after 6 months. The Smart Contract releases
                    full funds to the club.
                  </p>
                  <div className="space-y-2 font-mono text-xs border-t border-emerald-900/50 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Club Receives (Principal):</span>
                      <span className="text-white font-bold">$10,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Club Receives (Yield):</span>
                      <span className="text-emerald-400 font-bold">+$250.00</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <h3 className="text-red-400 font-black tracking-tight">
                      Milestone Fails (Revert)
                    </h3>
                  </div>
                  <p className="text-slate-300 font-mono text-sm mb-4 leading-relaxed">
                    Club fails to deliver. The Smart Contract automatically refunds the principal,
                    but strips the yield as an Escrow Fee.
                  </p>
                  <div className="space-y-2 font-mono text-xs border-t border-red-900/50 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Donor Refunded (Principal):</span>
                      <span className="text-white font-bold">$10,000.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Platform/Club Keeps (Yield):</span>
                      <span className="text-indigo-400 font-bold">+$250.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-indigo-950/20 border-indigo-500/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-indigo-400 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Initialize Escrow
              </CardTitle>
              <CardDescription className="text-indigo-200/60 font-mono text-xs pt-1">
                Invoke YieldFarmingEscrow.sol
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  USDC Amount
                </label>
                <div className="bg-slate-900 border border-slate-700 rounded-md p-3 font-mono text-white text-lg font-bold">
                  $10,000.00
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Lock Duration
                </label>
                <div className="bg-slate-900 border border-slate-700 rounded-md p-3 font-mono text-slate-300 text-sm">
                  6 Months (180 Days)
                </div>
              </div>

              <div className="p-3 rounded bg-slate-900/80 border border-slate-800 mt-4">
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  By executing this transaction, your USDC will be routed through our smart contract
                  directly into the Aave V3 lending protocol.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleDeposit}
                disabled={!walletConnected || isDepositing}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-wide uppercase h-12"
              >
                {isDepositing ? "Broadcasting to Ethereum..." : "Sign & Lock USDC"}
              </Button>
            </CardFooter>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                On-Chain History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-800/50 font-mono text-xs">
                <div className="p-3 hover:bg-slate-800/30 transition-colors flex justify-between items-center">
                  <div>
                    <span className="text-emerald-400 font-bold block mb-1">Aave Supply</span>
                    <span className="text-slate-500">Tx: 0x8f...2e1a</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white block mb-1">10,000 USDC</span>
                    <span className="text-slate-500">3 days ago</span>
                  </div>
                </div>
                <div className="p-3 hover:bg-slate-800/30 transition-colors flex justify-between items-center">
                  <div>
                    <span className="text-indigo-400 font-bold block mb-1">Escrow Created</span>
                    <span className="text-slate-500">Tx: 0x3b...9f0c</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white block mb-1">Lock: 6 mo</span>
                    <span className="text-slate-500">3 days ago</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeFiDonationDashboard;
