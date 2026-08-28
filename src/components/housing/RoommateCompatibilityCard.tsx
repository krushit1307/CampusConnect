import React from 'react';
import { RoommateCandidate } from '@/types/housing';
import { Sparkles, Moon, Sun, Volume2, ShieldCheck, MessageSquare, CheckCircle } from 'lucide-react';

interface RoommateCompatibilityCardProps {
  candidate: RoommateCandidate;
  onContactClick?: (candidate: RoommateCandidate) => void;
}

export function RoommateCompatibilityCard({
  candidate,
  onContactClick,
}: RoommateCompatibilityCardProps) {
  const score = candidate.compatibilityScore || 85;
  const isHighMatch = score >= 80;

  const sleepLabels = {
    early_bird: 'Early Bird (6 AM)',
    night_owl: 'Night Owl (1 AM+)',
    flexible: 'Flexible Schedule',
  };

  return (
    <div className="bg-white border-2 border-black rounded-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between space-y-4">
      <div>
        {/* Header with Avatar & Score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-black bg-lime/30 flex items-center justify-center font-display font-black text-lg text-black overflow-hidden">
              {candidate.avatarUrl ? (
                <img src={candidate.avatarUrl} alt={candidate.name} className="w-full h-full object-cover" />
              ) : (
                candidate.name.charAt(0)
              )}
            </div>
            <div>
              <h3 className="font-display font-black text-base text-black">
                {candidate.name}
              </h3>
              <p className="font-mono text-xs text-gray-600">
                {candidate.major} • Class of {candidate.gradYear}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded font-mono text-xs font-black border-2 border-black shadow-xs ${
                isHighMatch ? 'bg-lime text-black' : 'bg-slate-100 text-gray-700'
              }`}
            >
              <Sparkles size={12} /> {score}% Match
            </span>
          </div>
        </div>

        {/* Bio */}
        <p className="font-mono text-xs text-gray-700 mt-3 line-clamp-2">
          {candidate.bio}
        </p>

        {/* Lifestyle Grid */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="p-2 bg-slate-50 border border-slate-200 rounded flex items-center gap-1.5">
            {candidate.lifestyle.sleepSchedule === 'early_bird' ? (
              <Sun size={14} className="text-amber-500" />
            ) : (
              <Moon size={14} className="text-purple-600" />
            )}
            <span className="truncate">{sleepLabels[candidate.lifestyle.sleepSchedule]}</span>
          </div>

          <div className="p-2 bg-slate-50 border border-slate-200 rounded flex items-center gap-1.5">
            <Volume2 size={14} className="text-blue-500" />
            <span>Noise: {candidate.lifestyle.noiseTolerance}/5</span>
          </div>
        </div>

        {/* Compatibility Highlights */}
        {candidate.compatibilityHighlights && candidate.compatibilityHighlights.length > 0 && (
          <div className="mt-3 space-y-1">
            {candidate.compatibilityHighlights.map((hl, idx) => (
              <div key={idx} className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-800">
                <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                <span>{hl}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action CTA */}
      <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between">
        <div className="font-mono text-xs text-gray-500">
          Max Budget: <span className="font-bold text-black">${candidate.lifestyle.budgetMax}/mo</span>
        </div>

        <button
          onClick={() => onContactClick?.(candidate)}
          className="neu-border bg-lime hover:bg-lime/90 px-3 py-1.5 font-mono text-xs font-black uppercase text-black flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-transform"
        >
          <MessageSquare size={14} /> Connect
        </button>
      </div>
    </div>
  );
}
