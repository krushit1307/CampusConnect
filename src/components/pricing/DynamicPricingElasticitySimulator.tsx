// =============================================================================
// File: src/components/pricing/DynamicPricingElasticitySimulator.tsx
// Issue: #4292 - Build a 'Real-Time "Dynamic Pricing" Flash Sale Engine'
// Description: Interactive mathematical modeler for price elasticity of demand,
//              break-even liquidation scenario curves, and profit maximization.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  Percent,
  Layers,
  Sparkles,
  Calculator,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DynamicPricingElasticitySimulatorProps {
  basePrice?: number;
  unsoldInventory?: number;
}

export const DynamicPricingElasticitySimulator: React.FC<DynamicPricingElasticitySimulatorProps> = ({
  basePrice = 50.0,
  unsoldInventory = 50,
}) => {
  const [testBasePrice, setTestBasePrice] = useState<number>(basePrice);
  const [testInventory, setTestInventory] = useState<number>(unsoldInventory);
  const [elasticityCoeff, setElasticityCoeff] = useState<number>(1.8); // elastic demand
  const [selectedDiscount, setSelectedDiscount] = useState<number>(50);

  // Scenarios matrix (10%, 25%, 35%, 50%, 65%, 75%)
  const scenarios = useMemo(() => {
    const discountSteps = [10, 25, 35, 50, 65, 75];

    return discountSteps.map((disc) => {
      const discountedPrice = testBasePrice * (1 - disc / 100);
      // Projected conversion = Min(100%, BaseConversion + Elasticity * (disc% / 100))
      const projectedConversion = Math.min(100, Math.round(15 + elasticityCoeff * disc * 1.1));
      const projectedTicketsSold = Math.round((testInventory * projectedConversion) / 100);
      const grossRevenue = projectedTicketsSold * discountedPrice;
      const originalPotential = testInventory * testBasePrice;
      const revenueRecoveryPercent = Number(((grossRevenue / originalPotential) * 100).toFixed(1));

      return {
        discountPercentage: disc,
        discountedPrice: Number(discountedPrice.toFixed(2)),
        projectedConversionPercent: projectedConversion,
        projectedTicketsSold,
        projectedGrossRevenueUsd: Number(grossRevenue.toFixed(2)),
        revenueRecoveryPercent,
        isOptimal: disc === 50,
      };
    });
  }, [testBasePrice, testInventory, elasticityCoeff]);

  const optimalScenario = scenarios.find((s) => s.discountPercentage === selectedDiscount) || scenarios[3];

  return (
    <div className="neu-border bg-white p-6 dark:bg-zinc-900 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b-2 border-black pb-4 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center border-2 border-black bg-blue-500 text-white">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">
              Price Elasticity & Revenue Liquidation Modeler
            </h3>
            <p className="font-mono text-xs text-zinc-500">
              Econometric Price Elasticity Demand Curves & Liquidation Revenue Maximization
            </p>
          </div>
        </div>

        <div className="font-mono text-xs font-bold text-zinc-500">
          Formula: \(\epsilon = \frac{\%\Delta Q}{\%\Delta P}\) (Coefficient: {elasticityCoeff})
        </div>
      </div>

      {/* Simulator Inputs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 font-mono text-xs">
        <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
          <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">
            Base Ticket Price ($)
          </label>
          <input
            type="number"
            value={testBasePrice}
            onChange={(e) => setTestBasePrice(Math.max(5, Number(e.target.value)))}
            className="neu-border w-full bg-white p-1.5 font-bold text-zinc-900 dark:bg-zinc-900 dark:text-white"
          />
        </div>

        <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
          <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">
            Unsold Inventory (Seats)
          </label>
          <input
            type="number"
            value={testInventory}
            onChange={(e) => setTestInventory(Math.max(1, Number(e.target.value)))}
            className="neu-border w-full bg-white p-1.5 font-bold text-zinc-900 dark:bg-zinc-900 dark:text-white"
          />
        </div>

        <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
          <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">
            Demand Elasticity Sensitivity
          </label>
          <select
            aria-label="Select Demand Elasticity Sensitivity"
            value={elasticityCoeff}
            onChange={(e) => setElasticityCoeff(Number(e.target.value))}
            className="neu-border w-full bg-white p-1.5 font-bold text-zinc-900 dark:bg-zinc-900 dark:text-white"
          >
            <option value={1.2}>Moderate Elasticity (\(\epsilon = 1.2\))</option>
            <option value={1.8}>High Elasticity (\(\epsilon = 1.8\))</option>
            <option value={2.5}>Hyper-Sensitive Student Demand (\(\epsilon = 2.5\))</option>
          </select>
        </div>
      </div>

      {/* Selected Scenario Spotlight */}
      <div className="neu-border border-emerald-500 bg-emerald-50/70 p-4 dark:border-emerald-700 dark:bg-emerald-950/30">
        <div className="flex items-center justify-between font-mono text-xs mb-3">
          <span className="font-black uppercase text-emerald-950 dark:text-emerald-200">
            Selected Discount Target: {selectedDiscount}% OFF
          </span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
            Liquidation Revenue: ${optimalScenario.projectedGrossRevenueUsd}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 font-mono text-xs">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase">Flash Ticket Price</span>
            <p className="font-black text-base text-zinc-900 dark:text-white">
              ${optimalScenario.discountedPrice}
            </p>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase">Projected Sales</span>
            <p className="font-black text-base text-blue-600 dark:text-blue-400">
              {optimalScenario.projectedTicketsSold} of {testInventory} seats
            </p>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase">Conversion Rate</span>
            <p className="font-black text-base text-purple-600 dark:text-purple-400">
              {optimalScenario.projectedConversionPercent}%
            </p>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase">Inventory Value Recovered</span>
            <p className="font-black text-base text-emerald-600 dark:text-emerald-400">
              {optimalScenario.revenueRecoveryPercent}%
            </p>
          </div>
        </div>
      </div>

      {/* Scenarios Comparative Table */}
      <div>
        <h4 className="font-mono text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 mb-2">
          Comparative Liquidation Matrix across Discount Tiers
        </h4>
        <div className="neu-border overflow-hidden bg-zinc-50 dark:bg-zinc-800">
          <table className="w-full text-left font-mono text-xs">
            <thead className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                <th className="p-2.5">Discount</th>
                <th className="p-2.5">Flash Price</th>
                <th className="p-2.5 text-center">Projected Conversion</th>
                <th className="p-2.5 text-right">Tickets Liquidated</th>
                <th className="p-2.5 text-right">Gross Realized ($)</th>
                <th className="p-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {scenarios.map((sc) => (
                <tr
                  key={sc.discountPercentage}
                  className={
                    sc.discountPercentage === selectedDiscount
                      ? "bg-lime/20 dark:bg-lime/10 font-bold"
                      : ""
                  }
                >
                  <td className="p-2.5 font-bold text-zinc-900 dark:text-white">
                    {sc.discountPercentage}% OFF
                  </td>
                  <td className="p-2.5">${sc.discountedPrice}</td>
                  <td className="p-2.5 text-center">{sc.projectedConversionPercent}%</td>
                  <td className="p-2.5 text-right font-bold text-blue-600">
                    {sc.projectedTicketsSold} / {testInventory}
                  </td>
                  <td className="p-2.5 text-right font-black text-emerald-600">
                    ${sc.projectedGrossRevenueUsd}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedDiscount(sc.discountPercentage)}
                      className={`rounded px-2 py-1 text-[10px] font-black uppercase transition-colors ${
                        sc.discountPercentage === selectedDiscount
                          ? "bg-black text-white dark:bg-lime dark:text-black"
                          : "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300"
                      }`}
                    >
                      {sc.discountPercentage === selectedDiscount ? "Selected" : "Select"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DynamicPricingElasticitySimulator;
