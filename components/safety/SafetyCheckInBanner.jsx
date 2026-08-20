import React, { useState } from 'react';

export function SafetyCheckInBanner({ eventId, onConfirmSuccess }) {
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSafetyConfirm = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/safety/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId })
      });

      if (response.ok) {
        setConfirmed(true);
        if (onConfirmSuccess) onConfirmSuccess();
      }
    } catch (error) {
      console.error('Failed to submit safety confirmation:', error);
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          ✓ Safe return confirmed. Thank you!
        </span>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="space-y-0.5">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Trip Safety Check-In Required
        </span>
        <p className="text-sm text-gray-800 dark:text-gray-200">Please confirm that you have safely returned from this off-campus event.</p>
      </div>
      <button
        disabled={loading}
        onClick={handleSafetyConfirm}
        className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-sm transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {loading ? 'Confirming...' : 'I Have Safely Returned'}
      </button>
    </div>
  );
}
