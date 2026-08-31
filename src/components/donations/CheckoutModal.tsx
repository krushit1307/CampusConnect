import React, { useState } from 'react';

export default function CheckoutModal({ clubId, amount, onSuccess }: { clubId: string; amount: number; onSuccess: () => void }) {
  const [employerName, setEmployerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<any>(null);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clubId, amount, employerName }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.donation.matchingEligible) {
          setMatchResult(data.donation);
        } else {
          onSuccess();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFile = async (donationId: string) => {
    const res = await fetch(`/api/donations/${donationId}/file-match`, { method: 'POST' });
    if (res.ok) {
      alert('Matching request successfully auto-filed with your employer!');
      onSuccess();
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Complete Donation (${amount})</h2>
      {!matchResult ? (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Employer Name (for Corporate Matching)</label>
            <input
              type="text"
              placeholder="e.g. Microsoft, Google"
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
            />
          </div>
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            {loading ? 'Processing...' : 'Donate Now'}
          </button>
        </>
      ) : (
        <div className="bg-green-50 p-4 rounded border border-green-200 space-y-3">
          <h3 className="font-semibold text-green-800">Corporate Match Available! 🎉</h3>
          <p className="text-sm text-green-700">
            {matchResult.employerName} will match your ${matchResult.amount}! Click below to auto-file using the club's Tax EIN.
          </p>
          <button
            onClick={() => handleAutoFile(matchResult._id)}
            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700"
          >
            Auto-File Matching Request
          </button>
        </div>
      )}
    </div>
  );
}
