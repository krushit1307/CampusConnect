import React, { useState, useEffect } from "react";
import {
  PiggyBank,
  LockKeyhole,
  ArrowRightLeft,
  Wallet,
  LineChart,
  ShieldCheck,
  Droplets,
  Coins,
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

export const LosslessYieldDonationDashboard: React.FC = () => {
  const [principalAmount] = useState(1000000); // $1M USDC
  const [apy] = useState(5.0); // 5% APY
  const [yieldGenerated, setYieldGenerated] = useState(4166.67); // 1 month of yield
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [clubBalance, setClubBalance] = useState(0);

  const handleHarvest = () => {
    setIsHarvesting(true);
    // Simulate Smart Contract execution
    setTimeout(() => {
      setClubBalance((prev) => prev + yieldGenerated);
      setYieldGenerated(0);
      setIsHarvesting(false);
    }, 3000);
  };

  const handleWithdraw = () => {
    setIsWithdrawing(true);
    // Simulate Principal Unlocking
    setTimeout(() => {
      alert(
        "Smart Contract Execution: $1,000,000 USDC unlocked from Aave and routed strictly back to your wallet. You have surrendered nothing.",
      );
      setIsWithdrawing(false);
    }, 3000);
  };

  // Simulate live yield generation tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isWithdrawing) {
        // roughly $0.15 per second on 1M at 5% APY
        setYieldGenerated((prev) => prev + 0.158);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isWithdrawing]);

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans space-y-8">
      {/* Header Section */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-4">
            <PiggyBank className="h-10 w-10 text-emerald-500" />
            Lossless DeFi Yield Endowment
          </h1>
          <p className="text-slate-400 mt-3 font-mono text-base max-w-4xl leading-relaxed">
            Ultra-High-Net-Worth individuals refuse to surrender principal capital to mismanaged
            university endowments. This architecture utilizes a customized Smart Contract
            interacting with Aave V3. The donor locks $1,000,000 USDC. The smart contract
            mathematically protects the principal (claimable only by the donor) while continuously
            streaming 100% of the generated 5% APY directly to the Student Club.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column: Donor Principal Control */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden flex-1">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <CardHeader className="border-b border-slate-800 pb-5 bg-slate-950/40">
              <CardTitle className="text-white flex items-center justify-between text-lg">
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-emerald-400" /> Donor Principal
                </span>
                <span className="text-xs bg-emerald-950 text-emerald-400 px-2 py-1 rounded font-bold border border-emerald-900">
                  100% SECURE
                </span>
              </CardTitle>
              <CardDescription className="text-slate-400">Contract: 0xDeFi...4A91</CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-6">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Locked USDC Liquidity
                </p>
                <p className="text-5xl font-black text-white flex items-center justify-center gap-2">
                  ${(principalAmount / 1000000).toFixed(1)}M
                </p>
                <p className="text-sm font-mono text-emerald-400 mt-2 flex items-center justify-center gap-1">
                  <LineChart className="h-4 w-4" /> Generating {apy}% APY on Aave V3
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg flex items-start gap-4 shadow-inner mt-8">
                <ShieldCheck className="h-8 w-8 text-slate-500 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-400 leading-relaxed font-mono">
                  Your principal is hardcoded to be withdrawable <b>exclusively</b> to your
                  connected wallet `0xDonorWallet...8F2`. The University cannot touch these funds.
                </p>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-950/50 border-t border-slate-800 pt-5 mt-auto">
              <Button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                variant="destructive"
                className="w-full font-black h-12 uppercase tracking-widest transition-all"
              >
                {isWithdrawing ? "Unlocking from Aave..." : "Emergency Withdraw Principal"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Yield Routing */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
            {/* Streaming Animation Line */}
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-slate-800 z-0"></div>
            <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-400 to-emerald-500/0 z-0 animate-[shimmer_2s_infinite]"></div>

            <CardContent className="p-8 relative z-10 grid grid-cols-3 gap-4 items-center">
              {/* Node 1: Aave Protocol */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center shadow-xl">
                <Droplets className="h-10 w-10 text-emerald-500 mb-4" />
                <p className="text-sm font-bold text-white mb-1">Aave V3 Pool</p>
                <p className="text-xs text-emerald-400 font-mono">aUSDC APY Engine</p>
              </div>

              {/* Action */}
              <div className="flex flex-col items-center justify-center">
                <div className="bg-slate-900 border-2 border-slate-800 rounded-full p-4 mb-2 shadow-2xl relative overflow-hidden">
                  <div
                    className={`absolute inset-0 bg-emerald-500/20 ${isHarvesting ? "animate-ping" : ""}`}
                  ></div>
                  <ArrowRightLeft
                    className={`h-6 w-6 text-slate-300 relative z-10 ${isHarvesting ? "animate-spin" : ""}`}
                  />
                </div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                  Smart Router
                </p>
              </div>

              {/* Node 2: Club Treasury */}
              <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center shadow-xl relative overflow-hidden">
                <div
                  className={`absolute inset-0 bg-emerald-500/10 transition-opacity duration-1000 ${isHarvesting ? "opacity-100" : "opacity-0"}`}
                ></div>
                <Wallet className="h-10 w-10 text-cyan-500 mb-4 relative z-10" />
                <p className="text-sm font-bold text-white mb-1 relative z-10">Club Treasury</p>
                <p className="text-xs text-cyan-400 font-mono relative z-10">0xClubWallet</p>
              </div>
            </CardContent>
          </Card>

          {/* Financial Totals */}
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-slate-900 border-slate-800 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  Available Yield (Unclaimed)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black text-emerald-400 font-mono">
                  $
                  {yieldGenerated.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <Button
                  onClick={handleHarvest}
                  disabled={isHarvesting || yieldGenerated < 1}
                  className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black h-10 uppercase tracking-wider transition-all"
                >
                  {isHarvesting ? "Routing to Club..." : "Harvest to Club"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Coins className="h-4 w-4" /> Lifetime Club Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-black text-cyan-400 font-mono">
                  $
                  {clubBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-3 leading-relaxed">
                  Sustainable, tax-exempt protocol income completely decoupled from principal loss.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LosslessYieldDonationDashboard;
