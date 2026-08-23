import React, { useState } from 'react';

export default function ClubRenewalWizard({ clubId, onRenewalComplete }) {
  const [step, setStep] = useState(1);
  const [newPresidentId, setNewPresidentId] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRenewalSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("new_president_id", newPresidentId);
    formData.append("constitution_file", file);

    const res = await fetch(`/api/clubs/${clubId}/submit-renewal`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      alert("Renewal complete! Dashboard unlocked.");
      onRenewalComplete();
    } else {
      const err = await res.json();
      alert(`Renewal failed: ${err.detail}`);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 border border-slate-200">
        <div className="mb-6">
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Mandatory Annual Compliance
          </span>
          <h2 className="text-2xl font-ext500 font-bold text-slate-900 mt-2">Club Renewal Wizard</h2>
          <p className="text-sm text-slate-500 mt-1">Complete the steps below to unlock your Club Dashboard.</p>
        </div>

        <form onSubmit={handleRenewalSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-md font-bold text-slate-800">Step 1: Upload Updated Constitution</h3>
              <p className="text-xs text-slate-500">Attach the verified PDF constitution for the upcoming year.</p>
              <input 
                type="file" 
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])} 
                className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                required
              />
              <button 
                type="button" 
                onClick={() => setStep(2)} 
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition"
              >
                Next: Financial Reconciliation
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-md font-bold text-slate-800">Step 2: Balance Reconciliation</h3>
              <p className="text-xs text-slate-500">Confirm account balances are rolled over or cleared to $0.</p>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">
                ✓ Account status verified for rollover.
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={() => setStep(1)} className="w-1/2 border border-slate-300 py-2.5 rounded-lg font-medium">Back</button>
                <button type="button" onClick={() => setStep(3)} className="w-1/2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium">Next: Successor Handover</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-md font-bold text-slate-800">Step 3: Assign Next Year's President</h3>
              <p className="text-xs text-slate-500">Enter the User ID of the incoming student president.</p>
              <input 
                type="number" 
                placeholder="Incoming President User ID"
                value={newPresidentId}
                onChange={(e) => setNewPresidentId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                required
              />
              <div className="flex space-x-3">
                <button type="button" onClick={() => setStep(2)} className="w-1/2 border border-slate-300 py-2.5 rounded-lg font-medium">Back</button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-1/2 bg-emerald-600 text-white py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition"
                >
                  {loading ? "Submitting..." : "Complete Renewal"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
