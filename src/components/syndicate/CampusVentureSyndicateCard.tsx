import React from 'react';
import { DollarSign, ShieldAlert, TrendingUp, Users, Zap, Award, PieChart, Layers } from 'lucide-react';

interface CardProps {
  syndicate: {
    _id: string;
    syndicateName: string;
    leadAngelName: string;
    leadAngelAlumniClass: number;
    campusAffiliation: string;
    investmentFocus: string;
    targetFundSizeUsd: number;
    capitalCommittedUsd: number;
    capitalDeployedUsd: number;
    portfolioStartupsCount: number;
    syndicateStatus: string;
    minimumCheckSizeUsd: number;
    carryingFeePercentage: number;
    syndicateMembersCount: number;
  };
  onCommitClick: (syndicateId: string) => void;
  onDeployClick: (syndicateId: string) => void;
}

export const CampusVentureSyndicateCard: React.FC<CardProps> = ({
  syndicate,
  onCommitClick,
  onDeployClick,
}) => {
  const percentCommitted = Math.min(
    Math.round((syndicate.capitalCommittedUsd / syndicate.targetFundSizeUsd) * 100),
    100
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold px-3.5 py-1 rounded-full flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            {syndicate.investmentFocus}
          </span>
          <span
            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
              syndicate.syndicateStatus === 'ACTIVE_INVESTING'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : syndicate.syndicateStatus === 'FULLY_DEPLOYED'
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
            }`}
          >
            {syndicate.syndicateStatus}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight leading-snug">{syndicate.syndicateName}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Lead Angel: {syndicate.leadAngelName} ('{syndicate.leadAngelAlumniClass}) • {syndicate.campusAffiliation}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-amber-400 block tracking-tight">
              ${syndicate.capitalCommittedUsd.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              Target LP Pool: ${syndicate.targetFundSizeUsd.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-400">Syndicate LP Capital Pool Progress</span>
            <span className="text-amber-400">{percentCommitted}% Raised</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-800 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${percentCommitted}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-950/60 rounded-2xl p-4 mb-6 border border-slate-800/60 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              Syndicate LPs:
            </span>
            <span className="font-extrabold text-white text-sm block">
              {syndicate.syndicateMembersCount} Accredited Angels
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Min Check Size:
            </span>
            <span className="font-extrabold text-emerald-400 text-sm block">
              ${syndicate.minimumCheckSizeUsd.toLocaleString()}
            </span>
          </div>
          <div className="space-y-1 pt-2 border-t border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-cyan-400" />
              Carry Fee:
            </span>
            <span className="font-extrabold text-cyan-300 text-sm block">
              {syndicate.carryingFeePercentage}% Performance Carry
            </span>
          </div>
          <div className="space-y-1 pt-2 border-t border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              Portfolio Startups:
            </span>
            <span className="font-extrabold text-purple-300 text-sm block">
              {syndicate.portfolioStartupsCount} Funded Companies
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onCommitClick(syndicate._id)}
          className="w-full font-black text-xs py-3.5 px-3 rounded-2xl shadow-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5"
        >
          <DollarSign className="w-4 h-4 fill-current" />
          Commit LP Angel Check
        </button>

        <button
          onClick={() => onDeployClick(syndicate._id)}
          className="w-full font-black text-xs py-3.5 px-3 rounded-2xl shadow-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center justify-center gap-1.5"
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Deploy Venture Capital
        </button>
      </div>
    </div>
  );
};
