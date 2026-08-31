// =============================================================================
// Component: LosslessYieldDonationDashboard
// Issue: #5380 - MakerDAO CDP/Flash Minting leveraged yield donation & tax savings
// =============================================================================

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
  Percent,
  TrendingUp,
  AlertTriangle,
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
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { DefiLeverageService, type DefiDonation } from "@/services/defiLeverageService";

export const LosslessYieldDonationDashboard: React.FC = () => {
  const supabase = createClient();

  // Active donation tracked ID (for mock database synchronization)
  const [activeDonationId, setActiveDonationId] = useState<string>("");
  const [principalAmount, setPrincipalAmount] = useState(1000000); // $1M collateral equivalent
  const [apy] = useState(5.0); // 5% APY
  const [yieldGenerated, setYieldGenerated] = useState(4166.67); // 1 month of yield
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [clubBalance, setClubBalance] = useState(0);

  // MakerDAO CDP & Tax states
  const [collateralAsset, setCollateralAsset] = useState("ETH");
  const [collateralQty, setCollateralQty] = useState(333.33); // 333.33 ETH
  const [ethPrice] = useState(3000); // Mock ETH Price
  const [debtAmountDai, setDebtAmountDai] = useState(500000); // $500k DAI
  const [isLeveraging, setIsLeveraging] = useState(false);

  // Calculated fields
  const [liquidationPrice, setLiquidationPrice] = useState(2250);
  const [taxSavings, setTaxSavings] = useState(208250);
  const [leverageMult, setLeverageMult] = useState(1.5);
  const [isLeveraged, setIsLeveraged] = useState(false);

  // Initialize a mock donation ID so we have a target record to update in DB
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        // Try to fetch existing
        const existing = await DefiLeverageService.fetchDonations(userData.user.id);
        if (existing.length > 0) {
          const active = existing[0];
          setActiveDonationId(active.id);
          setPrincipalAmount(Number(active.principal_locked_usdc) || 1000000);
          setCollateralQty(Number(active.collateral_amount) || 333.33);
          setDebtAmountDai(Number(active.debt_amount_dai) || 500000);
          setLiquidationPrice(Number(active.liquidation_price) || 2250);
          setTaxSavings(Number(active.tax_savings_usd) || 208250);
          setLeverageMult(Number(active.leverage_multiplier) || 1.5);
          setIsLeveraged(active.is_leveraged);
        } else {
          // Seed a mock donation for the current user
          const { data, error } = await supabase
            .from("lossless_yield_donations")
            .insert({
              donor_id: userData.user.id,
              club_id: userData.user.id, // self-donating mock
              contract_address: "0xDeFi" + Math.floor(Math.random() * 100000) + "CDP",
              principal_locked_usdc: 1000000,
              status: "ACTIVE",
            })
            .select()
            .single();

          if (data) {
            setActiveDonationId(data.id);
          }
        }
      } catch (err) {
        console.error("Seed donation error:", err);
      }
    })();
  }, []);

  const handleHarvest = () => {
    setIsHarvesting(true);
    setTimeout(() => {
      setClubBalance((prev) => prev + yieldGenerated);
      setYieldGenerated(0);
      setIsHarvesting(false);
      toast.success("Yield successfully routed to Student Club treasury!");
    }, 2000);
  };

  const handleWithdraw = () => {
    setIsWithdrawing(true);
    setTimeout(() => {
      toast.success("Emergency Withdraw: $1,000,000 ETH collateral returned to your wallet.");
      setIsWithdrawing(false);
      setIsLeveraged(false);
      setDebtAmountDai(0);
    }, 2000);
  };

  const handleSimulateLeverage = async () => {
    if (!activeDonationId) {
      toast.error("No active yield donation session found.");
      return;
    }

    setIsLeveraging(true);
    toast.info("Opening MakerDAO CDP Vault and staking DAI stablecoins...");

    const collateralValue = collateralQty * ethPrice;
    if (debtAmountDai > collateralValue * 0.75) {
      toast.error("CDP exceeds maximum safe borrow threshold of 75%!");
      setIsLeveraging(false);
      return;
    }

    try {
      const res = await DefiLeverageService.simulateLeverage(
        activeDonationId,
        collateralQty,
        debtAmountDai,
        ethPrice
      );

      if (res.success) {
        setPrincipalAmount(collateralValue);
        setLiquidationPrice(res.liquidation_price || 0);
        setTaxSavings(res.tax_savings || 0);
        setLeverageMult(res.leverage_multiplier || 1.0);
        setIsLeveraged(true);
        toast.success("MakerDAO CDP vault updated & DAI yield routing activated!");
      } else {
        toast.error(res.error || "DeFi simulation error.");
      }
    } catch (err: any) {
      toast.error(err.message || "Simulate error.");
    } finally {
      setIsLeveraging(false);
    }
  };

  // Live yield generation tick
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isWithdrawing) {
        // Leveraged yield is calculated on the borrowed debt (DAI) plus the base collateral value
        const totalYieldBase = isLeveraged ? debtAmountDai : principalAmount;
        // roughly $0.15 per second on $1M at 5% APY
        const yieldPerSecond = (totalYieldBase * (apy / 100)) / (365 * 24 * 3600);
        setYieldGenerated((prev) => prev + yieldPerSecond);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isWithdrawing, isLeveraged, debtAmountDai, principalAmount]);

  const collateralValue = collateralQty * ethPrice;
  const colRatio = debtAmountDai > 0 ? (collateralValue / debtAmountDai) * 100 : 0;
  const isCdpRisky = colRatio > 0 && colRatio < 160;

  return (
    <div className="max-w-6xl mx-auto p-6 font-mono text-black dark:text-white space-y-8" data-testid="defi-yield-dashboard">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-black pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight flex items-center gap-3">
            <PiggyBank className="h-10 w-10 text-emerald-600 animate-bounce" />
            MakerDAO Leveraged Yield Endowment
          </h1>
          <p className="text-sm text-zinc-600 mt-2 max-w-4xl leading-relaxed">
            Avoid tax liabilities by staking asset yields. Use MakerDAO Collateralized Debt Positions (CDPs) 
            to flash-mint DAI stablecoin loans against your ETH. Yield is auto-routed to the club, while you retain collateral ownership.
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-100 border-2 border-black px-3 py-1 font-bold text-xs uppercase text-emerald-950">
          <ShieldCheck className="h-4 w-4" /> Tax-Exempt Status Confirmed (990-N)
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Column: CDP Vault & Calculator controls */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-4 border-black bg-white shadow-[8px_8px_0_0_#000] rounded-none">
            <CardHeader className="border-b-2 border-black bg-zinc-50">
              <CardTitle className="text-base font-black uppercase flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-black" /> MakerDAO CDP Controller
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 border-2 border-black px-2 py-0.5 rounded font-black">
                  CDP ACTIVE
                </span>
              </CardTitle>
              <CardDescription className="text-zinc-500 font-mono text-[10px]">
                Contract: 0xDeFiCDP...4A91
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase block text-zinc-500">Collateral Type</label>
                <select
                  value={collateralAsset}
                  onChange={(e) => setCollateralAsset(e.target.value)}
                  className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                >
                  <option value="ETH">ETH (Ethereum)</option>
                  <option value="wBTC">wBTC (Wrapped Bitcoin)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase block text-zinc-500">Collateral Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    value={collateralQty}
                    onChange={(e) => setCollateralQty(Number(e.target.value))}
                    className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                    data-testid="collateral-qty-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase block text-zinc-500">Stablecoin Borrow (DAI)</label>
                  <input
                    type="number"
                    step="1000"
                    value={debtAmountDai}
                    onChange={(e) => setDebtAmountDai(Number(e.target.value))}
                    className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono w-full text-black outline-none"
                    data-testid="dai-borrow-input"
                  />
                </div>
              </div>

              <div className="border-2 border-dashed border-black/20 p-3 bg-zinc-50 space-y-1.5 text-[10px]">
                <div className="flex justify-between">
                  <span>ETH Price (Oracle):</span>
                  <span className="font-bold">${ethPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Collateral Value:</span>
                  <span className="font-bold">${collateralValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Collateralization Ratio:</span>
                  <span className={`font-black ${isCdpRisky ? "text-red-600 animate-pulse" : "text-emerald-700"}`}>
                    {colRatio.toFixed(1)}% (Min 150%)
                  </span>
                </div>
                {isCdpRisky && (
                  <p className="text-[8px] text-red-600 font-bold flex items-center gap-1 mt-1 animate-pulse">
                    <AlertTriangle className="h-3 w-3 shrink-0" /> RISK OF LIQUIDATION! ADD COLLATERAL.
                  </p>
                )}
              </div>

              <Button
                onClick={handleSimulateLeverage}
                disabled={isLeveraging || debtAmountDai <= 0}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black border-2 border-black py-2.5 text-xs uppercase shadow-[2px_2px_0_0_#000]"
                data-testid="simulate-leverage-btn"
              >
                {isLeveraging ? "Leveraging Vault..." : "Lock Collateral & Mint DAI"}
              </Button>
            </CardContent>
            <CardFooter className="bg-zinc-50 border-t-2 border-black py-3">
              <Button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                variant="destructive"
                className="w-full font-black border-2 border-black py-2.5 text-xs uppercase shadow-[2px_2px_0_0_#000]"
              >
                {isWithdrawing ? "Unlocking Collateral..." : "Emergency Withdraw CDP"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Right Column: Live Yield stats & Tax-Exempt Gains Calculator display */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Yield Routing visualizer card */}
          <Card className="border-4 border-black bg-white shadow-[8px_8px_0_0_#000] rounded-none">
            <CardContent className="p-6 grid grid-cols-3 gap-2 items-center text-center">
              
              <div className="border-2 border-black bg-zinc-50 p-3 rounded-none">
                <Droplets className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold">MakerDAO Vault</p>
                <p className="text-[9px] text-zinc-500 font-mono">CDP Collateral</p>
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="bg-zinc-50 border-2 border-black rounded-full p-2.5 mb-1 animate-pulse">
                  <ArrowRightLeft className="h-5 w-5 text-zinc-700" />
                </div>
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">
                  Leveraged Yield Router
                </p>
              </div>

              <div className="border-2 border-black bg-zinc-50 p-3 rounded-none">
                <Wallet className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-xs font-bold">Club Treasury</p>
                <p className="text-[9px] text-zinc-500 font-mono">0xClubTreasury</p>
              </div>

            </CardContent>
          </Card>

          {/* Yield and Tax savings calculations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Unclaimed Yield */}
            <Card className="border-4 border-black bg-white shadow-[6px_6px_0_0_#000] rounded-none">
              <CardHeader className="pb-2 bg-zinc-50 border-b-2 border-black">
                <CardTitle className="text-xs font-black uppercase tracking-wider">
                  Accrued Yield (Unclaimed)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-3xl font-black text-emerald-600 font-mono">
                  ${yieldGenerated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <Button
                  onClick={handleHarvest}
                  disabled={isHarvesting || yieldGenerated < 1}
                  className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-black border-2 border-black font-black py-2 text-xs uppercase shadow-[2px_2px_0_0_#000]"
                  data-testid="harvest-yield-btn"
                >
                  {isHarvesting ? "Staking to Club..." : "Harvest to Club Treasury"}
                </Button>
              </CardContent>
            </Card>

            {/* Tax Savings */}
            <Card className="border-4 border-black bg-white shadow-[6px_6px_0_0_#000] rounded-none">
              <CardHeader className="pb-2 bg-zinc-50 border-b-2 border-black">
                <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                  <Percent className="h-3.5 w-3.5 text-indigo-600" /> Capital Gains Tax Savings
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <p className="text-3xl font-black text-indigo-600 font-mono">
                  ${taxSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="text-[10px] text-zinc-500 font-mono leading-normal">
                  <div className="flex justify-between">
                    <span>Leverage Factor:</span>
                    <span className="font-bold text-black">{leverageMult.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CDP Liquidation Price:</span>
                    <span className="font-bold text-black">${liquidationPrice.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Tax-Exempt Capital Gains Calculator Summary */}
          <div className="border-4 border-black bg-amber-50 p-4 shadow-[4px_4px_0_0_#000] space-y-3">
            <span className="font-black text-xs uppercase text-amber-900 block border-b-2 border-amber-950/20 pb-1 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Tax-Exempt Capital Gains Calculator Breakdown
            </span>
            <p className="text-[10px] text-amber-900/80 leading-normal">
              By routing yield generated directly from locked assets through a Smart Contract, the donor offsets 
              standard Capital Gains taxes on direct asset sales.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] text-zinc-700">
              <div className="border border-black/10 bg-white p-2.5">
                <span className="font-bold block text-black">US Tax Rate Baseline:</span>
                Uses 20% federal capital gains tax rate + 13.3% state rate offsets.
              </div>
              <div className="border border-black/10 bg-white p-2.5">
                <span className="font-bold block text-black">Net Impact Boost:</span>
                Total charitable impact boosted by {((leverageMult - 1) * 100).toFixed(0)}% using flash-minted stablecoin staking.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LosslessYieldDonationDashboard;
