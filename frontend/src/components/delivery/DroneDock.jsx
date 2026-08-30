import React, { useState } from 'react';

export default function DroneDock({ sessionId, droneId, provider, initialStatus }) {
  const [bayStatus, setBayStatus] = useState(initialStatus || 'LOCKED');
  const [processing, setProcessing] = useState(false);

  const handlePhysicalUnlockTrigger = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/drone/delivery/${sessionId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizerToken: 'AUTH_SESSION_PROP_SECURE_MAPPED' })
      });

      if (response.ok) {
        setBayStatus('UNLOCKED_OPEN');
      }
    } catch (err) {
      console.error('Failed to issue hardware unlock stream token:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl max-w-md mx-auto text-white shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">🤖 Autonomous Courier Status</h3>
        <span className="px-2 py-0.5 text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">
          {provider}
        </span>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/60 mb-6 font-mono text-xs space-y-1 text-slate-400">
        <p>Drone Hardware Reference ID: <span className="text-slate-200">{droneId}</span></p>
        <p>Current Cargo State: 
          <span className={`ml-1 font-bold ${bayStatus === 'LOCKED' ? 'text-amber-400' : bayStatus === 'UNLOCKED_OPEN' ? 'text-blue-400' : 'text-emerald-400'}`}>
            {bayStatus}
          </span>
        </p>
      </div>

      <button
        onClick={handlePhysicalUnlockTrigger}
        disabled={processing || bayStatus !== 'LOCKED'}
        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl text-sm font-semibold tracking-wide transition shadow-lg"
      >
        {processing ? 'Communicating with Drone...' : bayStatus === 'LOCKED' ? '🔓 Unlock Robot Cargo Lid' : 'Cargo Bay Disengaged'}
      </button>
      
      <p className="text-[10px] text-slate-500 text-center mt-3">
        Stripe Escrow protection requires authenticated extraction signature response loops.
      </p>
    </div>
  );
}
