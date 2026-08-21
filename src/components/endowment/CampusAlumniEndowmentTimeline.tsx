import React from 'react';
import { Award, Activity } from 'lucide-react';

interface TimelineProps {
  endowments: any[];
}

export const CampusAlumniEndowmentTimeline: React.FC<TimelineProps> = ({ endowments }) => {
  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Alumni Endowment & Grant Disbursal Audit Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry tracking alumni contributions, matching grants, and student awards.
          </p>
        </div>
        <span className="bg-slate-800 text-slate-300 font-semibold text-xs px-3 py-1 rounded-full border border-slate-700">
          {endowments.length} Active Funds
        </span>
      </div>

      {endowments.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm font-medium">No alumni endowment funds logged yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {endowments.map((item) => (
            <div
              key={item._id}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-slate-700"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                    <Award className="w-5 h-5 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-base">{item.fundName}</span>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                      {item.disbursalStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Campus: {item.campusName}</span>
                    <span>•</span>
                    <span>Donor: {item.donorAlumniName}</span>
                    <span>•</span>
                    <span>Category: {item.fundCategory}</span>
                  </div>
                </div>
              </div>

              <div className="text-right self-end sm:self-center w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                <div className="text-lg font-black text-emerald-400">
                  Raised: ${item.raisedAmountUsd.toLocaleString()}
                </div>
                <span className="text-[11px] font-semibold text-slate-500 block">
                  Disbursed: ${item.disbursedAmountUsd.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
