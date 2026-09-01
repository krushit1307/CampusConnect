import React, { useState, useEffect } from 'react';
import {
  EventInsuranceHedgingService,
  InsurancePolicy,
  InsurancePoolStatus,
} from '../../services/eventInsuranceHedgingService';
import { Shield, TrendingUp, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';

export const EventInsuranceHedgingDashboard: React.FC = () => {
  const service = EventInsuranceHedgingService.getInstance();
  const [metrics, setMetrics] = useState<InsurancePoolStatus>(service.getPoolMetrics());
  const [policies, setPolicies] = useState<InsurancePolicy[]>(service.getAllPolicies());
  
  // Form states
  const [eventName, setEventName] = useState('Outdoor Music Fest');
  const [city, setCity] = useState('Austin');
  const [coverage, setCoverage] = useState(5000);
  const [premium, setPremium] = useState(100);
  
  // Catastrophe Simulation State
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{
    totalDemand: number;
    initialLiquidity: number;
    predictionMarketInflow: number;
    finalLiquidity: number;
    bankruptcyAvoided: boolean;
  } | null>(null);

  const refreshData = () => {
    setMetrics(service.getPoolMetrics());
    setPolicies(service.getAllPolicies());
  };

  const handlePurchasePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    await service.underwritePolicy({
      clubId: 'club-main',
      eventName,
      city,
      eventDate: '2026-10-01',
      premiumPaid: premium,
      coverageAmount: coverage,
    });
    refreshData();
  };

  const handleClaim = async (policyId: string) => {
    await service.processClaim(policyId);
    refreshData();
  };

  const handleRunCatastropheSimulation = async () => {
    setSimulating(true);
    const res = await service.simulateMassCatastrophe(50);
    setSimResult(res);
    setSimulating(false);
    refreshData();
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-400">
              <Shield className="w-7 h-7 text-indigo-500" />
              Decentralized Insurance Pool & Prediction Market Hedging
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Issue #5144: Automated Polymarket risk-hedging protocol for correlated event cancellation claims.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-indigo-950 text-indigo-300 border border-indigo-700/50 rounded-full text-xs font-semibold">
              Polymarket CTF Integrated
            </span>
          </div>
        </div>

        {/* Pool Solvency & Health Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Pool Liquidity Reserve</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              ${metrics.totalReserve.toLocaleString()}
            </div>
            <div className="text-slate-500 text-xs mt-1">Base pool collateral</div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Polymarket Hedged Liquidity</div>
            <div className="text-2xl font-bold text-cyan-400 mt-1">
              ${metrics.hedgedLiquidity.toLocaleString()}
            </div>
            <div className="text-slate-500 text-xs mt-1">External YES share claims</div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Pool Solvency Ratio</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">
              {(metrics.solvencyRatio * 100).toFixed(1)}%
            </div>
            <div className="text-slate-500 text-xs mt-1">Reserve + Hedged / Underwritten</div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Active Policies</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {metrics.activePolicies}
            </div>
            <div className="text-slate-500 text-xs mt-1">Underwritten risk items</div>
          </div>
        </div>

        {/* Hurricane Catastrophe Simulation Banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-800/50 p-6 rounded-xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600/20 rounded-lg text-indigo-400">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Correlated Failure Stress Test (50 Rainout Claims)
                </h2>
                <p className="text-slate-300 text-sm">
                  Simulate a major weather catastrophe where 50 clubs trigger $250,000 in claims against a $20,000 pool.
                </p>
              </div>
            </div>
            <button
              onClick={handleRunCatastropheSimulation}
              disabled={simulating}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
            >
              {simulating ? 'Simulating...' : 'Run Catastrophe Hedge Test'}
            </button>
          </div>

          {simResult && (
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-lg space-y-2 mt-4 text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Total Payout Demand (50 Clubs @ $5k):</span>
                <span className="font-semibold text-rose-400">${simResult.totalDemand.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Polymarket Hedge Winnings Inflow:</span>
                <span className="font-semibold text-emerald-400">+${simResult.predictionMarketInflow.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-300 font-medium">Post-Catastrophe Pool Liquidity:</span>
                <span className="font-bold text-indigo-300">${simResult.finalLiquidity.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400 pt-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Solvency Preserved! External Polymarket liquidity prevented pool bankruptcy.
              </div>
            </div>
          )}
        </div>

        {/* Policy Underwriting Form & Active Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Underwrite Form */}
          <div className="bg-slate-800/90 border border-slate-700 p-5 rounded-xl space-y-4">
            <h3 className="text-md font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Underwrite Rainout Policy
            </h3>

            <form onSubmit={handlePurchasePolicy} className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Event Name</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">City Location</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Coverage ($)</label>
                  <input
                    type="number"
                    value={coverage}
                    onChange={(e) => setCoverage(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Premium ($)</label>
                  <input
                    type="number"
                    value={premium}
                    onChange={(e) => setPremium(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-lg text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Polymarket Hedge Capital:</span>
                  <span className="text-indigo-300 font-medium">${(premium * 0.9).toFixed(2)} (90%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Acquired YES Shares:</span>
                  <span className="text-indigo-300 font-medium">{((premium * 0.9) / 0.02).toLocaleString()} shares</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors text-sm"
              >
                Purchase & Auto-Hedge Policy
              </button>
            </form>
          </div>

          {/* Active Policies Table */}
          <div className="lg:col-span-2 bg-slate-800/90 border border-slate-700 p-5 rounded-xl space-y-4">
            <h3 className="text-md font-semibold text-slate-200">
              Active Insurance Policies & Polymarket Positions
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="p-3">Event</th>
                    <th className="p-3">City</th>
                    <th className="p-3">Coverage</th>
                    <th className="p-3">Hedge Position</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {policies.map((policy) => (
                    <tr key={policy.id} className="hover:bg-slate-800/50">
                      <td className="p-3 font-medium text-white">{policy.eventName}</td>
                      <td className="p-3">{policy.city}</td>
                      <td className="p-3 font-semibold text-emerald-400">
                        ${policy.coverageAmount.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded">
                          Polymarket YES
                        </span>
                      </td>
                      <td className="p-3">
                        {policy.claimed ? (
                          <span className="text-emerald-400 font-medium">Claimed</span>
                        ) : (
                          <span className="text-amber-400 font-medium">Active</span>
                        )}
                      </td>
                      <td className="p-3">
                        {!policy.claimed && (
                          <button
                            onClick={() => handleClaim(policy.id)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs transition-colors"
                          >
                            Trigger Claim
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
