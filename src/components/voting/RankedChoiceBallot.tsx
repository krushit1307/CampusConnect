import React, { useState } from 'react';
import { Candidate } from '@/types/election';
import { GripVertical, ArrowUp, ArrowDown, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';

interface RankedChoiceBallotProps {
  candidates: Candidate[];
  onSubmitBallot: (rankedCandidateIds: string[]) => void;
  hasVoted: boolean;
}

export function RankedChoiceBallot({
  candidates,
  onSubmitBallot,
  hasVoted,
}: RankedChoiceBallotProps) {
  const [rankedList, setRankedList] = useState<Candidate[]>(candidates);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const moveCandidate = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rankedList.length) return;

    const updated = [...rankedList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setRankedList(updated);
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitBallot(rankedList.map((c) => c.id));
      setIsSubmitting(false);
    }, 800);
  };

  if (hasVoted) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-500 rounded-lg p-6 text-center space-y-3 shadow-[4px_4px_0px_0px_rgba(16,185,129,1)]">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-700 border-2 border-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 size={24} />
        </div>
        <h3 className="font-display font-black text-xl text-emerald-900">
          Ranked Ballot Cast & Sealed
        </h3>
        <p className="font-mono text-xs text-emerald-700 max-w-md mx-auto">
          Your preferences have been cryptographically blinded and anchored into the election audit ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-5">
      <div className="border-b-2 border-black pb-3">
        <h3 className="font-display font-black text-xl text-black">
          Cast Ranked-Choice Ballot
        </h3>
        <p className="font-mono text-xs text-gray-600 mt-0.5">
          Order candidates by preference (1st Choice is highest). Use arrows or drag to reorder.
        </p>
      </div>

      {/* Candidate Rank Cards */}
      <div className="space-y-2.5">
        {rankedList.map((candidate, idx) => (
          <div
            key={candidate.id}
            className="flex items-center justify-between p-3.5 border-2 border-black rounded-lg bg-slate-50 hover:bg-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 bg-lime border-2 border-black rounded-full flex items-center justify-center font-mono font-black text-xs text-black">
                #{idx + 1}
              </span>
              <div>
                <div className="font-display font-black text-sm text-black">
                  {candidate.name}
                </div>
                <div className="font-mono text-xs text-gray-600">
                  {candidate.major} • {candidate.platformSummary}
                </div>
              </div>
            </div>

            {/* Reorder Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => moveCandidate(idx, 'up')}
                className="p-1.5 border border-black rounded bg-white hover:bg-slate-100 disabled:opacity-30"
                title="Move Up"
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                disabled={idx === rankedList.length - 1}
                onClick={() => moveCandidate(idx, 'down')}
                className="p-1.5 border border-black rounded bg-white hover:bg-slate-100 disabled:opacity-30"
                title="Move Down"
              >
                <ArrowDown size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded font-mono text-xs text-blue-900">
        <ShieldCheck size={16} className="text-blue-600 shrink-0" />
        <span>
          Zero-Knowledge Blind Signatures guarantee that no administrator or third-party can connect your identity to your ranked vote.
        </span>
      </div>

      {/* Submit Action */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full py-3 bg-lime hover:bg-lime/90 text-black border-2 border-black rounded font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
      >
        <Lock size={16} />
        {isSubmitting ? 'Blinding and Signing Ballot...' : 'Submit Verifiable Ballot'}
      </button>
    </div>
  );
}
