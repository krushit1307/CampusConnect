import React, { useState } from 'react';
import {
  DeliverableDisputeCase,
  ArbitrationVoteChoice,
} from '../../types/vendorArbitrationVoting';
import { vendorArbitrationVotingService } from '../../services/vendorArbitrationVotingService';

export const VendorArbitrationCourtView: React.FC = () => {
  const [disputes, setDisputes] = useState<DeliverableDisputeCase[]>(
    vendorArbitrationVotingService.getDisputes()
  );
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>(disputes[0]?.id || '');
  const [activeJuryAdminId, setActiveJuryAdminId] = useState<string>('adm_astro_01');
  const [resolutionAlert, setResolutionAlert] = useState<string | null>(null);

  const activeDispute = disputes.find((d) => d.id === selectedDisputeId) || disputes[0];

  const handleVote = (choice: ArbitrationVoteChoice) => {
    try {
      const result = vendorArbitrationVotingService.castBlindJuryVote(
        activeDispute.id,
        activeJuryAdminId,
        choice
      );
      setDisputes(vendorArbitrationVotingService.getDisputes());
      setResolutionAlert(result.message);

      // Auto-switch to next unvoted jury member if available
      const nextUnvoted = result.dispute.selectedJuryPool.find((j) => !j.hasVoted);
      if (nextUnvoted) {
        setActiveJuryAdminId(nextUnvoted.adminId);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentJuryMember = activeDispute?.selectedJuryPool.find((j) => j.adminId === activeJuryAdminId);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20">
              ⚖️ Decentralized Arbitration Court
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Blind Majority State Machine (3/5)
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">Vendor Deliverable Arbitration & Jury Voting</h2>
          <p className="text-sm text-slate-400">
            Cryptographic blind jury voting by randomly selected non-conflicted club admins with automated escrow execution
          </p>
        </div>

        {/* Dispute Status Badge */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${
          activeDispute?.status === 'JURY_DELIBERATION'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : activeDispute?.status === 'RESOLVED_VENDOR_PAID'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
        }`}>
          <div className="w-3 h-3 rounded-full bg-current animate-pulse" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">Escrow State (${activeDispute?.escrowAmountUsd})</div>
            <div className="text-xs font-bold">{activeDispute?.status.replace('_', ' ')}</div>
          </div>
        </div>
      </div>

      {/* Resolution Notification Banner */}
      {resolutionAlert && (
        <div className="p-4 rounded-xl bg-violet-950/60 border border-violet-500/40 text-violet-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-base">📢</span>
            <span>{resolutionAlert}</span>
          </div>
          <button onClick={() => setResolutionAlert(null)} className="text-violet-400 hover:text-white font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Evidence Comparison vs Blind Jury Ballot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Dual Evidence Locker (Vendor vs Club) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              📑 Dispute Case: {activeDispute?.deliverableTitle}
            </h3>

            {/* Side-by-side Evidence Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Vendor Evidence Card */}
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span>🍕</span> Vendor: {activeDispute?.vendorName}
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                    Delivery Proof
                  </span>
                </div>

                <div className="relative rounded-lg overflow-hidden border border-slate-800 h-40 bg-black">
                  <img
                    src={activeDispute?.vendorEvidencePhotoUrl}
                    alt="Vendor Evidence"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-2 bg-black/80 px-2 py-0.5 rounded text-[9px] font-mono text-emerald-300">
                    EXIF: 6:45 PM • GPS VERIFIED
                  </div>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed italic">
                  "{activeDispute?.vendorEvidenceStatement}"
                </p>
              </div>

              {/* Organizer Club Complaint Card */}
              <div className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <span>🏛️</span> Club: {activeDispute?.organizerClubName}
                  </span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-semibold">
                    Dispute Claim
                  </span>
                </div>

                <div className="rounded-lg border border-slate-800 h-40 bg-slate-950 p-3 flex flex-col justify-center text-center space-y-2">
                  <span className="text-3xl">📦</span>
                  <div className="text-xs font-semibold text-rose-300">Damaged & Late Delivery Claimed</div>
                  <div className="text-[11px] text-slate-400">Claimed 30 min delay & cold food</div>
                </div>

                <p className="text-slate-300 text-xs leading-relaxed italic">
                  "{activeDispute?.organizerComplaintStatement}"
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Blind Jury Duty Ballot & Live Tally */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              🗳️ Blind Jury Duty Voting Station
            </h3>

            {/* Active Juror Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Simulate Juror (Selected from 5 Unrelated Club Admins):
              </label>
              <select
                value={activeJuryAdminId}
                onChange={(e) => setActiveJuryAdminId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-violet-500 focus:outline-none"
              >
                {activeDispute?.selectedJuryPool.map((juror) => (
                  <option key={juror.adminId} value={juror.adminId}>
                    {juror.adminName} ({juror.clubAffiliation}) - {juror.hasVoted ? '✅ Voted' : '⏳ Awaiting Vote'}
                  </option>
                ))}
              </select>
            </div>

            {/* Voting Action Buttons */}
            {activeDispute?.status === 'JURY_DELIBERATION' ? (
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleVote('PAYOUT_VENDOR')}
                  disabled={currentJuryMember?.hasVoted}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <span>💸</span> Vote: [Payout Vendor] (${activeDispute.escrowAmountUsd})
                </button>

                <button
                  onClick={() => handleVote('REFUND_CLUB')}
                  disabled={currentJuryMember?.hasVoted}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                >
                  <span>🔄</span> Vote: [Refund Club] (${activeDispute.escrowAmountUsd})
                </button>

                {currentJuryMember?.hasVoted && (
                  <div className="text-center text-xs text-slate-400 font-semibold italic">
                    This juror has already submitted their confidential vote. Switch juror above to cast next ballot.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-700 text-center space-y-2">
                <div className="text-sm font-bold text-emerald-400">✨ Arbitration Closed & Finalized</div>
                <p className="text-xs text-slate-300 font-mono">{activeDispute?.resolutionTxHash}</p>
              </div>
            )}

            {/* Jury Tally Progress Bar (Majority Rule 3/5) */}
            <div className="pt-3 border-t border-slate-700/60 space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-emerald-400">Payout Vendor ({activeDispute?.payoutVendorVotesCount})</span>
                <span className="text-slate-400">Threshold: 3 Votes</span>
                <span className="text-rose-400">Refund Club ({activeDispute?.refundClubVotesCount})</span>
              </div>

              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-700">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(activeDispute?.payoutVendorVotesCount || 0) * 20}%` }}
                />
                <div
                  className="bg-rose-500 transition-all duration-500 ml-auto"
                  style={{ width: `${(activeDispute?.refundClubVotesCount || 0) * 20}%` }}
                />
              </div>

              {/* Juror Roll Call List */}
              <div className="space-y-1.5 pt-2">
                {activeDispute?.selectedJuryPool.map((juror) => (
                  <div
                    key={juror.adminId}
                    className="p-2 bg-slate-900/60 rounded-lg text-[11px] flex items-center justify-between border border-slate-800"
                  >
                    <div>
                      <span className="font-semibold text-white">{juror.adminName}</span>
                      <span className="text-slate-500 text-[10px] ml-1.5">({juror.clubAffiliation})</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                      juror.hasVoted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {juror.hasVoted ? 'BALLOT CAST' : 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
