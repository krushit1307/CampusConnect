import React, { useState } from 'react';
import { DeanReviewDossier } from '../../types/alumniSpeaker';

export interface DeanReviewDossierQueueProps {
  dossiers: DeanReviewDossier[];
  onDecision: (
    dossierId: string,
    decision: 'approved' | 'rejected',
    notes: string
  ) => void;
}

export const DeanReviewDossierQueue: React.FC<DeanReviewDossierQueueProps> = ({
  dossiers,
  onDecision,
}) => {
  const [selectedDossier, setSelectedDossier] = useState<DeanReviewDossier | null>(
    dossiers[0] || null
  );
  const [deanNotes, setDeanNotes] = useState<string>('');

  const handleAction = (decision: 'approved' | 'rejected') => {
    if (!selectedDossier) return;
    onDecision(selectedDossier.dossierId, decision, deanNotes);
    setDeanNotes('');
    setSelectedDossier(null);
  };

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl shadow-2xl max-w-5xl mx-auto font-sans border border-slate-800">
      <header className="mb-6 flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-red-400 flex items-center gap-2">
            <span>🛡️</span> Dean of Students - Alumni Speaker Dossier Review
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Review background check flags for external physical guests before granting event privileges.
          </p>
        </div>
        <span className="px-3 py-1 bg-red-950 text-red-300 rounded-full text-xs font-semibold border border-red-800">
          {dossiers.length} Pending Queue
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border-r border-slate-800 pr-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Flagged Alumni Candidates
          </h3>
          {dossiers.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No dossiers requiring review.</p>
          ) : (
            dossiers.map((d) => (
              <button
                key={d.dossierId}
                onClick={() => setSelectedDossier(d)}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedDossier?.dossierId === d.dossierId
                    ? 'bg-slate-800 border-l-4 border-red-500 shadow-md'
                    : 'bg-slate-950 hover:bg-slate-850 border border-slate-800'
                }`}
              >
                <div className="font-semibold text-sm text-slate-200">{d.alumniName}</div>
                <div className="text-xs text-slate-400 flex justify-between mt-1">
                  <span>Role: {d.assignedRole}</span>
                  <span
                    className={`font-mono uppercase text-[10px] px-1.5 py-0.5 rounded ${
                      d.riskScore === 'critical'
                        ? 'bg-red-900 text-red-200'
                        : 'bg-amber-900 text-amber-200'
                    }`}
                  >
                    {d.riskScore}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="md:col-span-2">
          {selectedDossier ? (
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-slate-100">{selectedDossier.alumniName}</h3>
                  <p className="text-xs text-slate-400">{selectedDossier.alumniEmail}</p>
                </div>
                <span className="px-3 py-1 bg-amber-950 text-amber-300 rounded text-xs font-mono">
                  Role: {selectedDossier.assignedRole}
                </span>
              </div>

              <div className="bg-red-950/40 border border-red-900/60 p-4 rounded-md">
                <h4 className="text-sm font-semibold text-red-300 mb-1 flex items-center gap-1">
                  ⚠️ Checkr Background Screening Flag
                </h4>
                {selectedDossier.flagDetails.map((flag, idx) => (
                  <p key={idx} className="text-xs text-red-200 font-mono mt-1">
                    • {flag}
                  </p>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-900 p-3 rounded border border-slate-800">
                  <span className="text-slate-400 block">Criminal Records:</span>
                  <span className="text-lg font-bold text-red-400">
                    {selectedDossier.criminalRecordCount}
                  </span>
                </div>
                <div className="bg-slate-900 p-3 rounded border border-slate-800">
                  <span className="text-slate-400 block">Civil Records:</span>
                  <span className="text-lg font-bold text-amber-400">
                    {selectedDossier.civilRecordCount}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Dean Review Notes & Justification:
                </label>
                <textarea
                  value={deanNotes}
                  onChange={(e) => setDeanNotes(e.target.value)}
                  placeholder="Enter administrative adjudication notes..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleAction('approved')}
                  className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs transition-colors"
                >
                  Approve Exception & Reinstate Role
                </button>
                <button
                  onClick={() => handleAction('rejected')}
                  className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded font-medium text-xs transition-colors"
                >
                  Reject Candidate & Revoke Privileges
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-12 text-slate-500 border border-dashed border-slate-800 rounded-lg">
              Select a candidate from the sidebar to inspect background report details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
