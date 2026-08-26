import React from 'react';
import { Atom, Activity } from 'lucide-react';

interface TimelineProps {
  labs: any[];
}

export const CampusResearchLabGrantTimeline: React.FC<TimelineProps> = ({ labs }) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            Campus Research Lab & Grant Telemetry Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time audit trail of institutional research grants, PI allocations, and RA hiring slots.
          </p>
        </div>
        <span className="bg-slate-800 text-slate-300 font-semibold text-xs px-3 py-1 rounded-full border border-slate-700">
          {labs.length} Research Labs Active
        </span>
      </div>

      {labs.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">No research labs registered yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {labs.map((item) => (
            <div
              key={item._id}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-slate-700"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-1">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Atom className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-base">{item.labTitle}</span>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                      {item.grantStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Dept: {item.department}</span>
                    <span>•</span>
                    <span>PI: {item.principalInvestigator}</span>
                    <span>•</span>
                    <span>Category: {item.grantCategory}</span>
                  </div>
                </div>
              </div>

              <div className="text-right self-end sm:self-center w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <div className="text-lg font-black text-cyan-400">
                  Secured: ${item.fundingSecuredUsd.toLocaleString()}
                </div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Target: ${item.fundingTargetUsd.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
