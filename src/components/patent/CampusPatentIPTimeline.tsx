import React from 'react';
import { ShieldCheck, Activity, Building2, FileText, Percent, Award } from 'lucide-react';

interface TimelineProps {
  patents: any[];
}

export const CampusPatentIPTimeline: React.FC<TimelineProps> = ({ patents }) => {
  const totalLicensingUsd = patents.reduce((acc, curr) => acc + (curr.commercialLicensingFeeUsd || 0), 0);

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Patent & Intellectual Property Commercialization Telemetry Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit trail of institutional disclosures, USPTO filings, inventor royalties, and corporate licensing revenue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-indigo-500/10 text-indigo-300 font-bold text-xs px-3.5 py-1.5 rounded-full border border-indigo-500/30">
            ${totalLicensingUsd.toLocaleString()} Commercial IP Capital
          </span>
        </div>
      </div>

      {patents.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No patent disclosures logged in the registry.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {patents.map((item) => (
            <div
              key={item._id}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-indigo-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-base sm:text-lg">{item.inventionTitle}</span>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                      {item.patentStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Filing: {item.filingNumber} ({item.jurisdiction})</span>
                    <span>•</span>
                    <span>Inventors: {item.inventorNames.join(', ')}</span>
                    <span>•</span>
                    <span>Dept: {item.department}</span>
                  </div>
                </div>
              </div>

              <div className="text-right self-end sm:self-center w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <div className="text-lg font-black text-indigo-400">
                  License: ${item.commercialLicensingFeeUsd.toLocaleString()}
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 block">
                  Royalty: {item.royaltySharePercentage}% Split
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
