import React, { useState, useEffect } from 'react';
import {
  DutchAuctionRlYieldAgent,
  AuctionState,
  RLAgentDecision,
} from '../../services/dutchAuctionRlYieldAgent';
import { Zap, TrendingUp, PauseCircle, PlayCircle, ShieldAlert, Award } from 'lucide-react';

export const DynamicDutchAuctionDashboard: React.FC = () => {
  const rlAgent = DutchAuctionRlYieldAgent.getInstance();

  const [auction, setAuction] = useState<AuctionState>({
    auctionId: 'auction-dj-headliner',
    eventName: 'Super DJ Night Headliner',
    initialPrice: 100,
    currentPrice: 85,
    floorPrice: 30,
    remainingTickets: 120,
    totalTickets: 200,
    purchaseVelocityPerSec: 0.5,
    timeElapsedSec: 300,
    totalDurationSec: 1800,
    isClockPaused: false,
    hybridModeActive: false,
  });

  const [decision, setDecision] = useState<RLAgentDecision>(rlAgent.evaluateState(auction));
  const [purchaseBurst, setPurchaseBurst] = useState<number>(25); // tickets bought in burst
  const [simComparison, setSimComparison] = useState<{
    linearRevenue: number;
    rlRevenue: number;
    revenueLift: number;
    liftPercentage: number;
  } | null>(null);

  useEffect(() => {
    const updatedDecision = rlAgent.evaluateState(auction);
    setDecision(updatedDecision);
  }, [auction.purchaseVelocityPerSec, auction.currentPrice, auction.remainingTickets]);

  const handleSimulateBurst = (ticketsPerSec: number) => {
    const newVelocity = ticketsPerSec;
    const newRemaining = Math.max(0, auction.remainingTickets - Math.floor(ticketsPerSec * 2));
    
    setAuction((prev) => {
      const nextState = {
        ...prev,
        purchaseVelocityPerSec: newVelocity,
        remainingTickets: newRemaining,
      };
      const dec = rlAgent.evaluateState(nextState);
      return {
        ...nextState,
        currentPrice: dec.adjustedPrice,
        isClockPaused: dec.isClockPaused,
        hybridModeActive: dec.action === 'MICRO_BOOST_PRICE',
      };
    });
  };

  const handleRunRevenueComparison = () => {
    const res = rlAgent.simulateAuctionComparison({
      ticketCount: 200,
      initialPrice: 100,
      floorPrice: 30,
      durationSec: 1800,
      velocitySpikesAtSec: [300, 600, 900, 1200],
    });
    setSimComparison(res);
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-cyan-400">
              <Zap className="w-7 h-7 text-cyan-500" />
              Real-Time Dynamic Pricing Dutch Auction (RL Yield AI Agent)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Issue #5145: Reinforcement learning agent riding velocity spikes to maximize ticket yield.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {auction.isClockPaused ? (
              <span className="px-3 py-1 bg-amber-950 text-amber-300 border border-amber-800 rounded-full text-xs font-semibold flex items-center gap-1">
                <PauseCircle className="w-4 h-4" /> Dynamic Clock Paused
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full text-xs font-semibold flex items-center gap-1">
                <PlayCircle className="w-4 h-4" /> Clock Ticking Down
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Current Ticket Price</div>
            <div className="text-3xl font-extrabold text-cyan-300 mt-1">
              ${auction.currentPrice.toFixed(2)}
            </div>
            <div className="text-slate-500 text-xs mt-1">Floor: ${auction.floorPrice} | Initial: ${auction.initialPrice}</div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Purchase Velocity Stream</div>
            <div className="text-3xl font-extrabold text-purple-400 mt-1">
              {auction.purchaseVelocityPerSec.toFixed(1)} <span className="text-xs font-normal">t/sec</span>
            </div>
            <div className="text-slate-500 text-xs mt-1">Real-time demand rate</div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Demand Elasticity Index</div>
            <div className="text-3xl font-extrabold text-amber-400 mt-1">
              {decision.demandElasticityIndex.toFixed(2)}
            </div>
            <div className="text-slate-500 text-xs mt-1">Velocity x Inventory Scarcity</div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Est. RL Revenue Lift</div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-1">
              +${decision.revenueOptimizationGain.toFixed(2)}
            </div>
            <div className="text-slate-500 text-xs mt-1">Captured vs static linear auction</div>
          </div>
        </div>

        {/* Interactive Velocity Controller */}
        <div className="bg-slate-800/90 border border-slate-700 p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Simulate Purchase Velocity & Demand Burst
          </h2>
          <p className="text-slate-300 text-sm">
            Trigger real-time ticket purchase bursts to test how the RL AI Agent manipulates the auction clock.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleSimulateBurst(0.2)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
            >
              Normal Low Demand (0.2 t/s)
            </button>
            <button
              onClick={() => handleSimulateBurst(6.5)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors"
            >
              High Demand Spike (6.5 t/s)
            </button>
            <button
              onClick={() => handleSimulateBurst(20.0)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-sm transition-colors shadow-lg shadow-rose-600/30"
            >
              Explosive Demand Burst (20 t/s)
            </button>
          </div>

          {/* Current RL Decision Banner */}
          <div className="bg-slate-950 border border-cyan-800/40 p-4 rounded-lg space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                RL Agent Decision State: {decision.action}
              </span>
              <span className="text-xs text-slate-500">{decision.timestamp}</span>
            </div>
            <p className="text-sm font-medium text-slate-200">{decision.reasoning}</p>
          </div>
        </div>

        {/* Revenue Lift Simulation Comparison */}
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-emerald-950 border border-cyan-800/50 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-600/20 rounded-lg text-cyan-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Full Event Yield Benchmark</h3>
                <p className="text-slate-300 text-sm">
                  Compare total revenue extraction of Linear Dutch Auction vs RL Dynamic Agent.
                </p>
              </div>
            </div>
            <button
              onClick={handleRunRevenueComparison}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-sm rounded-lg transition-all shadow-lg shadow-cyan-600/30"
            >
              Run Yield Benchmark
            </button>
          </div>

          {simComparison && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-cyan-900/50">
              <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-xs">Standard Linear Auction Revenue</div>
                <div className="text-2xl font-bold text-slate-300 mt-1">
                  ${simComparison.linearRevenue.toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-lg border border-cyan-800/60">
                <div className="text-cyan-400 text-xs">RL Dynamic Yield Agent Revenue</div>
                <div className="text-2xl font-extrabold text-cyan-300 mt-1">
                  ${simComparison.rlRevenue.toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-950/70 p-4 rounded-lg border border-emerald-800/60">
                <div className="text-emerald-400 text-xs">Extra Captured Revenue Lift</div>
                <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                  +${simComparison.revenueLift.toLocaleString()} ({simComparison.liftPercentage}%)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
