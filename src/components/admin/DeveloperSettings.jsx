import React, { useState } from 'react';

export default function DeveloperSettings({ clubId }) {
  const [tokenName, setTokenName] = useState('');
  const [plainToken, setPlainToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateToken = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/clubs/${clubId}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tokenName })
    });
    const data = await res.json();
    if (res.ok) {
      setPlainToken(data.token); // Shown only once
    } else {
      alert(`Error: ${data.detail}`);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Developer Settings & API Access</h2>
        <p className="text-sm text-slate-500 mt-1">Generate Personal Access Tokens (PATs) to connect CampusConnect data to Airtable or custom CRMs.</p>
      </div>

      {plainToken && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-xs font-bold text-emerald-800 uppercase">Save your Personal Access Token</p>
          <p className="text-sm text-emerald-700 mt-1 font-mono bg-white p-2 rounded border border-emerald-300">{plainToken}</p>
          <p className="text-xs text-emerald-600 mt-2">⚠️ This token will never be shown again. Store it securely.</p>
        </div>
      )}

      <form onSubmit={generateToken} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Token Identifier / Purpose</label>
          <input 
            type="text" 
            placeholder="e.g., Airtable Sync Integration"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
            required
          />
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          {loading ? "Generating..." : "Generate New PAT"}
        </button>
      </form>
    </div>
  );
}
