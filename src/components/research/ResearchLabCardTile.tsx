import React from 'react';
import { Microscope, Award, Clock, DollarSign, Send, CheckCircle } from 'lucide-react';
import { ResearchLabProject } from '../../services/researchLabEngine';

interface LabCardProps {
    lab: ResearchLabProject;
    onApply: (lab: ResearchLabProject) => void;
    hasApplied: boolean;
}

export const ResearchLabCardTile: React.FC<LabCardProps> = ({ lab, onApply, hasApplied }) => {
    return (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between">
            <div className="space-y-3">
                {/* Header Tags & Department */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-mono font-bold">
                        {lab.department}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        lab.compensationType === 'Paid Stipend' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                        lab.compensationType.includes('Credit') ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                        'bg-purple-500/10 border-purple-500/30 text-purple-400'
                    }`}>
                        {lab.compensationType}
                    </span>
                </div>

                <div>
                    <h3 className="text-lg font-black text-slate-100">{lab.labTitle}</h3>
                    <p className="text-xs text-slate-400 font-medium">
                        PI: <span className="text-indigo-300 font-bold">{lab.principalInvestigator}</span> ({lab.piTitle})
                    </p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans line-clamp-3">
                    {lab.projectSummary}
                </p>

                {/* Required Skills */}
                <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">Required Tech Skills & Tools</span>
                    <div className="flex flex-wrap gap-1.5">
                        {lab.requiredSkills.map((skill, idx) => (
                            <span
                                key={idx}
                                className="px-2 py-0.5 rounded-lg bg-slate-950 text-slate-300 text-[10px] font-mono border border-slate-800"
                            >
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Grant & Commitment Metadata */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1 text-[10px] font-mono text-slate-400">
                    <div className="flex justify-between">
                        <span>Weekly Commitment: <strong className="text-slate-200">{lab.weeklyHours} hrs/wk</strong></span>
                        <span>Openings: <strong className="text-emerald-400">{lab.openingsCount} Position(s)</strong></span>
                    </div>
                    <p className="text-[9px] text-indigo-400/80 truncate">Grant: {lab.activeGrant}</p>
                </div>
            </div>

            {/* Action Trigger */}
            <div className="pt-3 border-t border-slate-800">
                <button
                    type="button"
                    onClick={() => onApply(lab)}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                        hasApplied
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                    }`}
                >
                    {hasApplied ? (
                        <>
                            <CheckCircle className="w-4 h-4" /> Proposal Under Review
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" /> Apply for Research Position
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
