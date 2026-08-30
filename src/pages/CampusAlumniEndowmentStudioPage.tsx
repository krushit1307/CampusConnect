import React, { useState } from 'react';
import {
  CampusAlumniEndowmentService,
  EndowmentCampaign,
  AlumniDonationTransaction,
} from '../../backend/src/services/CampusAlumniEndowmentService';

export const CampusAlumniEndowmentStudioPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<EndowmentCampaign[]>(
    CampusAlumniEndowmentService.getActiveCampaigns()
  );
  const [transactions, setTransactions] = useState<AlumniDonationTransaction[]>(
    CampusAlumniEndowmentService.getDonationHistory()
  );

  const [selectedCampaign, setSelectedCampaign] = useState<EndowmentCampaign | null>(null);
  const [donationAmount, setDonationAmount] = useState<number>(250);
  const [donorName, setDonorName] = useState<string>('Alex Rivera');
  const [gradYear, setGradYear] = useState<number>(2018);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<
    'CREDIT_CARD' | 'BANK_TRANSFER' | 'CRYPTO' | 'STOCK_TRANSFER'
  >('CREDIT_CARD');

  const metrics = CampusAlumniEndowmentService.calculateTotalImpactMetrics();

  const handleDonateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign) return;

    const { transaction } = CampusAlumniEndowmentService.processDonation(
      selectedCampaign.id,
      donorName,
      gradYear,
      donationAmount,
      isAnonymous,
      paymentMethod
    );

    setCampaigns([...CampusAlumniEndowmentService.getActiveCampaigns()]);
    setTransactions([transaction, ...transactions]);
    setSelectedCampaign(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Alumni Endowment & Crowdfunding
            </span>
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold px-3 py-1 rounded-full font-mono">
              Corporate Matching Active
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            Campus Alumni Endowment Studio
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Empower student scholarships, research lab equipment, and athletic facilities through alumni gift matching and crowdfunding.
          </p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Endowment Raised</span>
          <div className="text-2xl md:text-3xl font-black text-emerald-400 mt-1">
            ${metrics.totalRaised.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">+18.4% vs Last Semester</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alumni Donors</span>
          <div className="text-2xl md:text-3xl font-black text-blue-400 mt-1">
            {metrics.totalDonors.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Active Network Participants</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fully Funded Campaigns</span>
          <div className="text-2xl md:text-3xl font-black text-purple-400 mt-1">
            {metrics.fundedCount} / {metrics.activeCampaignsCount}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">100% Target Met</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Match Ratio</span>
          <div className="text-2xl md:text-3xl font-black text-amber-400 mt-1">1.75x</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Corporate Sponsor Multiplier</span>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white">Active Endowment & Crowdfunding Campaigns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {campaigns.map((c) => {
            const pct = Math.min(100, Math.round((c.raisedAmount / c.targetAmount) * 100));
            return (
              <div
                key={c.id}
                className="bg-slate-900/80 backdrop-blur-md border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                      {c.category}
                    </span>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {c.matchingGrantRatio}x Corporate Match
                    </span>
                  </div>

                  <h3 className="text-xl font-black text-white mb-2">{c.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{c.description}</p>

                  {c.matchingSponsorName && (
                    <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl mb-4 text-xs text-slate-300">
                      <span className="text-slate-400 font-bold block mb-0.5">Matching Sponsor:</span>
                      🤝 {c.matchingSponsorName}
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-emerald-400">${c.raisedAmount.toLocaleString()} Raised</span>
                      <span className="text-slate-400">Target: ${c.targetAmount.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCampaign(c)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg hover:shadow-emerald-500/20"
                >
                  Pledge Alumni Contribution
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Donor Activity */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-black text-white">Recent Alumni Donor Activity</h2>
        <div className="space-y-3">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs"
            >
              <div>
                <span className="font-bold text-white text-sm">{t.donorName}</span>
                <span className="text-slate-400 ml-2">Class of {t.donorGraduationYear}</span>
                <p className="text-slate-500 text-[11px] mt-0.5">Payment Method: {t.paymentMethod} • {t.timestamp}</p>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-bold text-sm block">+${t.amount.toLocaleString()}</span>
                <span className="text-blue-400 text-[11px] block">+${t.matchedAmount.toLocaleString()} Corporate Match</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Donation Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleDonateSubmit}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl"
          >
            <h2 className="text-xl font-bold text-white">Pledge Alumni Contribution</h2>
            <p className="text-xs text-slate-400">Campaign: {selectedCampaign.title}</p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Donor Name</label>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Graduation Year</label>
                <input
                  type="number"
                  value={gradYear}
                  onChange={(e) => setGradYear(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Pledge Amount ($)</label>
                <input
                  type="number"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                  required
                  min={10}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Payment Channel</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
              >
                <option value="CREDIT_CARD">Credit Card / Debit</option>
                <option value="BANK_TRANSFER">ACH Bank Transfer</option>
                <option value="STOCK_TRANSFER">Equity / Stock Gift Transfer</option>
                <option value="CRYPTO">Crypto (USDC / ETH)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="anon"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-slate-800 bg-slate-950 text-emerald-500 focus:ring-0"
              />
              <label htmlFor="anon" className="text-xs text-slate-400">Keep donor identity anonymous on public leaderboard</label>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedCampaign(null)}
                className="w-1/2 py-2.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 font-bold text-xs hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Confirm Contribution
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
