import React, { useState, useEffect } from 'react';

export default function GigBoard({ activeClubId, isManager }) {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchOpenBounties();
  }, []);

  const fetchOpenBounties = async () => {
    try {
      const res = await fetch('/api/marketplace/bounties');
      if (res.ok) {
        const resData = await res.json();
        setBounties(resData.data || []);
      }
    } catch (err) {
      console.error('Error loading marketplace listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptDraft = async (submissionId) => {
    if (!window.confirm('Accept this design draft? This will immediately deduct funds from your club ledger.')) return;
    setProcessingId(submissionId);
    try {
      const res = await fetch(`/api/marketplace/submissions/${submissionId}/accept`, { method: 'POST' });
      if (res.ok) {
        alert('Draft accepted successfully! Payout transferred and high-res asset bound.');
        fetchOpenBounties();
      } else {
        const error = await res.json();
        alert(`Transaction Blocked: ${error.message}`);
      }
    } catch (err) {
      console.error('Failed to commit escrow release:', err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-4 text-xs font-mono text-slate-500 animate-pulse">Hydrating gig matrix...</div>;

  return (
    <div className="gig-marketplace-board space-y-6 max-w-4xl mx-auto p-6 bg-slate-950 text-white font-sans rounded-xl border border-slate-800">
      <header>
        <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase">
          🎨 Cross-Disciplinary Gig Economy
        </span>
        <h2 className="text-lg font-bold mt-2">Campus Creative Bounty Marketplace</h2>
      </header>

      <div className="space-y-4">
        {bounties.map((bounty) => (
          <div key={bounty.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-200">{bounty.description}</h3>
                <p className="text-[10px] text-slate-500 mt-1">Posted by Club ID: {bounty.club_id}</p>
              </div>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold text-xs px-2.5 py-1 rounded">
                ₹{bounty.payout_amount}
              </span>
            </div>

            {/* Submissions Section */}
            <div className="pt-3 border-t border-slate-800">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Submitted Draft Previews</h4>
              {bounty.submissions?.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No concept drafts uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {bounty.submissions?.map((sub) => (
                    <div key={sub.id} className="relative group bg-slate-950 p-2 border border-slate-800 rounded-lg overflow-hidden">
                      <div className="relative aspect-video bg-slate-800 rounded mb-2 overflow-hidden">
                        <img src={sub.watermarked_url} alt="Concept Preview" className="w-full h-full object-cover filter blur-[0.5px]" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                          <span className="text-[8px] font-bold font-mono tracking-widest text-white/50 uppercase border border-white/20 px-1 rotate-12">
                            Watermarked
                          </span>
                        </div>
                      </div>
                      
                      {isManager && bounty.club_id === activeClubId && (
                        <button
                          onClick={() => handleAcceptDraft(sub.id)}
                          disabled={processingId !== null}
                          className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-[10px] rounded transition-colors"
                        >
                          {processingId === sub.id ? 'Processing...' : 'Accept Draft'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
