/**
 * Enterprise Architectural Specification & React Component:
 * Module: Interactive Dynamic Resource Conflict Resolver UI
 * File: components/ResourceConflictResolverModal.tsx
 * Standard: React 18 Functional Component, Real-Time Temporal Intersection Engine
 * Compliance: WCAG 2.1 AA Accessibility, Immediate Pre-Submission Selection Blocking (#4281)
 */

import React, { useState } from 'react';
import { resourceConflictResolverService, UniversityResource, ConflictCheckResult } from '../src/services/resourceConflictResolverService';

export interface ResourceConflictResolverModalProps {
  onConfirmSelection?: (selectedResource: UniversityResource) => void;
}

export const ResourceConflictResolverModal: React.FC<ResourceConflictResolverModalProps> = ({
  onConfirmSelection
}) => {
  const resources = resourceConflictResolverService.getAllResources();
  const [selectedResourceId, setSelectedResourceId] = useState<string>(resources[0]?.id || 'RES-PROJ-A1');
  
  // Set default temporal range for testing (Friday 6:00 PM to 7:30 PM - overlaps 5 PM to 7 PM CS Club booking)
  const today = new Date();
  const fridayStart = new Date(today.setDate(today.getDate() + ((5 + 7 - today.getDay()) % 7)));
  fridayStart.setHours(18, 0, 0, 0); // 6:00 PM

  const fridayEnd = new Date(fridayStart);
  fridayEnd.setHours(19, 30, 0, 0); // 7:30 PM

  const [startTime, setStartTime] = useState<string>(fridayStart.toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState<string>(fridayEnd.toISOString().slice(0, 16));

  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);

  const handleResourceSelect = (resId: string) => {
    setSelectedResourceId(resId);
    evaluateConflict(resId, new Date(startTime), new Date(endTime));
  };

  const evaluateConflict = (resId: string, start: Date, end: Date) => {
    try {
      const res = resourceConflictResolverService.checkResourceConflict(resId, start, end);
      setConflictResult(res);
    } catch (err: any) {
      setConflictResult({ hasConflict: false, conflictMessage: err.message });
    }
  };

  const handleAcceptAlternative = () => {
    if (conflictResult?.alternativeResource) {
      setSelectedResourceId(conflictResult.alternativeResource.id);
      setConflictResult(null); // Clear conflict once alternative is accepted
      if (onConfirmSelection) {
        onConfirmSelection(conflictResult.alternativeResource);
      }
    }
  };

  const selectedRes = resources.find((r) => r.id === selectedResourceId);

  return (
    <div className="resource-resolver-container bg-slate-900 border border-slate-700/80 rounded-xl p-6 shadow-2xl max-w-2xl mx-auto text-slate-100 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
            <span>⚡</span> IT Resource Conflict Resolver
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-1">Pre-submission Temporal Intersection Validator</p>
        </div>
        <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold px-3 py-1 rounded-full">
          Algorithmic Prevention Active
        </span>
      </div>

      {/* Temporal Selection Form */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-slate-400 uppercase font-mono block mb-1">Event Start Time</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              evaluateConflict(selectedResourceId, new Date(e.target.value), new Date(endTime));
            }}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs font-mono outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 uppercase font-mono block mb-1">Event End Time</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              evaluateConflict(selectedResourceId, new Date(startTime), new Date(e.target.value));
            }}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-xs font-mono outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Asset Selection Grid */}
      <div className="mb-6">
        <label className="text-xs text-slate-400 uppercase font-mono block mb-2">Select Scarce University Asset</label>
        <div className="grid grid-cols-2 gap-3">
          {resources.map((res) => {
            const isSelected = res.id === selectedResourceId;
            return (
              <button
                key={res.id}
                type="button"
                onClick={() => handleResourceSelect(res.id)}
                className={`p-3.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? conflictResult?.hasConflict
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                      : 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                    : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 text-slate-300'
                }`}
              >
                <div className="font-bold text-sm">{res.assetTag}</div>
                <div className="text-xs opacity-75 truncate">{res.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Conflict Alert Banner */}
      {conflictResult?.hasConflict ? (
        <div className="bg-rose-950/90 border-2 border-rose-500 p-5 rounded-xl text-rose-200 mb-6 shadow-xl animate-pulse">
          <div className="flex items-center gap-2 font-bold text-rose-400 text-sm mb-2">
            <span>🚨</span> RESOURCE OVERLAP DETECTED (SELECTION BLOCKED)
          </div>
          <p className="text-xs leading-relaxed font-sans mb-4">{conflictResult.conflictMessage}</p>

          {conflictResult.alternativeResource && (
            <button
              onClick={handleAcceptAlternative}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all shadow-md flex items-center gap-2"
            >
              <span>✔</span> Request Alternative: {conflictResult.alternativeResource.assetTag}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-emerald-950/60 border border-emerald-500/50 p-4 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between mb-6">
          <span>✔ Resource is available during requested temporal boundaries!</span>
          {selectedRes && onConfirmSelection && (
            <button
              onClick={() => onConfirmSelection(selectedRes)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md text-xs font-bold"
            >
              Confirm Reservation
            </button>
          )}
        </div>
      )}
    </div>
  );
};
