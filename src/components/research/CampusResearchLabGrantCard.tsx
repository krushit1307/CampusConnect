import React from 'react';
import { Atom, DollarSign, UserCheck, Users } from 'lucide-react';

interface CardProps {
  lab: {
    _id: string;
    labTitle: string;
    department: string;
    principalInvestigator: string;
    campusName: string;
    grantCategory: string;
    fundingTargetUsd: number;
    fundingSecuredUsd: number;
    openRAPositionsCount: number;
    grantStatus: string;
  };
  onFundClick: (labId: string) => void;
}

export const CampusResearchLabGrantCard: React.FC<CardProps> = ({ lab, onFundClick }) => {
  const percentFunded = Math.min(
    Math.round((lab.fundingSecuredUsd / lab.fundingTargetUsd) * 100),
    100
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-cyan-500/40 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
            <Atom className="w-3.5 h-3.5 text-cyan-400" />
            {lab.grantCategory}
          </span>
          <span
            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
              lab.grantStatus === 'GRANT_AWARDED'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}
          >
            {lab.grantStatus}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">{lab.labTitle}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              PI: {lab.principalInvestigator} • {lab.department} ({lab.campusName})
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-cyan-400 block tracking-tight">
              ${lab.fundingSecuredUsd.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Target: ${lab.fundingTargetUsd.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-950 rounded-full h-2.5 mb-4 border border-slate-800 overflow-hidden">
          <div
            className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${percentFunded}%` }}
          />
        </div>

        <div className="bg-slate-950/40 rounded-2xl p-3.5 mb-5 space-y-2 text-xs border border-slate-800/40">
          <div className="flex justify-between">
            <span className="text-slate-400">Open RA Positions:</span>
            <span className="font-bold text-cyan-300 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {lab.openRAPositionsCount} Openings
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => onFundClick(lab._id)}
        className="w-full font-extrabold text-xs py-3 px-4 rounded-2xl shadow-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5"
      >
        <DollarSign className="w-4 h-4" />
        Award Research Grant Capital
      </button>
    </div>
  );
};
