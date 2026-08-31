import React, { useState, useEffect } from 'react';
import {
  Coins,
  Fuel,
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Layers,
  Sparkles,
  RefreshCw,
  Sliders,
  DollarSign,
  CheckCircle2,
  Copy,
  ExternalLink,
  Activity,
  Award
} from 'lucide-react';
import {
  CryptoDonationGasEstimatorService,
  SupportedChain,
  CryptoToken,
  GasSpeed,
  DonationGasEstimate,
  ChainGasComparison,
  DonationGoalCampaign
} from '@/services/cryptoDonationGasEstimatorService';

export const CryptoDonationGasEstimator: React.FC = () => {
  // Campaign State
  const [campaign] = useState<DonationGoalCampaign>(CryptoDonationGasEstimatorService.getSampleCampaign());

  // Input States
  const [selectedChain, setSelectedChain] = useState<SupportedChain>('arbitrum');
  const [selectedToken, setSelectedToken] = useState<CryptoToken>('ETH');
  const [donationAmountUSD, setDonationAmountUSD] = useState<number>(100);
  const [gasSpeed, setGasSpeed] = useState<GasSpeed>('standard');
  const [customGweiOverride, setCustomGweiOverride] = useState<number>(26.5);

  // Calculation Results
  const [estimate, setEstimate] = useState<DonationGasEstimate | null>(null);
  const [chainComparisons, setChainComparisons] = useState<ChainGasComparison[]>([]);
  const [copiedWallet, setCopiedWallet] = useState<boolean>(false);

  // Calculate whenever parameters change
  useEffect(() => {
    const est = CryptoDonationGasEstimatorService.calculateDonationGasImpact(
      selectedChain,
      selectedToken,
      donationAmountUSD,
      gasSpeed,
      selectedChain === 'ethereum' ? customGweiOverride : undefined
    );
    setEstimate(est);

    const comp = CryptoDonationGasEstimatorService.compareAllChainsGasFees(donationAmountUSD);
    setChainComparisons(comp);
  }, [selectedChain, selectedToken, donationAmountUSD, gasSpeed, customGweiOverride]);

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(campaign.crypto_wallet_address);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  if (!estimate) return null;

  const targetProgressPercent = Math.min(100, Math.round((campaign.current_raised_usd / campaign.target_goal_usd) * 100));
  const newProjectedRaised = campaign.current_raised_usd + estimate.net_received_usd;
  const newProgressPercent = Math.min(100, Math.round((newProjectedRaised / campaign.target_goal_usd) * 100));

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 text-slate-100 p-4 font-sans">
      {/* Top Campaign Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 border border-indigo-500/30 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Coins className="w-3.5 h-3.5" /> Web3 Student Crowdfunding
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Gas Oracle Active
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {campaign.title}
            </h1>
            <p className="text-xs text-slate-300 flex items-center gap-1.5">
              <span>Organized by:</span> <strong className="text-indigo-200">{campaign.organizer}</strong>
            </p>
          </div>

          {/* Campaign Target Goal Progress */}
          <div className="w-full lg:w-80 bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2 shrink-0">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-400">Target Goal</span>
              <span className="text-emerald-400 font-mono">${campaign.target_goal_usd.toLocaleString()} USD</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-white">${campaign.current_raised_usd.toLocaleString()} Raised</span>
              <span className="text-indigo-300 font-mono">{targetProgressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${targetProgressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chain Selector & Gas Speed Controls */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" /> Select Blockchain & Gas Speed
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose your preferred network to calculate real-time gas fee overhead.
            </p>
          </div>

          {/* Speed Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['slow', 'standard', 'fast', 'instant'] as const).map((spd) => (
              <button
                key={spd}
                onClick={() => setGasSpeed(spd)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition ${
                  gasSpeed === spd
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}
              </button>
            ))}
          </div>
        </div>

        {/* Chain Selector Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(
            [
              { id: 'arbitrum', name: 'Arbitrum (L2)', badge: 'Recommended', color: 'border-cyan-500/50 bg-cyan-950/20' },
              { id: 'base', name: 'Base (L2)', badge: 'Ultra Low', color: 'border-blue-500/50 bg-blue-950/20' },
              { id: 'solana', name: 'Solana', badge: '< $0.01', color: 'border-purple-500/50 bg-purple-950/20' },
              { id: 'polygon', name: 'Polygon', badge: 'Fast', color: 'border-indigo-500/50 bg-indigo-950/20' },
              { id: 'optimism', name: 'Optimism', badge: 'L2', color: 'border-rose-500/50 bg-rose-950/20' },
              { id: 'ethereum', name: 'Ethereum', badge: 'L1 Mainnet', color: 'border-amber-500/50 bg-amber-950/20' }
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChain(c.id as SupportedChain)}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between h-20 ${
                selectedChain === c.id
                  ? 'border-indigo-500 bg-indigo-600/10 ring-2 ring-indigo-500/30'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate">{c.name}</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded w-fit border border-indigo-500/20">
                {c.badge}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Donation Breakdown & Net Yield */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Donation Gas Yield Summary */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-800 p-6 shadow-xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-400" /> Gas & Net Yield Summary
              </h3>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
                  estimate.efficiency_grade === 'OPTIMAL'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : estimate.efficiency_grade === 'ACCEPTABLE'
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                }`}
              >
                {estimate.efficiency_grade}
              </span>
            </div>

            {/* Net Amount Display */}
            <div className="text-center py-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div className="text-xs text-slate-400 font-semibold uppercase">Net Funds Reaching Campaign</div>
              <div className="text-4xl font-extrabold text-emerald-400 tracking-tight mt-1">
                ${estimate.net_received_usd.toFixed(2)} USD
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">
                ({estimate.net_received_crypto} {estimate.token})
              </div>
            </div>

            {/* Breakdown Stats List */}
            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-slate-400">Gross Donation Amount</span>
                <span className="font-bold font-mono text-white">${estimate.gross_donation_usd.toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-slate-400">Estimated Gas Fee</span>
                <span className="font-bold font-mono text-rose-400">${estimate.estimated_gas_usd.toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-slate-400">Gas Overhead Impact</span>
                <span className="font-bold font-mono text-amber-300">{estimate.gas_percentage_of_donation}%</span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-slate-400">Est. Confirmation Speed</span>
                <span className="font-bold font-mono text-indigo-300">~{estimate.estimated_confirm_time_sec}s</span>
              </div>
            </div>

            {/* Recommendation Alert Note */}
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>{estimate.recommendation_note}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Chain Gas Comparison Grid */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-emerald-400" /> Multi-Chain Gas Fee Comparison
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparison of gas overhead for a ${donationAmountUSD} donation across major networks.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {chainComparisons.map((c) => (
                <div
                  key={c.chain}
                  className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    c.chain === selectedChain
                      ? 'bg-indigo-600/10 border-indigo-500'
                      : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{c.chain_name}</span>
                      {c.is_recommended && (
                        <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Save {c.savings_vs_ethereum_percent}% vs Ethereum
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      Gas Fee: <strong className="text-white">${c.estimated_gas_usd.toFixed(2)} USD</strong> ({c.gas_percentage}% of donation)
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedChain(c.chain)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                      c.chain === selectedChain
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                    }`}
                  >
                    {c.chain === selectedChain ? 'Selected Network ✓' : 'Switch Chain'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Gas & Donation Simulator */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Interactive Gas & Goal Impact Simulator
            </h3>
          </div>
          <button
            onClick={() => {
              setDonationAmountUSD(100);
              setSelectedChain('arbitrum');
              setGasSpeed('standard');
              setCustomGweiOverride(26.5);
            }}
            className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Default
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Donation Amount Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Donation Amount ($USD)</span>
              <span className="text-emerald-400 font-mono font-bold">${donationAmountUSD} USD</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={donationAmountUSD}
              onChange={(e) => setDonationAmountUSD(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>$10</span>
              <span>$500</span>
              <span>$1,000</span>
            </div>
          </div>

          {/* Ethereum Base Gwei Slider */}
          <div className="space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-slate-300">Ethereum Base Gas (Gwei)</span>
              <span className="text-amber-400 font-mono font-bold">{customGweiOverride} Gwei</span>
            </div>
            <input
              type="range"
              min="5"
              max="120"
              step="1"
              value={customGweiOverride}
              onChange={(e) => setCustomGweiOverride(parseFloat(e.target.value))}
              className="w-full accent-amber-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>5 Gwei (Low)</span>
              <span>40 Gwei (Peak)</span>
              <span>120 Gwei (Congested)</span>
            </div>
          </div>

          {/* Crypto Wallet Address Info */}
          <div className="space-y-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400">
              <span>Campaign Wallet Address</span>
              <button
                onClick={handleCopyWallet}
                className="text-indigo-300 hover:text-white flex items-center gap-1 font-mono text-[10px]"
              >
                <Copy className="w-3 h-3" /> {copiedWallet ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] font-mono text-slate-300 truncate bg-slate-900 p-1.5 rounded border border-slate-800">
              {campaign.crypto_wallet_address}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoDonationGasEstimator;
