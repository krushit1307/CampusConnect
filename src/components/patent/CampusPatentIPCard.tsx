import React from 'react';
import { ShieldCheck, FileText, Building2, DollarSign, Award, Percent, Layers, CheckCircle2 } from 'lucide-react';

interface CardProps {
  patent: {
    _id: string;
    inventionTitle: string;
    inventorNames: string[];
    department: string;
    campusName: string;
    patentType: string;
    filingNumber: string;
    jurisdiction: string;
    commercialLicensingFeeUsd: number;
    royaltySharePercentage: number;
    patentStatus: string;
    commercialEntityLicensee?: string;
  };
  onAdvanceStatus: (patentId: string, currentStatus: string) => void;
  onLicenseClick: (patentId: string) => void;
}

export const CampusPatentIPCard: React.FC<CardProps> = ({
  patent,
  onAdvanceStatus,
  onLicenseClick,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold px-3.5 py-1 rounded-full flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            {patent.patentType}
          </span>
          <span
            className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
              patent.patentStatus === 'LICENSED_ENTERPRISE'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : patent.patentStatus === 'PATENT_GRANTED'
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
            }`}
          >
            {patent.patentStatus}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight leading-snug">{patent.inventionTitle}</h3>
            <p className="text-xs text-slate-400 mt-1">
              Inventors: {patent.inventorNames.join(', ')} • {patent.department} ({patent.campusName})
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-indigo-400 block tracking-tight">
              ${patent.commercialLicensingFeeUsd.toLocaleString()}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">
              License Fee Target
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-slate-950/60 rounded-2xl p-4 mb-6 border border-slate-800/60 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Filing Registry:
            </span>
            <span className="font-extrabold text-white text-sm block font-mono">
              {patent.filingNumber} ({patent.jurisdiction})
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              Inventor Royalty:
            </span>
            <span className="font-extrabold text-emerald-400 text-sm block">
              {patent.royaltySharePercentage}% Royalty Split
            </span>
          </div>
          {patent.commercialEntityLicensee && (
            <div className="col-span-2 space-y-1 pt-2 border-t border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                Enterprise Licensee:
              </span>
              <span className="font-extrabold text-cyan-300 text-sm block">
                {patent.commercialEntityLicensee}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onAdvanceStatus(patent._id, patent.patentStatus)}
          className="w-full font-black text-xs py-3.5 px-3 rounded-2xl shadow-lg bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 text-slate-950 shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4 fill-current" />
          Advance Patent Stage
        </button>

        <button
          onClick={() => onLicenseClick(patent._id)}
          className="w-full font-black text-xs py-3.5 px-3 rounded-2xl shadow-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center justify-center gap-1.5"
        >
          <Building2 className="w-4 h-4 text-emerald-400" />
          License Enterprise
        </button>
      </div>
    </div>
  );
};
