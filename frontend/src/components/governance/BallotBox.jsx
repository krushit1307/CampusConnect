import React, { useState } from 'react';

export default function BallotBox({ proposalId, purpose, amount, recipient, expiresAt, yeaCount, totalVoters }) {
  const [voting, setVoting] = useState(false);
  const [voted, setVoted] = useState(false);

  const executeCryptographicVote = async (choice) => {
    setVoting(true);
    try {
      // Form precise plaintext verification message block
      const messageBlock = `Ballot-Auth-Id:${proposalId}-Choice:${choice}`;
      
      // Simulate client asymmetric signing layer (e.g., via WebCrypto API or Crypto Key Pairs)
      const mockClientSignature = "0x_signature_hash_ecc_secp256k1_stream_output";
      const mockPublicKey = "0x_user_public_cryptographic_verification_key";

      const response = await fetch(`/api/governance/proposals/${proposalId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: "66d1f05a9f1b2c3d4e5f6g7h", // Context user mapping
          ballotSelection: choice,
          signature: mockClientSignature,
          signedMessage: messageBlock,
          publicKey: mockPublicKey
        })
      });

      if (response.ok) setVoted(true);
    } catch (err) {
      console.error('Network failure verifying signature payload token:', err);
    } finally {
      setVoting(false);
    }
  };

  const calculatedProgressPercent = Math.min(((yeaCount / totalVoters) * 100), 100);

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 text-white rounded-2xl max-w-lg mx-auto shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
        <div>
          <h3 className="text-md font-bold text-white">Proposal: {purpose}</h3>
          <p className="text-xs text-slate-400 mt-1">Recipient: <span className="font-mono text-slate-300">{recipient}</span></p>
        </div>
        <span className="text-lg font-black text-emerald-400 font-mono">${amount.toLocaleString()}</span>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-xs font-mono text-slate-400 mb-2">
          <span>Consensus Progress (Requires 51%)</span>
          <span>{yeaCount} / {totalVoters} Yeas</span>
        </div>
        <div className="w-full h-2.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${calculatedProgressPercent}%` }}></div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => executeCryptographicVote('YEA')}
          disabled={voting || voted}
          className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl text-sm font-semibold tracking-wide transition shadow-lg"
        >
          {voting ? 'Signing...' : voted ? 'Ballot Recorded' : '✓ Vote Approve (Yea)'}
        </button>
        <button
          onClick={() => executeCryptographicVote('NAY')}
          disabled={voting || voted}
          className="py-3 px-4 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/20 disabled:bg-slate-800 text-rose-400 rounded-xl text-sm font-semibold transition"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}
