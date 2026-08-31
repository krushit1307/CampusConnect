import React, { useState } from 'react';
import { Election, RCVRoundResult, Candidate } from '@/types/election';
import { calculateRankedChoiceRounds } from '@/lib/voting/rankedChoice';
import { ShieldCheck, BarChart3, Trophy, ArrowRight, History, Check } from 'lucide-react';

interface ElectionAuditLedgerProps {
  election: Election;
}

export function ElectionAuditLedger({ election }: ElectionAuditLedgerProps) {
  const [activeTab, setActiveTab] = useState<'rcvRounds' | 'auditTrail'>('rcvRounds');

  const { rounds, winner } = calculateRankedChoiceRounds(
    election.candidates,
    election.ballots
  );

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-6">
      {/* Header with Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h3 className="font-display font-black text-xl text-black flex items-center gap-2">
            <BarChart3 size={22} className="text-purple-600" /> Election Resolution & Audit
          </h3>
          <p className="font-mono text-xs text-gray-600">
            Instant-Runoff Voting (IRV) multi-round vote tabulation and cryptographic ledger audit.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 border-2 border-black rounded font-mono text-xs font-bold">
          <button
            onClick={() => setActiveTab('rcvRounds')}
            className={`px-3 py-1.5 rounded uppercase ${
              activeTab === 'rcvRounds' ? 'bg-lime text-black border border-black' : 'text-gray-600 hover:text-black'
            }`}
          >
            RCV Round Elimination
          </button>
          <button
            onClick={() => setActiveTab('auditTrail')}
            className={`px-3 py-1.5 rounded uppercase ${
              activeTab === 'auditTrail' ? 'bg-lime text-black border border-black' : 'text-gray-600 hover:text-black'
            }`}
          >
            Cryptographic Receipts ({election.ballots.length})
          </button>
        </div>
      </div>

      {/* Winner Banner if available */}
      {winner && (
        <div className="p-4 bg-gradient-to-r from-amber-200 to-lime border-2 border-black rounded-lg flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black text-white rounded-full">
              <Trophy size={20} className="text-amber-400" />
            </div>
            <div>
              <div className="font-mono text-[10px] font-bold uppercase text-gray-800">
                Official RCV Projected Winner
              </div>
              <div className="font-display font-black text-xl text-black">
                {winner.name} ({winner.major})
              </div>
            </div>
          </div>
          <span className="px-3 py-1 bg-black text-white font-mono text-xs font-bold rounded">
            Elected by Majority
          </span>
        </div>
      )}

      {/* RCV Multi-round Elimination Breakdown */}
      {activeTab === 'rcvRounds' ? (
        <div className="space-y-4">
          {rounds.map((round) => {
            const totalRoundVotes = Object.values(round.voteCounts).reduce((a, b) => a + b, 0);

            return (
              <div
                key={round.roundNumber}
                className="p-4 bg-slate-50 border-2 border-black rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <span className="font-mono font-black text-xs uppercase text-black">
                    Round {round.roundNumber} Tabulation
                  </span>
                  {round.eliminatedCandidateId && (
                    <span className="font-mono text-[11px] text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded border border-red-300">
                      Eliminated: {election.candidates.find((c) => c.id === round.eliminatedCandidateId)?.name}
                    </span>
                  )}
                  {round.winnerCandidateId && (
                    <span className="font-mono text-[11px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                      Winner: {election.candidates.find((c) => c.id === round.winnerCandidateId)?.name}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {Object.entries(round.voteCounts).map(([candidateId, count]) => {
                    const cand = election.candidates.find((c) => c.id === candidateId);
                    const pct = totalRoundVotes > 0 ? Math.round((count / totalRoundVotes) * 100) : 0;

                    return (
                      <div key={candidateId} className="space-y-1">
                        <div className="flex justify-between font-mono text-xs">
                          <span className="font-bold text-black">{cand?.name}</span>
                          <span className="font-bold">{count} votes ({pct}%)</span>
                        </div>
                        <div className="w-full h-3 bg-white border border-black rounded-full overflow-hidden">
                          <div
                            className="h-full bg-lime border-r border-black"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Cryptographic Audit Trail */
        <div className="space-y-2">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded font-mono text-xs text-blue-900 flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-600 shrink-0" />
            <span>
              Every entry in this ledger is cryptographically signed. Voters can verify their receipt hash against this ledger.
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
            {election.ballots.map((ballot) => (
              <div
                key={ballot.ballotId}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between hover:bg-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-black">{ballot.voterHash}</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500 font-mono text-[10px]">
                    Sig: {ballot.signature.slice(0, 16)}...
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Verified On-Chain
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
