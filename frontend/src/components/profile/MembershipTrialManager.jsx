import React, { useState, useEffect } from 'react';

export default function MembershipTrialManager({ membershipId }) {
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchActiveMembershipState();
  }, [membershipId]);

  const fetchActiveMembershipState = async () => {
    try {
      const res = await fetch(`/api/memberships/${membershipId}`);
      if (res.ok) {
        const data = await res.json();
        setMembership(data.data);
      }
    } catch (err) {
      console.error('Error fetching membership state details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTrial = async () => {
    if (!window.confirm('Are you sure you want to cancel your Premium trial? You will immediately lose access to premium tier resources.')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/memberships/${membershipId}/cancel-trial`, { method: 'POST' });
      if (res.ok) {
        alert('Trial subscription cancelled successfully. Your account has been reverted to the Standard tier.');
        await fetchActiveMembershipState();
      }
    } catch (err) {
      console.error('Failed to cancel subscription trial line:', err);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="text-xs font-mono text-slate-500 animate-pulse">Checking membership standings...</div>;
  if (!membership || membership.subscriptionStatus !== 'TRIAL') return null;

  // Compute days remaining in active checkout window frames
  const daysLeft = Math.ceil((new Date(membership.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div className="membership-trial-box p-5 bg-slate-900 border border-amber-500/20 text-white rounded-xl max-w-md shadow-lg font-sans">
      <header className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⏳</span>
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Premium Access Free Trial</h3>
        </div>
        <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-[9px] px-2 py-0.5 rounded-full uppercase font-mono">
          {daysLeft} Days Left
        </span>
      </header>

      <p className="text-xs text-slate-300 leading-relaxed mb-4">
        You are currently exploring <span className="text-white font-bold">{membership.clubTitle} Premium</span> on a 14-day free trial footprint. 
        Your card will automatically be charged <span className="text-indigo-400 font-bold">$20.00</span> on <span className="text-white font-semibold font-mono">{new Date(membership.trialEndsAt).toLocaleDateString()}</span> unless cancelled beforehand.
      </p>

      <div className="flex justify-end pt-2">
        <button
          onClick={handleCancelTrial}
          disabled={cancelling}
          className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-900/50 text-[11px] font-bold rounded-lg transition-all disabled:opacity-40"
        >
          {cancelling ? 'Terminating Trial...' : 'Cancel Trial Subscription'}
        </button>
      </div>
    </div>
  );
}
