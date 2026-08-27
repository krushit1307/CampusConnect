import React from 'react';
import { Zap, Activity, ShieldCheck, PieChart, Users, DollarSign } from 'lucide-react';

interface TimelineProps {
  syndicates: any[];
}

export const CampusVentureSyndicateTimeline: React.FC<TimelineProps> = ({ syndicates }) => {
  const totalCommittedUsd = syndicates.reduce((acc, curr) => acc + (curr.capitalCommittedUsd || 0), 0);
  const totalDeployedUsd = syndicates.reduce((acc, curr) => acc + (curr.capitalDeployedUsd || 0), 0);

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" />
            Venture Capital & Angel Syndicate Audit Telemetry Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit trail of accredited alumni LP commitments, carry allocations, and startup check deployments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-amber-500/10 text-amber-300 font-bold text-xs px-3 py-1.5 rounded-full border border-amber-500/30">
            ${totalCommittedUsd.toLocaleString()} Total LP Capital
          </span>
          <span className="bg-emerald-500/10 text-emerald-300 font-bold text-xs px-3 py-1.5 rounded-full border border-emerald-500/30">
            ${totalDeployedUsd.toLocaleString()} Deployed
          </span>
        </div>
      </div>

      {syndicates.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
          <Activity className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No venture syndicates active in the registry.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {syndicates.map((item) => (
            <div
              key={item._id}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-amber-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-base sm:text-lg">{item.syndicateName}</span>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase bg-amber-500/10 text-amber-300 border-amber-500/30">
                      {item.syndicateStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Lead Angel: {item.leadAngelName} ('{item.leadAngelAlumniClass})</span>
                    <span>•</span>
                    <span>Campus: {item.campusAffiliation}</span>
                    <span>•</span>
                    <span>Focus: {item.investmentFocus}</span>
                  </div>
                </div>
              </div>

              <div className="text-right self-end sm:self-center w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <div className="text-lg font-black text-amber-400">
                  Committed: ${item.capitalCommittedUsd.toLocaleString()}
                </div>
                <span className="text-[11px] font-semibold text-emerald-400 block">
                  Deployed: ${item.capitalDeployedUsd.toLocaleString()} ({item.portfolioStartupsCount} Startups)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
