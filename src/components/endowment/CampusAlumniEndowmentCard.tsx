import React from 'react';
import { Award, DollarSign, Gift, TrendingUp, Users } from 'lucide-react';

interface CardProps {
  endowment: {
    _id: string;
    fundName: string;
    campusName: string;
    donorAlumniName: string;
    donorGraduationYear: number;
    fundCategory: string;
    targetAmountUsd: number;
    raisedAmountUsd: number;
    disbursedAmountUsd: number;
    donorMatchingRatio: number;
    disbursalStatus: string;
  };
  onContributeClick: (fundId: string) => void;
  onDisburseClick: (fundId: string) => void;
}

export const CampusAlumniEndowmentCard: React.FC<CardProps> = ({
  endowment,
  onContributeClick,
  onDisburseClick,
}) => {
  const percentRaised = Math.min(
    Math.round((endowment.raisedAmountUsd / endowment.targetAmountUsd) * 100),
    100
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            {endowment.fundCategory}
          </span>
          <span
            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
              endowment.disbursalStatus === 'FULLY_FUNDED'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}
          >
            {endowment.disbursalStatus}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">{endowment.fundName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Donor: {endowment.donorAlumniName} ('{endowment.donorGraduationYear}) • {endowment.campusName}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-400 block tracking-tight">
              ${endowment.raisedAmountUsd.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Target: ${endowment.targetAmountUsd.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="w-full bg-slate-950 rounded-full h-2.5 mb-4 border border-slate-800 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${percentRaised}%` }}
          />
        </div>

        <div className="bg-slate-950/40 rounded-2xl p-3.5 mb-5 space-y-2 text-xs border border-slate-800/40">
          <div className="flex justify-between">
            <span className="text-slate-400">Alumni Matching Ratio:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <Gift className="w-3.5 h-3.5" />
              {endowment.donorMatchingRatio}x Match
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Disbursed Grants:</span>
            <span className="font-bold text-white flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              ${endowment.disbursedAmountUsd.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onContributeClick(endowment._id)}
          className="w-full font-extrabold text-xs py-3 px-3 rounded-2xl shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
        >
          <DollarSign className="w-4 h-4" />
          Contribute Fund
        </button>

        <button
          onClick={() => onDisburseClick(endowment._id)}
          className="w-full font-extrabold text-xs py-3 px-3 rounded-2xl shadow-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center justify-center gap-1.5"
        >
          <Gift className="w-4 h-4 text-emerald-400" />
          Disburse Grant
        </button>
      </div>
    </div>
  );
};
